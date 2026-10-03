import { gecmisGecerli } from '../cekirdek/gecmis';
export { gecmisGecerli } from '../cekirdek/gecmis';
import { ayarGecerli } from '../cekirdek/ayarDenetimi';
import { VARSAYILAN_AYARLAR, type Ayarlar } from '../cekirdek/ayarlar';
import { KullaniciHatasi } from '../cekirdek/hata';
import { ayarBirlestir } from './ayarlar';
import { driveIndir, driveListele, driveYukle, type DriveDosyasi } from './drive';
import { gecmisListesi, type GecmisKaydi } from './gecmis';
import { driveHesabiDogrula, driveToken } from './driveKimlik';
import * as idb from './idb';

function uzakGecmis(k: GecmisKaydi): GecmisKaydi {
  const sonuc = { ...k };
  delete sonuc.yedekId;
  return sonuc;
}

export interface DriveOturumu {
  surum: 1;
  zaman: string;
  ayarlar: Ayarlar;
  gecmis: GecmisKaydi[];
}
const EN_BUYUK_OTURUM = 2 * 1024 * 1024;
export function oturumCoz(metin: string): DriveOturumu {
  try {
    if (new TextEncoder().encode(metin).byteLength > EN_BUYUK_OTURUM) throw new Error();
    const v = JSON.parse(metin) as DriveOturumu;
    if (
      v.surum !== 1 ||
      !Number.isFinite(Date.parse(v.zaman)) ||
      !ayarGecerli(v.ayarlar) ||
      !Array.isArray(v.gecmis) ||
      v.gecmis.length > 500 ||
      !v.gecmis.every(gecmisGecerli)
    )
      throw new Error();
    return {
      surum: 1,
      zaman: v.zaman,
      ayarlar: ayarBirlestir(VARSAYILAN_AYARLAR, v.ayarlar),
      gecmis: v.gecmis.map(uzakGecmis),
    };
  } catch {
    throw new KullaniciHatasi(
      'Drive’daki ayar ve geçmiş kaydı bozuk veya bu sürümle uyumlu değil. Bilgisayardaki kayıtlar değiştirilmedi.',
    );
  }
}
export function gecmisBirlestir(a: readonly GecmisKaydi[], b: readonly GecmisKaydi[]): GecmisKaydi[] {
  const anahtar = (k: GecmisKaydi) => JSON.stringify([k.zaman, k.rapor, k.dosya, k.sayfa, k.kayit]);
  const kayitlar = new Map<string, GecmisKaydi>();
  for (const k of [...b, ...a]) kayitlar.set(anahtar(k), k);
  return [...kayitlar.values()].sort((a, b) => b.zaman.localeCompare(a.zaman)).slice(0, 500);
}
export async function driveOturumOku(d: DriveDosyasi, signal?: AbortSignal): Promise<DriveOturumu> {
  return oturumCoz(
    new TextDecoder('utf-8', { fatal: true }).decode(await driveIndir(d, EN_BUYUK_OTURUM, signal)),
  );
}
/** Geçmiş iki taraftan birleştirilir. Ayarlar sadece kullanıcının açık seçimiyle uygulanır. */
export async function driveEsitle(a: Ayarlar, signal?: AbortSignal): Promise<DriveDosyasi> {
  const token = driveToken();
  const liste = await driveListele('oturum', signal);
  const uzak: GecmisKaydi[] = [];
  // Birden fazla cihazın eş zamanlı kopyaları da korunur; otomatik üzerine yazma yoktur.
  for (const d of liste.slice(0, 10)) {
    driveHesabiDogrula(token);
    uzak.push(...(await driveOturumOku(d, signal)).gecmis);
  }
  const gecmis = gecmisBirlestir(await gecmisListesi(true), uzak);
  if (!ayarGecerli(a)) throw new KullaniciHatasi('Ayarlar geçersiz.');
  const oturum: DriveOturumu = {
    surum: 1,
    zaman: new Date().toISOString(),
    ayarlar: a,
    gecmis: gecmis.map(uzakGecmis),
  };
  const bayt = new TextEncoder().encode(JSON.stringify(oturum));
  if (bayt.byteLength > EN_BUYUK_OTURUM)
    throw new KullaniciHatasi('Geçmiş kaydı çok büyük. Önce CSV olarak arşivleyin.');
  driveHesabiDogrula(token);
  const d = await driveYukle(
    `Ayarlar ve geçmiş ${oturum.zaman.replace(/[:.]/g, '-')}.json`,
    bayt,
    'oturum',
    signal,
  );
  signal?.throwIfAborted();
  driveHesabiDogrula(token);
  if (
    !(await idb.guncelle('gecmis', (onceki) => {
      signal?.throwIfAborted();
      return gecmisBirlestir(Array.isArray(onceki) ? onceki : [], gecmis);
    }))
  )
    throw new KullaniciHatasi(
      'Drive kopyası kaydedildi fakat bu tarayıcıda geçmiş saklanamadı. Site verisi iznini kontrol edin.',
    );
  return d;
}
export async function driveGecmisiUygula(o: DriveOturumu, signal?: AbortSignal): Promise<void> {
  if (
    !(await idb.guncelle('gecmis', (onceki) => {
      signal?.throwIfAborted();
      return gecmisBirlestir(Array.isArray(onceki) ? onceki : [], o.gecmis);
    }))
  )
    throw new KullaniciHatasi('Geçmiş tarayıcıya kaydedilemedi. Site verisi iznini kontrol edin.');
}
