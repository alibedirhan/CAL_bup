// Hangi gün sayfası oluşturulacak ya da yeniden doldurulacak? (eski aracın 2. adımı)

import { KullaniciHatasi } from '../../cekirdek/hata';
import {
  gunSayfasiMi,
  sayfaAdi,
  sayfaTarihi,
  sayfaTarihiYilli,
  sonrakiGun,
  tarihMetni,
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
  const gunler = sayfaAdlari.flatMap((ad) => {
    const tarih = gunSayfasiMi(ad) ? sayfaTarihiYilli(ad, bugun) : null;
    return tarih ? [{ ad, tarih }] : [];
  });
  const gorulen = new Set<Tarih>();
  for (const [i, g] of gunler.entries()) {
    if (gorulen.has(g.tarih))
      throw new KullaniciHatasi(
        'Dosyada aynı günü gösteren birden fazla sayfa var. Gün sayfalarını kontrol edin; dosya değiştirilmedi.',
      );
    if (i > 0 && g.tarih < (gunler[i - 1]?.tarih ?? g.tarih))
      throw new KullaniciHatasi(
        'Gün sayfalarının sırası tarihlerle uyuşmuyor. Excel’de gün sekmelerini eskiden yeniye sıralayıp dosyayı yeniden açın.',
      );
    gorulen.add(g.tarih);
  }
  return gunler;
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

  if (gunler.some((g) => sayfaTarihi(g.ad, yilOf(tarih)) === tarih && g.tarih !== tarih))
    throw new KullaniciHatasi(
      'Aynı gün ve ay başka yılın sayfasında bulunuyor. Yıl bilgisi olmayan sayfanın üzerine yazılmadı; yeni yıl için ayrı bir depo kontrol dosyası kullanın.',
    );
  const i = gunler.findIndex((g) => g.tarih === tarih);
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

/**
 * Önceki gün sayfasıyla seçilen gün arasında kalan, sayfası olmayan iş günleri.
 * Ayara göre pazar sayılmaz. Uzun boşluklarda liste ilk 400 günle sınırlanır.
 */
export function atlananGunler(onceki: Tarih, secilen: Tarih, pazarAtla: boolean): Tarih[] {
  const gunler: Tarih[] = [];
  for (
    let g = sonrakiGun(onceki, pazarAtla);
    g < secilen && gunler.length < 400;
    g = sonrakiGun(g, pazarAtla)
  )
    gunler.push(g);
  return gunler;
}

/** Atlanan günlerin kısa metni: üç güne kadar tek tek, fazlası aralık olarak. */
export function atlananGunMetni(gunler: readonly Tarih[]): string {
  const ilk = gunler[0];
  const son = gunler.at(-1);
  if (!ilk || !son) return '';
  if (gunler.length <= 3) return gunler.map(tarihMetni).join(', ');
  return `${gunler.length} iş günü (${tarihMetni(ilk)} – ${tarihMetni(son)})`;
}
