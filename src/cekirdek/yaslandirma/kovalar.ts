/** Görünüm için kova sırası: kaynağın `bucket_sort_key` sözlüğüyle aynı alt dizgi listesi.
 * Hesap Python'da yapılır; bu yalnız masaüstü ekranındaki 29+ süzgeci ve renk tonu içindir. */
const SIRA = [
  'açık hesap',
  'acik hesap',
  '0-7',
  '8-14',
  '15-21',
  '22-28',
  '29-35',
  '36-42',
  '43-49',
  '50-56',
  '57-63',
  '64-70',
  '71-77',
  '77+',
  'diğer bakiye',
  'diger bakiye',
  'toplam',
  'genel toplam',
] as const;

export function kovaSirasi(ad: string): number {
  // Yerel ayarsız toLowerCase, Python `str.lower()` gibi tam Unicode küçültmedir (İ → i̇, I → i).
  const k = ad.toLowerCase();
  const i = SIRA.findIndex((s) => k.includes(s));
  return i < 0 ? 999 : i;
}
const GEC_BASI = kovaSirasi('29-35 Gün');
const KRITIK_BASI = kovaSirasi('57-63 Gün');
const GEC_SONU = kovaSirasi('77+ Gün');

/** Masaüstü: pozitif 29–56 gün uyarı, 57+ gün kritik. */
export function kovaTonu(ad: string, tutar: number): 'kritik' | 'uyari' | null {
  const k = kovaSirasi(ad);
  if (tutar > 0 && k >= KRITIK_BASI && k <= GEC_SONU) return 'kritik';
  if (tutar > 0 && k >= GEC_BASI && k < KRITIK_BASI) return 'uyari';
  return null;
}
/** Masaüstü “Sadece 29+ gün bakiyesi olan araçlar” süzgeci. */
export function gecikmisBakiyeVar(kovalar: Record<string, number>): boolean {
  return Object.entries(kovalar).some(([ad, tutar]) => {
    const k = kovaSirasi(ad);
    return tutar > 0 && k >= GEC_BASI && k <= GEC_SONU;
  });
}
