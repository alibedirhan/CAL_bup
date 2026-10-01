// Sayı çevirme ve karşılaştırma. Eski aracın SayiCevir / SayiMetni / EsitMi
// işlevlerinin karşılığı; davranışları Python ikiziyle aynıdır.

/** "2.854,61" → 2854.61. Gerçek sayı olduğu gibi döner, boş ya da anlaşılmayan değer 0'dır. */
export function sayiCevir(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v !== 'string') return 0;
  const s = v
    .replace(/[\u00a0 ]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  // VBA Val() gibi: baştaki sayıyı alır, gerisini yok sayar.
  const m = /^[+-]?\d*\.?\d*/.exec(s);
  const n = m ? Number.parseFloat(m[0]) : Number.NaN;
  return Number.isNaN(n) ? 0 : n;
}

/**
 * 3 haneye yuvarlar; Python round(x, 3) ile birebir aynı sonucu verir.
 * toFixed sayının ikili gösterimdeki gerçek değerine göre yuvarlar (0,0075 aslında
 * 0,00749999… olduğu için 0,007 olur). Binde birin tam yarısı ikili sistemde
 * gösterilemediğinden eşitlik durumu hiç oluşmaz.
 */
export function yuvarla3(x: number): number {
  return Number(x.toFixed(3)) + 0; // + 0: -0 yerine 0
}

const BICIM = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** 12345.678 → "12.345,678" */
export function sayiMetni(x: number): string {
  return BICIM.format(x);
}

/** Toleransla eşitlik (Ayarlar: Tolerans, kg). */
export function esitMi(a: number, b: number, tolerans: number): boolean {
  return Math.abs(a - b) <= tolerans + 1e-7;
}
