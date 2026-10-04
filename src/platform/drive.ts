import { IslemHatasi } from '../cekirdek/islemSonucu';
// Google Drive REST adaptörü: sadece CAL bup tarafından oluşturulan dosyalar.
import { EN_BUYUK_DOSYA, XLSX_MIME } from '../cekirdek/dosya';
import { KullaniciHatasi } from '../cekirdek/hata';
import { driveAyir, driveAnlikKimlik, type DriveOturumKimligi, driveHesabiDogrula } from './driveKimlik';

const API = 'https://www.googleapis.com/drive/v3/files';
const YUKLEME = 'https://www.googleapis.com/upload/drive/v3/files';
const KLASOR = 'application/vnd.google-apps.folder';
export type DriveTuru = 'rapor' | 'yedek' | 'led' | 'oturum' | 'klasor';
export interface DriveDosyasi {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  size?: string;
  appProperties: { calbup: string; tur: DriveTuru; ozet?: string };
}
const ALANLAR = 'id,name,mimeType,createdTime,size,appProperties';
function kimlik(k: string): string {
  if (!/^[\w-]{1,256}$/.test(k)) throw new KullaniciHatasi('Drive dosya kimliği geçersiz.');
  return k;
}
function dosya(v: unknown): DriveDosyasi {
  const d = v as DriveDosyasi | null;
  if (
    !d ||
    typeof d.id !== 'string' ||
    typeof d.name !== 'string' ||
    !d.name.trim() ||
    d.name.length > 512 ||
    (d.size !== undefined &&
      (typeof d.size !== 'string' || !/^\d{1,16}$/.test(d.size) || !Number.isSafeInteger(Number(d.size)))) ||
    (d.appProperties?.ozet !== undefined &&
      (typeof d.appProperties.ozet !== 'string' || !/^[a-f0-9]{64}$/.test(d.appProperties.ozet))) ||
    typeof d.mimeType !== 'string' ||
    typeof d.createdTime !== 'string' ||
    !Number.isFinite(Date.parse(d.createdTime)) ||
    d.appProperties?.calbup !== 'v1' ||
    !['rapor', 'yedek', 'led', 'oturum', 'klasor'].includes(d.appProperties.tur)
  ) {
    throw new KullaniciHatasi('Drive beklenen dosya bilgisini vermedi. Yeniden deneyin.');
  }
  kimlik(d.id);
  return d;
}

async function istek(
  url: string,
  secenek: RequestInit = {},
  t = driveAnlikKimlik(),
  signal?: AbortSignal,
): Promise<Response> {
  signal?.throwIfAborted();
  driveHesabiDogrula(t);
  let r: Response;
  try {
    r = await fetch(url, {
      ...secenek,
      headers: { ...secenek.headers, Authorization: `Bearer ${t.deger}` },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
      redirect: 'error',
    });
  } catch {
    const yazma = ['POST', 'PUT'].includes(secenek.method ?? 'GET');
    if (yazma)
      throw new IslemHatasi(
        'belirsiz',
        'DRIVE_YAZMA_SONUCU_BELIRSIZ',
        'Drive yazısının sonucu doğrulanamadı. Bazı kopyalar oluşmuş olabilir; güncel listeyi kontrol edin.',
      );
    if (signal?.aborted) throw new IslemHatasi('iptal', 'IPTAL', 'Drive işlemi durduruldu.');
    throw new IslemHatasi(
      'hata',
      'DRIVE_AG',
      'Drive’a ulaşılamadı veya süre doldu. İnterneti kontrol edip yeniden deneyin; bilgisayardaki dosyanız korunur.',
    );
  }
  driveHesabiDogrula(t);
  if (r.status === 401) {
    driveAyir();
    throw new KullaniciHatasi('Drive oturumu sona erdi. Ayarlar’dan yeniden bağlanın.');
  }
  if (!r.ok) {
    const mesaj =
      r.status === 403
        ? 'Drive izni ya da boş alan yetersiz. Google hesabınızı kontrol edin.'
        : r.status === 404
          ? 'Drive dosyası bulunamadı. Listeyi yenileyin.'
          : r.status === 429
            ? 'Drive çok fazla istek aldı. Biraz bekleyip yeniden deneyin.'
            : 'Drive işlemi tamamlanamadı. Yeniden deneyin; önceki dosyalarınız korunur.';
    throw new KullaniciHatasi(mesaj);
  }
  return r;
}

