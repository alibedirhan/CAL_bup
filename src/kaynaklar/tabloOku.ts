import type { TabloDuzeni } from '../cekirdek/ayarlar';
import { sutunNo } from '../cekirdek/ayarlar';
import { KaynakVeri } from '../cekirdek/kaynakVeri';
import { adNormal } from '../cekirdek/metin';
import { miktarDogrula } from '../cekirdek/sayi';
import { OkumaHatasi, type Sayfa } from './kitap';

/**
 * LED tablosunu okur (eski aracın TabloOku'su).
 * İsim doluysa ürün satırıdır. İsim ve kod boş, miktar doluysa dip toplamdır (ilki alınır).
 */
export function tabloOku(sayfa: Sayfa, duzen: TabloDuzeni, raporTuru: string): KaynakVeri {
  const kv = new KaynakVeri(raporTuru);
  const cKod = sutunNo(duzen.kodSutunu);
  const cAd = sutunNo(duzen.isimSutunu);
  const cMiktar = sutunNo(duzen.miktarSutunu);

  let son = 0;
  for (let r = sayfa.sonSatir; r >= 1; r--) {
    if (
      sayfa.hucre(r, cMiktar) !== null ||
      adNormal(sayfa.hucre(r, cAd)) ||
      sayfa.hesaplanmamisFormul?.(r, cMiktar)
    ) {
      son = r;
      break;
    }
  }

  for (let r = duzen.ilkVeriSatiri; r <= son; r++) {
    const ad = adNormal(sayfa.hucre(r, cAd));
    const kod = adNormal(sayfa.hucre(r, cKod));
    const v = sayfa.hucre(r, cMiktar);
    if (ad) {
      if (sayfa.hesaplanmamisFormul?.(r, cMiktar))
        throw new OkumaHatasi(
          `${raporTuru}: ${r}. satırdaki miktar formülünün hesaplanmış sonucu yok. Dosyayı Excel’de açıp hesaplatın ve kaydedin.`,
        );
      const birlesimler = [cKod, cAd, cMiktar].map((c) => sayfa.birlesimAnahtari?.(r, c));
      // LED grup başlığı tek birleşik hücrede kod/ad/miktar boyunca yayılır. Eski sıfır katkısı korunur.
      if (typeof v === 'string' && birlesimler[0] && birlesimler.every((a) => a === birlesimler[0])) {
        kv.ekle(ad, 0);
        continue;
      }
      try {
        kv.ekle(ad, miktarDogrula(v));
      } catch {
        throw new OkumaHatasi(
          `${raporTuru}: ${r}. satırdaki miktar geçersiz veya sayı sınırını aşıyor. LED dosyasındaki miktar hücresini kontrol edin.`,
        );
      }
    } else if (!kod && !kv.dipToplamVar && v !== null && String(v).trim() !== '') {
      try {
        kv.dipToplam = miktarDogrula(v);
      } catch {
        throw new OkumaHatasi(
          `${raporTuru}: ${r}. satırdaki dip toplam miktarı geçersiz. LED dosyasını kontrol edin.`,
        );
      }
      kv.dipToplamVar = true;
    }
  }

  if (kv.satirSayisi === 0) throw new OkumaHatasi(`${raporTuru} dosyasında okunacak satır bulunamadı.`);
  kv.toplam();
  return kv;
}
