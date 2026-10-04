import { gecmisGecerli, type GecmisKaydi } from './gecmis';
import { ayarGecerli } from './ayarDenetimi';
import { VARSAYILAN_AYARLAR, type Ayarlar } from './ayarlar';
import { KullaniciHatasi } from './hata';
import { ayarBirlestir } from './ayarBirlestir';

export function uzakGecmis(k: GecmisKaydi): GecmisKaydi {
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
export const EN_BUYUK_OTURUM = 2 * 1024 * 1024;
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
