import katlama from './harfKatlama.json';
// Python str.strip: JS trim U+0085'i bırakır, U+FEFF'i ise siler. İç metin değişmez.
const BOSLUKLAR = new Set([0x85, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000]);

function bosluk(no: number): boolean {
  return (
    (no >= 9 && no <= 13) || (no >= 28 && no <= 32) || (no >= 0x2000 && no <= 0x200a) || BOSLUKLAR.has(no)
  );
}

export function kenarlariTemizle(metin: string): string {
  let ilk = 0;
  let son = metin.length;
  while (ilk < son && bosluk(metin.charCodeAt(ilk))) ilk++;
  while (son > ilk && bosluk(metin.charCodeAt(son - 1))) son--;
  return metin.slice(ilk, son);
}

export function karakterSayisi(metin: string): number {
  return [...metin].length;
}

export function metniKisalt(metin: string, sinir: number): string {
  return [...metin].slice(0, sinir).join('');
}

/** Kaynak Python upper davranışı; Türkçe yerel dönüşüm/aksan sadeleştirme yapılmaz. */
export function musteriAnahtari(metin: string, harfDuyarli: boolean): string {
  return harfDuyarli ? metin : metin.toUpperCase();
}

/** Python casefold'un lower'dan ayrıldığı Unicode karakterleri sabit başvurudur. */
export function harfKatla(metin: string): string {
  const eslesmeler: Readonly<Record<string, string>> = katlama;
  return [...metin].map((h) => eslesmeler[h] ?? h.toLowerCase()).join('');
}
