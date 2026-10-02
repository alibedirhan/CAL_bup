import { sutunNo, type Ayarlar } from './ayarlar';

/** Yerel ve Drive ayarları aynı sınırlarla doğrulanır. */
export function ayarGecerli(a: Ayarlar): boolean {
  const metin = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 256;
  const satir = (v: unknown, en = 1) =>
    typeof v === 'number' && Number.isInteger(v) && v >= en && v <= 100_000;
  try {
    return (
      typeof a.pazarAtla === 'boolean' &&
      typeof a.sifirEksikleriEkle === 'boolean' &&
      Number.isFinite(a.tolerans) &&
      a.tolerans >= 0 &&
      a.tolerans <= 1000 &&
      satir(a.hedefIlkSatir, 4) &&
      [
        a.hedefKontrolBaslik,
        a.donukOnek,
        a.etiketBaslangicTarihi,
        a.etiketBitisTarihi,
        a.d01.tanim,
        a.sayim.sayfaAdi,
        a.subeAlis.tanim,
      ].every(metin) &&
      [a.d01, a.sayim, a.subeAlis].every(
        (d) =>
          satir(d.ilkVeriSatiri) &&
          [d.kodSutunu, d.isimSutunu, d.miktarSutunu].every(
            (s) => typeof s === 'string' && s.length <= 3 && sutunNo(s) <= 256,
          ) &&
          new Set([d.kodSutunu, d.isimSutunu, d.miktarSutunu].map(sutunNo)).size === 3,
      )
    );
  } catch {
    return false;
  }
}
