import type { TabloDuzeni } from '../cekirdek/ayarlar';
import { sutunNo } from '../cekirdek/ayarlar';
import { KaynakVeri } from '../cekirdek/kaynakVeri';
import { adNormal } from '../cekirdek/metin';
import { sayiCevir } from '../cekirdek/sayi';
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
    if (sayfa.hucre(r, cMiktar) !== null) {
      son = r;
      break;
    }
  }

  for (let r = duzen.ilkVeriSatiri; r <= son; r++) {
    const ad = adNormal(sayfa.hucre(r, cAd));
    const kod = adNormal(sayfa.hucre(r, cKod));
    const v = sayfa.hucre(r, cMiktar);
    if (ad) {
      kv.ekle(ad, sayiCevir(v));
    } else if (!kod && !kv.dipToplamVar && v !== null && String(v).trim() !== '') {
      kv.dipToplam = sayiCevir(v);
      kv.dipToplamVar = true;
    }
  }

  if (kv.satirSayisi === 0) throw new OkumaHatasi(`${raporTuru} dosyasında okunacak satır bulunamadı.`);
  return kv;
}
