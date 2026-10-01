// Okunmuş ve temizlenmiş rapor verisi: ürün adı → miktar, tarih, dip toplam.
// Raporlar ile dosya okuyucuları arasındaki tek sözleşme budur
// (eski aracın clsKaynakVeri sınıfı).

import { adAnahtari } from './metin';
import type { Tarih } from './tarih';

export class KaynakVeri {
  tarih: Tarih | null = null;
  baslangicTarihi: Tarih | null = null;
  dipToplam = 0;
  dipToplamVar = false;
  satirSayisi = 0;
  /** anahtar (büyük harf) → toplam miktar; ekleme sırası korunur. */
  readonly miktarlar = new Map<string, number>();
  /** anahtar → ilk görülen yazılış */
  readonly adlar = new Map<string, string>();

  constructor(readonly raporTuru: string) {}

  ekle(ad: string, miktar: number): void {
    if (!ad) return;
    const k = adAnahtari(ad);
    this.miktarlar.set(k, (this.miktarlar.get(k) ?? 0) + miktar);
    if (!this.adlar.has(k)) this.adlar.set(k, ad);
    this.satirSayisi++;
  }

  icerir(ad: string): boolean {
    return this.miktarlar.has(adAnahtari(ad));
  }

  miktar(ad: string): number {
    return this.miktarlar.get(adAnahtari(ad)) ?? 0;
  }

  toplam(): number {
    let t = 0;
    for (const v of this.miktarlar.values()) t += v;
    return t;
  }

  /** Dosyanın kendi dip toplamı varsa o, yoksa satırların toplamı. */
  esasToplam(): number {
    return this.dipToplamVar ? this.dipToplam : this.toplam();
  }
}
