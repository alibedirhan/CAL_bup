import { sonucDosyaAdi } from './adlandirma';
import { kenarlariTemizle, musteriAnahtari } from './metin';
import type { MusteriListesi, MusteriSonucu, Plasiyerler } from './turler';

/** Sırayı ve ilk yazımı korur; kaynak sayıları için tekrarlar ayrıca silinmez. */
function eksikleriBul(eski: readonly string[], yeni: readonly string[], harfDuyarli: boolean): string[] {
  const yeniKumesi = new Set(
    yeni
      .map(kenarlariTemizle)
      .filter(Boolean)
      .map((m) => musteriAnahtari(m, harfDuyarli)),
  );
  const gorulen = new Set<string>();
  const sonuc: string[] = [];
  for (const ad of eski) {
    const temiz = kenarlariTemizle(ad);
    const anahtar = musteriAnahtari(temiz, harfDuyarli);
    if (!temiz || yeniKumesi.has(anahtar) || gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    sonuc.push(temiz);
  }
  return sonuc;
}

export function musterileriKarsilastir(
  eski: MusteriListesi,
  yeni: MusteriListesi,
  harfDuyarli = false,
  plasiyerler: Plasiyerler = {},
): MusteriSonucu {
  const eksikler = eksikleriBul(eski.musteriler, yeni.musteriler, harfDuyarli);
  return {
    eksikler,
    yeniler: eksikleriBul(yeni.musteriler, eski.musteriler, harfDuyarli),
    eskiSayisi: eski.musteriler.length,
    yeniSayisi: yeni.musteriler.length,
    depo: eski.depo,
    mesaj: `Toplam ${eski.musteriler.length} cari ünvandan ${eksikler.length} tanesi yeni dosyada bulunmuyor.`,
    dosyaAdi: sonucDosyaAdi(eski.depo, plasiyerler),
  };
}
