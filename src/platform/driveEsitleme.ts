export { gecmisGecerli } from '../cekirdek/gecmis';
import { ayarGecerli } from '../cekirdek/ayarDenetimi';
import { type Ayarlar } from '../cekirdek/ayarlar';
import { KullaniciHatasi } from '../cekirdek/hata';
import { driveIndir, driveListele, driveYukle, type DriveDosyasi } from './drive';
import { gecmisListesi, type GecmisKaydi } from './gecmis';
import { driveHesabiDogrula, driveAnlikKimlik } from './driveKimlik';
import * as idb from './idb';

import { oturumCoz, uzakGecmis, EN_BUYUK_OTURUM, type DriveOturumu } from '../cekirdek/driveOturumu';
import { gecmisBirlestir, gecmisListesiniDogrula } from '../cekirdek/gecmis';
export { oturumCoz, type DriveOturumu } from '../cekirdek/driveOturumu';
export { gecmisBirlestir } from '../cekirdek/gecmis';

export async function driveOturumOku(d: DriveDosyasi, signal?: AbortSignal): Promise<DriveOturumu> {
  return oturumCoz(
    new TextDecoder('utf-8', { fatal: true }).decode(await driveIndir(d, EN_BUYUK_OTURUM, signal)),
  );
}
/** Geçmiş iki taraftan birleştirilir. Ayarlar sadece kullanıcının açık seçimiyle uygulanır. */
export async function driveEsitle(a: Ayarlar, signal?: AbortSignal): Promise<DriveDosyasi> {
  const token = driveAnlikKimlik();
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
      return gecmisBirlestir(gecmisListesiniDogrula(onceki), gecmis);
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
      return gecmisBirlestir(gecmisListesiniDogrula(onceki), o.gecmis);
    }))
  )
    throw new KullaniciHatasi('Geçmiş tarayıcıya kaydedilemedi. Site verisi iznini kontrol edin.');
}
