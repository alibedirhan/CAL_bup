// Dosya seçme, okuma ve kaydetme. Chrome ve Edge'de dosyanın kendisine yazılabilir
// (File System Access API); diğer tarayıcılarda yeni dosya olarak indirilir.

import { KullaniciHatasi } from '../cekirdek/hata';
import * as idb from './idb';
import { EN_BUYUK_DOSYA, XLSX_MIME } from '../cekirdek/dosya';

const XLSX_TURU = { description: 'Excel dosyası', accept: { [XLSX_MIME]: ['.xlsx'] } };

export const XLSX_KABUL = `.xlsx,${XLSX_MIME}`;

/** Okunmuş dosya. `tanitici` varsa aynı dosyanın üzerine kaydedilebilir. */
export interface SecilenDosya {
  ad: string;
  bayt: Uint8Array;
  sonDegisiklik: number;
  tanitici?: FileSystemFileHandle;
}

interface DosyaSistemiPenceresi {
  showOpenFilePicker?: (secenek: object) => Promise<FileSystemFileHandle[]>;
}

export function dogrudanKayitVar(): boolean {
  return typeof (window as DosyaSistemiPenceresi).showOpenFilePicker === 'function';
}

export async function dosyaOku(dosya: File, tanitici?: FileSystemFileHandle): Promise<SecilenDosya> {
  if (!/\.xlsx$/i.test(dosya.name)) {
    throw new KullaniciHatasi(
      'Yalnızca .xlsx dosyaları kullanılabilir. Makrolu dosyayı Excel’de .xlsx olarak kaydedin.',
    );
  }
  if (dosya.size > EN_BUYUK_DOSYA) throw new KullaniciHatasi('Dosya çok büyük. En fazla 25 MB olabilir.');
  const bayt = new Uint8Array(await dosya.arrayBuffer());
  return { ad: dosya.name, bayt, sonDegisiklik: dosya.lastModified, ...(tanitici ? { tanitici } : {}) };
}

/** Kaydedilebilir dosya seçtirir (Chrome/Edge). Vazgeçilirse null. */
export async function kaydedilebilirDosyaSec(): Promise<SecilenDosya | null> {
  const ac = (window as DosyaSistemiPenceresi).showOpenFilePicker;
  if (!ac) return null;
  try {
    const [tanitici] = await ac({ types: [XLSX_TURU], excludeAcceptAllOption: false, multiple: false });
    if (!tanitici) return null;
    return dosyaOku(await tanitici.getFile(), tanitici);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

/** Sürükle-bırakta dosya tanıtıcısı da alınabiliyorsa alır (Chrome/Edge). */
export async function birakilanDosyalar(
  veri: DataTransfer,
): Promise<{ dosya: File; tanitici?: FileSystemFileHandle }[]> {
  const ogeler = [...veri.items].filter((o) => o.kind === 'file');
  const sonuc = await Promise.all(
    ogeler.map(async (o) => {
      const dosya = o.getAsFile();
      if (!dosya) return null;
      const al = (o as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> })
        .getAsFileSystemHandle;
      const tanitici = al ? await al.call(o).catch(() => null) : null;
      return tanitici?.kind === 'file' ? { dosya, tanitici: tanitici as FileSystemFileHandle } : { dosya };
    }),
  );
  return sonuc.filter((s): s is NonNullable<typeof s> => s !== null);
}

// ---- Hatırlanan depo kontrol dosyası ----

const HEDEF_ANAHTARI = 'hedef-tanitici';

export async function hedefiHatirla(tanitici: FileSystemFileHandle): Promise<void> {
  await idb.yaz(HEDEF_ANAHTARI, tanitici);
}

export async function hatirlananHedef(): Promise<FileSystemFileHandle | null> {
  return (await idb.oku<FileSystemFileHandle>(HEDEF_ANAHTARI)) ?? null;
}

export async function hedefiUnut(): Promise<void> {
  if (!(await idb.sil(HEDEF_ANAHTARI)))
    throw new KullaniciHatasi(
      'Hatırlanan dosya tarayıcıdan kaldırılamadı. Site verisi iznini kontrol edip yeniden deneyin.',
    );
}

type IzinliTanitici = FileSystemFileHandle & {
  queryPermission?: (o: object) => Promise<PermissionState>;
  requestPermission?: (o: object) => Promise<PermissionState>;
};

/** Okuma ve yazma izni ister (tarayıcı her oturumda bir kez sorar). Düğme tıklamasında çağrılmalı. */
export async function yazmaIzni(tanitici: FileSystemFileHandle): Promise<boolean> {
  const t = tanitici as IzinliTanitici;
  const secenek = { mode: 'readwrite' };
  if ((await t.queryPermission?.(secenek)) === 'granted') return true;
  return (await t.requestPermission?.(secenek)) === 'granted';
}

/** Dosyanın üzerine yazar. Dosya Excel'de açıksa anlaşılır bir hata verir. */
export async function dosyayaYaz(
  tanitici: FileSystemFileHandle,
  bayt: Uint8Array,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  if (!(await yazmaIzni(tanitici))) {
    throw new KullaniciHatasi('Dosyaya yazma izni verilmedi. Yeni dosya olarak indirebilirsiniz.');
  }
  let yazici: FileSystemWritableFileStream | undefined;
  let kapandi = false;
  const iptal = () => {
    void yazici?.abort().catch(() => undefined);
  };
  signal?.addEventListener('abort', iptal, { once: true });
  try {
    signal?.throwIfAborted();
    yazici = await tanitici.createWritable();
    signal?.throwIfAborted();
    await yazici.write(bayt as unknown as BufferSource);
    signal?.throwIfAborted();
    await yazici.close();
    kapandi = true;
  } catch (e) {
    const ad = e instanceof DOMException ? e.name : '';
    if (ad === 'NoModificationAllowedError' || ad === 'InvalidStateError' || ad === 'NotReadableError') {
      throw new KullaniciHatasi(
        `${tanitici.name} şu anda başka bir programda (büyük olasılıkla Excel'de) açık. ` +
          "Dosyayı Excel'de kapatıp yeniden kaydedin.",
      );
    }
    throw e;
  } finally {
    signal?.removeEventListener('abort', iptal);
    if (!kapandi) await yazici?.abort().catch(() => undefined);
  }
}

/** Baytları dosya olarak indirir. */
export function indir(bayt: Uint8Array, ad: string, tur = XLSX_MIME): void {
  const blob = new Blob([bayt as unknown as BlobPart], { type: tur });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ad;
  document.body.append(a);
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
