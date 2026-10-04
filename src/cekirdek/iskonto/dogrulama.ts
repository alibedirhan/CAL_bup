import { KullaniciHatasi } from '../hata';
import {
  ISKONTO_KATEGORILERI,
  type IskontoOranlari,
  type IskontoBelgesi,
  type IskontoOnizlemesi,
} from './turler';

function hata(): never {
  throw new KullaniciHatasi('İskonto verisi doğrulanamadı. Dosyaları yeniden yükleyin.');
}
function nesne(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return hata();
  return v as Record<string, unknown>;
}
function metin(v: unknown, sinir = 4096): string {
  if (typeof v !== 'string' || [...v].length > sinir) return hata();
  return v;
}
function sayi(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return hata();
  return v;
}
function kategori(v: unknown) {
  if (!ISKONTO_KATEGORILERI.includes(v as never)) return hata();
  return v;
}

export function iskontoOranlariniDogrula(oranlar: IskontoOranlari): void {
  for (const k of ISKONTO_KATEGORILERI) {
    const v = oranlar[k];
    if (!Number.isFinite(v) || v < 0 || v > 100)
      throw new KullaniciHatasi(`${k} için iskonto 0–100 arasında olmalı.`);
  }
}

export function pdfGirdisiniDogrula(ad: string, boyut: number, bayt?: Uint8Array): void {
  if (!/\.pdf$/i.test(ad) || !ad || ad.length > 200 || /[/\\\0]/.test(ad))
    throw new KullaniciHatasi('Yalnızca .pdf fiyat listeleri kullanılabilir.');
  if (!Number.isSafeInteger(boyut) || boyut <= 0 || boyut > 25 * 1024 * 1024)
    throw new KullaniciHatasi('Her PDF dosyası dolu ve en fazla 25 MB olmalıdır.');
  if (bayt && (bayt.length !== boyut || ![37, 80, 68, 70, 45].every((b, i) => bayt[i] === b)))
    throw new KullaniciHatasi('Dosyanın içeriği geçerli bir PDF değil.');
}

export function belgeleriDogrula(v: unknown): IskontoBelgesi[] {
  if (!Array.isArray(v) || v.length > 3) return hata();
  let toplam = 0;
  for (const ham of v) {
    const d = nesne(ham);
    pdfGirdisiniDogrula(metin(d.ad, 200), 1);
    if (!['normal', 'gramaj', 'dondurulmus'].includes(metin(d.tip))) return hata();
    const kategoriler = nesne(d.kategoriler);
    if (Object.keys(kategoriler).length !== 6) return hata();
    for (const k of ISKONTO_KATEGORILERI) {
      const urunler = kategoriler[k];
      if (!Array.isArray(urunler) || urunler.length > 25_000) return hata();
      toplam += urunler.length;
      if (toplam > 100_000) return hata();
      for (const hamUrun of urunler) {
        const u = nesne(hamUrun);
        metin(u.code);
        metin(u.name);
        kategori(u.category);
        if (u.category !== k) return hata();
        for (const n of [u.price_without_vat, u.price_with_vat])
          if (sayi(n) < 0 || sayi(n) > 2000) return hata();
      }
    }
  }
  return v as IskontoBelgesi[];
}

export function onizlemeyiDogrula(v: unknown): IskontoOnizlemesi {
  const o = nesne(v),
    i = nesne(o.istatistik);
  metin(o.metin, 100_000);
  if (!Array.isArray(o.satirlar) || o.satirlar.length > 100_000) return hata();
  for (const anahtar of ['pdf_count', 'product_count', 'category_count']) {
    const n = sayi(i[anahtar]);
    if (!Number.isSafeInteger(n) || n < 0 || n > 100_000) return hata();
  }
  sayi(i.average_discount);
  sayi(i.total_discount);
  if (i.product_count !== o.satirlar.length) return hata();
  for (const ham of o.satirlar) {
    const s = nesne(ham),
      ref = nesne(s.ref);
    metin(ref.source, 200);
    kategori(ref.category);
    if (!Number.isSafeInteger(ref.product_index) || sayi(ref.product_index) < 0) return hata();
    if (
      !Array.isArray(s.degerler) ||
      s.degerler.length !== 6 ||
      !Array.isArray(s.para) ||
      s.para.length !== 3
    )
      return hata();
    metin(s.degerler[0]);
    kategori(s.degerler[1]);
    metin(s.degerler[2]);
    for (const p of s.degerler.slice(3)) sayi(p);
    for (const p of s.para) metin(p, 100);
  }
  return v as IskontoOnizlemesi;
}
