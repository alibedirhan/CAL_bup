import { OkumaHatasi } from './kitap';

/** ZIP merkez dizinini açmadan kontrol eder; aşırı genişleyen arşivleri reddeder. */
export function arsiviDenetle(veri: ArrayBuffer | Uint8Array): void {
  const b = veri instanceof Uint8Array ? veri : new Uint8Array(veri);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const reddet = () => {
    throw new OkumaHatasi('Excel dosyası bozuk ya da desteklenen boyut sınırlarını aşıyor.');
  };
  if (b.length < 22 || v.getUint32(0, true) !== 0x04034b50) reddet();
  let son = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50 && i + 22 + v.getUint16(i + 20, true) === b.length) {
      son = i;
      break;
    }
  }
  if (son < 0) return reddet();
  const adet = v.getUint16(son + 10, true);
  const bas = v.getUint32(son + 16, true);
  const uzunluk = v.getUint32(son + 12, true);
  if (
    v.getUint16(son + 4, true) ||
    v.getUint16(son + 6, true) ||
    adet !== v.getUint16(son + 8, true) ||
    adet > 5000 ||
    adet === 0 ||
    bas + uzunluk !== son
  )
    reddet();
  let p = bas;
  let toplam = 0;
  const adlar = new Set<string>();
  const bolumler: { bas: number; son: number }[] = [];
  for (let i = 0; i < adet; i++) {
    if (p + 46 > son || v.getUint32(p, true) !== 0x02014b50) return reddet();
    const acik = v.getUint32(p + 24, true);
    const sikisik = v.getUint32(p + 20, true);
    const yontem = v.getUint16(p + 10, true);
    const yerel = v.getUint32(p + 42, true);
    const adUzunlugu = v.getUint16(p + 28, true);
    if (p + 46 + adUzunlugu > son || adUzunlugu === 0 || ![0, 8].includes(yontem)) return reddet();
    const ad = Array.from(b.subarray(p + 46, p + 46 + adUzunlugu)).join(',');
    if (adlar.has(ad)) return reddet();
    adlar.add(ad);
    if (
      yerel + 30 > bas ||
      v.getUint32(yerel, true) !== 0x04034b50 ||
      v.getUint16(yerel + 8, true) !== yontem ||
      v.getUint16(yerel + 6, true) !== v.getUint16(p + 8, true) ||
      v.getUint16(yerel + 26, true) !== adUzunlugu
    )
      return reddet();
    const veriBasi = yerel + 30 + adUzunlugu + v.getUint16(yerel + 28, true);
    if (
      veriBasi + sikisik > bas ||
      !b.subarray(yerel + 30, yerel + 30 + adUzunlugu).every((h, j) => h === b[p + 46 + j])
    )
      return reddet();
    bolumler.push({ bas: yerel, son: veriBasi + sikisik });
    toplam += acik;
    if (v.getUint16(p + 8, true) & 0x41 || acik > 50 * 1024 * 1024 || toplam > 100 * 1024 * 1024) reddet();
    p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    if (p > son) reddet();
  }
  if (p !== son) reddet();
  bolumler.sort((a, b) => a.bas - b.bas);
  if (bolumler.some((a, i) => i > 0 && a.bas < (bolumler[i - 1]?.son ?? 0))) reddet();
}
