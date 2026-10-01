// Dosya seçme, okuma ve kaydetme. Chrome ve Edge'de dosyanın kendisine yazılabilir
// (File System Access API); diğer tarayıcılarda yeni dosya olarak indirilir.

import { KullaniciHatasi } from '../cekirdek/hata';
import * as idb from './idb';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSX_TURU = { description: 'Excel dosyası', accept: { [XLSX_MIME]: ['.xlsx', '.xlsm'] } };

export const XLSX_KABUL = `.xlsx,.xlsm,${XLSX_MIME}`;

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
  await idb.sil(HEDEF_ANAHTARI);
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
export async function dosyayaYaz(tanitici: FileSystemFileHandle, bayt: Uint8Array): Promise<void> {
  if (!(await yazmaIzni(tanitici))) {
    throw new KullaniciHatasi('Dosyaya yazma izni verilmedi. Yeni dosya olarak indirebilirsiniz.');
  }
  try {
    const yazici = await tanitici.createWritable();
    await yazici.write(bayt as unknown as BufferSource);
    await yazici.close();
  } catch (e) {
    const ad = e instanceof DOMException ? e.name : '';
    if (ad === 'NoModificationAllowedError' || ad === 'InvalidStateError' || ad === 'NotReadableError') {
      throw new KullaniciHatasi(
        `${tanitici.name} şu anda başka bir programda (büyük olasılıkla Excel'de) açık. ` +
          "Dosyayı Excel'de kapatıp yeniden kaydedin.",
      );
    }
    throw e;
  }
}

/** Baytları dosya olarak indirir. */
export function indir(bayt: Uint8Array, ad: string): void {
  const blob = new Blob([bayt as unknown as BlobPart], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ad;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
