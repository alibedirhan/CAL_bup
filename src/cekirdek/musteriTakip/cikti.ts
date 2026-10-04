import { KullaniciHatasi } from '../hata';
import { ciktiBasligi } from './adlandirma';
import type { ListeYonu, MusteriCiktisi, MusteriSonucu, Plasiyerler } from './turler';

export function musteriCiktisi(
  sonuc: MusteriSonucu,
  plasiyerler: Plasiyerler,
  secim?: { yon: ListeYonu; satirlar: readonly string[] },
): MusteriCiktisi {
  if (secim) {
    const izinli = new Set(secim.yon === 'eksik' ? sonuc.eksikler : sonuc.yeniler);
    if (
      !secim.satirlar.length ||
      new Set(secim.satirlar).size !== secim.satirlar.length ||
      secim.satirlar.some((s) => !izinli.has(s))
    ) {
      throw new KullaniciHatasi(
        'Dışa aktarılacak görünen satırlar geçersiz veya boş. Listeyi yeniden kontrol edin.',
      );
    }
  }
  return {
    // Masaüstünde önerilen dosya adı karşılaştırma anına, başlık güncel ayara aittir.
    ad: sonuc.dosyaAdi,
    baslik: ciktiBasligi(sonuc.depo, plasiyerler),
    satirlar: secim ? [...secim.satirlar] : sonuc.eksikler,
    yon: secim?.yon ?? 'eksik',
    gorunen: !!secim,
  };
}

export function guvenliHucre(metin: string): string {
  return /^[=+\-@\t\r]/.test(metin) ? `'${metin}` : metin;
}
