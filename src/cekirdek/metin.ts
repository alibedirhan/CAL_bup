// Ürün adlarının karşılaştırılması.

/** Fazla boşluk, sekme, satır sonu ve bölünmez boşluğu temizler. */
export function adNormal(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/[\u00a0\t\r\n]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * Büyük/küçük harf duyarsız eşleştirme anahtarı.
 * Bilerek yerel ayarsız büyütülür ("i" → "I"); eski araç ve Python ikizi de
 * böyle eşleştiriyordu ve LED adları zaten büyük harfle gelir.
 */
export function adAnahtari(ad: string): string {
  return ad.toUpperCase();
}

/** Listede alfabetik yer bulmak için: a, b'den sonra mı gelir? */
export function sonraGelirMi(a: string, b: string): boolean {
  return adAnahtari(a) > adAnahtari(b);
}