async function liste(q: string, token: DriveOturumKimligi, signal?: AbortSignal): Promise<DriveDosyasi[]> {
  const sonuc: DriveDosyasi[] = [];
  let sayfa = '';
  const gorulen = new Set<string>();
  do {
    const p = new URLSearchParams({
      q: `trashed = false and appProperties has { key='calbup' and value='v1' } and (${q})`,
      fields: `nextPageToken,files(${ALANLAR})`,
      pageSize: '100',
      orderBy: 'createdTime desc',
    });
    if (sayfa) p.set('pageToken', sayfa);
    const yanit: unknown = await (await istek(`${API}?${p}`, {}, token, signal)).json();
    const veri = yanit as { files?: unknown[]; nextPageToken?: unknown };
    if (
      !veri ||
      !Array.isArray(veri.files) ||
      (veri.nextPageToken !== undefined && typeof veri.nextPageToken !== 'string')
    )
      throw new KullaniciHatasi('Drive dosya listesi okunamadı.');
    sonuc.push(...veri.files.map(dosya));
    sayfa = typeof veri.nextPageToken === 'string' ? veri.nextPageToken : '';
    if (sayfa && (gorulen.has(sayfa) || gorulen.size >= 100))
      throw new KullaniciHatasi(
        'Drive dosya listesi tamamlanamadı: sayfa anahtarı tekrarlı veya sayfa sınırı aşıldı. Listeyi yeniden açın.',
      );
    if (sayfa) gorulen.add(sayfa);
    if (sonuc.length >= 10000 && sayfa)
      throw new KullaniciHatasi(
        'CAL bup klasöründe çok fazla dosya var. Eski kayıtları Drive’dan arşivleyin.',
      );
  } while (sayfa);
  return sonuc;
}

