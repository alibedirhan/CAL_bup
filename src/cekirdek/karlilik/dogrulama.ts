import { KullaniciHatasi } from '../hata';
import { bosKarlilikKaydi, type KarlilikKaydi, type KarlilikSonucu, type SenaryoOranlari } from './turler';

function nesne(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
export function excelGirdisiniDogrula(ad: string, boyut: number, bayt?: Uint8Array) {
  if (!ad || ad.length > 200 || /[/\\\0]/.test(ad) || !/\.xlsx$/i.test(ad))
    throw new KullaniciHatasi('Geçerli bir .xlsx Excel dosyası seçin.');
  if (!Number.isSafeInteger(boyut) || boyut <= 0 || boyut > 25 * 1024 * 1024)
    throw new KullaniciHatasi('Excel dosyası boş veya 25 MB sınırını aşıyor.');
  if (bayt && (bayt.byteLength !== boyut || [80, 75, 3, 4].some((v, i) => bayt[i] !== v)))
    throw new KullaniciHatasi('Dosyanın içeriği geçerli bir Excel kitabı değil.');
}
export function senaryoOranlariniDogrula(v: SenaryoOranlari) {
  if (
    Object.keys(v).length !== 3 ||
    ['cost_change_pct', 'price_change_pct', 'quantity_change_pct'].some((k) => {
      const d = v[k as keyof SenaryoOranlari];
      return typeof d !== 'number' || !Number.isFinite(d) || d < -100 || d > 500;
    })
  )
    throw new KullaniciHatasi('Senaryo oranları −100 ile 500 arasında sonlu sayılar olmalıdır.');
}
/** Dış depo zarfı katıdır. İç JSON, Python'da kaynak şemasıyla ayrıca doğrulanır. */
export function karlilikKaydiniDogrula(v: unknown): KarlilikKaydi {
  if (v === undefined) return bosKarlilikKaydi();
  const hata = () => {
    throw new KullaniciHatasi('Kârlılık kaydı okunamadı. Önceki kayıt korunuyor.');
  };
  if (
    !nesne(v) ||
    Object.keys(v).sort().join() !== 'donemler,eslesmeler,nesil,surum' ||
    v.surum !== 1 ||
    typeof v.nesil !== 'number' ||
    !Number.isSafeInteger(v.nesil) ||
    v.nesil < 0 ||
    v.nesil >= Number.MAX_SAFE_INTEGER
  )
    return hata();
  for (const [k, cap] of [
    ['eslesmeler', 512 * 1024],
    ['donemler', 4 * 1024 * 1024],
  ] as const) {
    const o = v[k];
    if (!nesne(o) || Object.keys(o).sort().join() !== 'guncel,yedek') return hata();
    for (const f of ['guncel', 'yedek']) {
      const d = o[f];
      if (d === null) continue;
      if (typeof d !== 'string' || new TextEncoder().encode(d).length > cap) return hata();
      try {
        if (!nesne(JSON.parse(d) as unknown)) return hata();
      } catch {
        return hata();
      }
    }
    if (o.guncel === null && o.yedek !== null) return hata();
  }
  return v as unknown as KarlilikKaydi;
}
export function sonucuDogrula(v: unknown): KarlilikSonucu {
  if (
    !nesne(v) ||
    !nesne(v.ozet) ||
    !Array.isArray(v.ozet.rows) ||
    !v.ozet.rows.length ||
    v.ozet.rows.length > 100_000 ||
    v.ozet.total_count !== v.ozet.rows.length ||
    !nesne(v.genelBakis) ||
    !nesne(v.senaryo) ||
    !nesne(v.eslesme)
  )
    throw new KullaniciHatasi('Kârlılık sonucu doğrulanamadı. Yeniden analiz edin.');
  const kontrol = (d: unknown, derinlik = 0): void => {
    if (
      derinlik > 12 ||
      (typeof d === 'number' && !Number.isFinite(d)) ||
      (typeof d === 'string' && d.length > 512)
    )
      throw new KullaniciHatasi('Kârlılık sonucunda geçersiz değer var.');
    if (Array.isArray(d)) d.forEach((x) => kontrol(x, derinlik + 1));
    else if (nesne(d)) Object.values(d).forEach((x) => kontrol(x, derinlik + 1));
  };
  kontrol(v);
  for (const r of v.ozet.rows) {
    if (
      !nesne(r) ||
      typeof r.stock_name !== 'string' ||
      !r.stock_name ||
      [
        'sales_quantity',
        'average_sales_price',
        'sales_amount',
        'unit_cost',
        'unit_profit',
        'net_profit',
      ].some((k) => typeof r[k] !== 'number')
    )
      throw new KullaniciHatasi('Kârlılık satırı doğrulanamadı.');
  }
  if (
    !Array.isArray(v.senaryo.rows) ||
    v.senaryo.rows.length !== v.ozet.rows.length ||
    !Array.isArray(v.ozet.unmatched) ||
    typeof v.ozet.matched_count !== 'number' ||
    v.ozet.matched_count + v.ozet.unmatched.length !== v.ozet.total_count
  )
    throw new KullaniciHatasi('Kârlılık satır kapsamı doğrulanamadı.');
  return v as unknown as KarlilikSonucu;
}
