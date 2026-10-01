// Hangi gün sayfası oluşturulacak ya da yeniden doldurulacak? (eski aracın 2. adımı)

import { KullaniciHatasi } from '../../cekirdek/hata';
import {
  gunSayfasiMi,
  sayfaAdi,
  sayfaTarihi,
  sayfaTarihiYilli,
  sonrakiGun,
  yilOf,
  type Tarih,
} from '../../cekirdek/tarih';

export interface GunSayfasi {
  ad: string;
  tarih: Tarih;
}

export type GunSecimi =
  | { tur: 'yeni'; tarih: Tarih; ad: string; onceki: GunSayfasi }
  | { tur: 'mevcut'; tarih: Tarih; ad: string; onceki: GunSayfasi };

/** Kitaptaki gün sayfaları, sekme sırasıyla. */
export function gunSayfalari(sayfaAdlari: readonly string[], bugun: Tarih): GunSayfasi[] {
  return sayfaAdlari.flatMap((ad) => {
    const tarih = gunSayfasiMi(ad) ? sayfaTarihiYilli(ad, bugun) : null;
    return tarih ? [{ ad, tarih }] : [];
  });
}

/** Son gün sayfasından sonraki iş günü. */
export function tarihOnerisi(gunler: readonly GunSayfasi[], pazarAtla: boolean): Tarih {
  const son = gunler.at(-1);
  if (!son) throw new KullaniciHatasi('Depo kontrol dosyasında GG.AA adlı bir gün sayfası bulunamadı.');
  return sonrakiGun(son.tarih, pazarAtla);
}

/**
 * Seçilen tarih için ne yapılacağı. O günün sayfası varsa yeniden doldurulur (arayüz önce
 * sorar), yoksa son sayfadan sonra yeni sayfa açılır.
 */
export function gunSec(gunler: readonly GunSayfasi[], tarih: Tarih): GunSecimi {
  const son = gunler.at(-1);
  if (!son) throw new KullaniciHatasi('Depo kontrol dosyasında GG.AA adlı bir gün sayfası bulunamadı.');

  const i = gunler.findIndex((g) => sayfaTarihi(g.ad, yilOf(tarih)) === tarih);
  const mevcut = gunler[i];
  if (mevcut) {
    const onceki = gunler[i - 1];
    if (!onceki) throw new KullaniciHatasi(`'${mevcut.ad}' sayfasından önce gelen bir gün sayfası yok.`);
    return { tur: 'mevcut', tarih, ad: mevcut.ad, onceki };
  }
  if (tarih <= son.tarih) {
    throw new KullaniciHatasi(
      `Seçilen gün (${sayfaAdi(tarih)}) son sayfadan (${son.ad}) önce. Yeni gün son sayfadan sonra olmalı.`,
    );
  }
  return { tur: 'yeni', tarih, ad: sayfaAdi(tarih), onceki: son };
}