async function klasorAl(token: DriveOturumKimligi, signal?: AbortSignal): Promise<DriveDosyasi> {
  const klasorler = await liste(
    `mimeType = '${KLASOR}' and appProperties has { key='tur' and value='klasor' }`,
    token,
    signal,
  );
  // Eş zamanlı iki cihaz klasör oluşturmuşsa her seferinde aynı, en eski klasör seçilir.
  const varolan = klasorler.sort(
    (a, b) => a.createdTime.localeCompare(b.createdTime) || a.id.localeCompare(b.id),
  )[0];
  if (varolan) return varolan;
  return dosya(
    await (
      await istek(
        `${API}?fields=${ALANLAR}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'CAL bup',
            mimeType: KLASOR,
            appProperties: { calbup: 'v1', tur: 'klasor' },
          }),
        },
        token,
        signal,
      )
    ).json(),
  );
}

// Aynı sekmede klasör oluşturma / yükleme yarışı olmaz. Başarısız işlem kuyruğu durdurmaz.
let kuyruk: Promise<unknown> = Promise.resolve();
function sirala<T>(is: (token: DriveOturumKimligi) => Promise<T>, signal?: AbortSignal): Promise<T> {
  let token: DriveOturumKimligi;
  try {
    token = driveAnlikKimlik();
  } catch (e) {
    return Promise.reject(e);
  }
  const calis = () => {
    signal?.throwIfAborted();
    driveHesabiDogrula(token);
    return is(token);
  };
  const sonuc = kuyruk.then(calis, calis);
  kuyruk = sonuc.catch(() => {});
  return sonuc;
}
export function driveListele(tur: DriveTuru, signal?: AbortSignal): Promise<DriveDosyasi[]> {
  return sirala(async (token) => {
    const klasor = await klasorAl(token, signal);
    return liste(
      `'${kimlik(klasor.id)}' in parents and appProperties has { key='tur' and value='${tur}' }`,
      token,
      signal,
    );
  }, signal);
}

/** Her kayıt ayrı kopyadır; başka cihazın raporu veya ayarları ezilmez. */
export function driveYukle(
  ad: string,
  bayt: Uint8Array,
  tur: Exclude<DriveTuru, 'klasor'>,
  signal?: AbortSignal,
): Promise<DriveDosyasi> {
  return sirala(async (token) => {
    if (!ad.trim() || ad.length > 512 || bayt.byteLength === 0 || bayt.byteLength > EN_BUYUK_DOSYA)
      throw new KullaniciHatasi('Drive dosyası boş veya çok büyük. En fazla 25 MB olabilir.');
    const klasor = await klasorAl(token, signal);
    const ozetBayt = await crypto.subtle.digest('SHA-256', bayt as unknown as BufferSource);
    const ozet = [...new Uint8Array(ozetBayt)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const ayni = await liste(
      `'${kimlik(klasor.id)}' in parents and appProperties has { key='tur' and value='${tur}' } and appProperties has { key='ozet' and value='${ozet}' }`,
      token,
      signal,
    );
    if (ayni[0]) return ayni[0];
    const mimeType = tur === 'oturum' ? 'application/json' : XLSX_MIME;
    const baslat = await istek(
      `${YUKLEME}?uploadType=resumable&fields=${ALANLAR}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(bayt.byteLength),
        },
        body: JSON.stringify({
          name: ad,
          mimeType,
          parents: [klasor.id],
          appProperties: { calbup: 'v1', tur, ozet },
        }),
      },
      token,
      signal,
    );
    const adres = baslat.headers.get('Location');
    if (!adres) throw new KullaniciHatasi('Drive yükleme adresi vermedi. Yeniden deneyin.');
    const url = new URL(adres);
    if (
      url.origin !== 'https://www.googleapis.com' ||
      url.pathname !== '/upload/drive/v3/files' ||
      url.username ||
      url.password
    )
      throw new KullaniciHatasi('Drive yükleme adresi geçersiz.');
    return dosya(
      await (
        await istek(
          url.href,
          {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: new Blob([bayt as unknown as BlobPart], { type: mimeType }),
          },
          token,
          signal,
        )
      ).json(),
    );
  }, signal);
}

/** İndirmede boyut akış boyunca sınırlandırılır; HTTP başlığına tek başına güvenilmez. */
export async function driveIndir(
  d: DriveDosyasi,
  en = EN_BUYUK_DOSYA,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  dosya(d);
  const token = driveAnlikKimlik();
  if (d.size && Number(d.size) > en) throw new KullaniciHatasi('Drive dosyası çok büyük.');
  const r = await istek(`${API}/${kimlik(d.id)}?alt=media`, {}, token, signal);
  if (Number(r.headers.get('Content-Length')) > en) {
    await r.body?.cancel();
    throw new KullaniciHatasi('Drive dosyası çok büyük.');
  }
  if (!r.body) throw new KullaniciHatasi('Drive dosyası indirilemedi.');
  const okuyucu = r.body.getReader();
  const parcalar: Uint8Array[] = [];
  let boyut = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await okuyucu.read();
      if (done) break;
      boyut += value.byteLength;
      if (boyut > en) throw new KullaniciHatasi('Drive dosyası çok büyük.');
      parcalar.push(value);
    }
    driveHesabiDogrula(token);
    const bayt = new Uint8Array(boyut);
    let p = 0;
    for (const parca of parcalar) {
      bayt.set(parca, p);
      p += parca.byteLength;
    }
    if (d.appProperties.ozet) {
      const ozet = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bayt))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (ozet !== d.appProperties.ozet)
        throw new KullaniciHatasi(
          'Drive dosyası CAL bup dışında değiştirilmiş. Drive’dan indirip içeriğini kontrol edin.',
        );
    }
    driveHesabiDogrula(token);
    return bayt;
  } finally {
    await okuyucu.cancel().catch(() => {});
    okuyucu.releaseLock();
  }
}
export function driveDosyaAdresi(d: DriveDosyasi): string {
  return `https://drive.google.com/file/d/${kimlik(d.id)}/view`;
}
