import { KullaniciHatasi } from '../hata';
import {
  bosAtamaKaydi,
  type AtamaDurumu,
  type AtamaGirdisi,
  type AtamaKaydi,
  type YaslandirmaSonucu,
} from './turler';

export { excelGirdisiniDogrula } from '../karlilik/dogrulama';
const nesne = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Kaynak VersionedJsonStore sınırı. İç şema Python'da kaynak `_parse_payload` ile ayrıca doğrulanır. */
export const ATAMA_KAYIT_SINIRI = 512 * 1024;

export function atamaKaydiniDogrula(v: unknown): AtamaKaydi {
  if (v === undefined) return bosAtamaKaydi();
  const hata = (): never => {
    throw new KullaniciHatasi('Araç atama kaydı okunamadı. Önceki kayıt korunuyor.');
  };
  if (
    !nesne(v) ||
    Object.keys(v).sort().join() !== 'guncel,nesil,surum,yedek' ||
    v.surum !== 1 ||
    typeof v.nesil !== 'number' ||
    !Number.isSafeInteger(v.nesil) ||
    v.nesil < 0 ||
    v.nesil >= Number.MAX_SAFE_INTEGER
  )
    return hata();
  for (const f of ['guncel', 'yedek'] as const) {
    const d = v[f];
    if (d === null) continue;
    if (typeof d !== 'string' || new TextEncoder().encode(d).length > ATAMA_KAYIT_SINIRI) return hata();
    try {
      if (!nesne(JSON.parse(d) as unknown)) return hata();
    } catch {
      return hata();
    }
  }
  return v as unknown as AtamaKaydi;
}

export function atamaGirdisiniDogrula(a: AtamaGirdisi): AtamaGirdisi {
  const alanlar = ['arac_no', 'sorumlu', 'email', 'telefon', 'departman', 'notlar'] as const;
  if (
    Object.keys(a).sort().join() !== [...alanlar].sort().join() ||
    alanlar.some((k) => typeof a[k] !== 'string' || a[k].length > 200)
  )
    throw new KullaniciHatasi('Atama alanları en fazla 200 karakter olabilir.');
  if (!a.arac_no.trim() || !a.sorumlu.trim()) throw new KullaniciHatasi('Araç no ve sorumlu zorunludur.');
  return a;
}

/** Python yanıtı derin denetlenir: sonlu sayılar, sınırlı metin, tutarlı toplamlar. */
export function sonucuDogrula(v: unknown): YaslandirmaSonucu {
  const hata = (): never => {
    throw new KullaniciHatasi('Yaşlandırma sonucu doğrulanamadı. Yeniden analiz edin.');
  };
  const kontrol = (d: unknown, derinlik = 0): void => {
    if (
      derinlik > 8 ||
      (typeof d === 'number' && !Number.isFinite(d)) ||
      (typeof d === 'string' && d.length > 1024)
    )
      hata();
    if (Array.isArray(d)) d.forEach((x) => kontrol(x, derinlik + 1));
    else if (nesne(d)) Object.values(d).forEach((x) => kontrol(x, derinlik + 1));
  };
  if (!nesne(v) || !nesne(v.ozet) || !nesne(v.raporlar)) return hata();
  kontrol(v);
  const o = v.ozet,
    r = v.raporlar;
  if (
    !Array.isArray(o.vehicles) ||
    o.vehicles.length > 1_000 ||
    o.vehicle_count !== o.vehicles.length ||
    !Array.isArray(r.detaylar) ||
    !Array.isArray(r.siralama) ||
    !Array.isArray(r.kovalar) ||
    r.detaylar.length !== o.vehicles.length ||
    r.siralama.length !== o.vehicles.length ||
    ['total_customers', 'total_balance', 'total_open_account'].some((k) => typeof o[k] !== 'number')
  )
    return hata();
  const araclar = new Set<string>();
  for (const a of o.vehicles as unknown[]) {
    if (
      !nesne(a) ||
      typeof a.arac_no !== 'string' ||
      !a.arac_no ||
      araclar.has(a.arac_no) ||
      !nesne(a.yaslanding_analizi) ||
      !Array.isArray(a.musteri_detaylari) ||
      a.musteri_sayisi !== a.musteri_detaylari.length ||
      typeof a.toplam_bakiye !== 'number' ||
      typeof a.acik_hesap !== 'number'
    )
      return hata();
    araclar.add(a.arac_no);
    for (const m of a.musteri_detaylari as unknown[])
      if (!nesne(m) || typeof m.cari_unvan !== 'string' || typeof m.toplam_bakiye !== 'number') hata();
  }
  for (const k of r.kovalar as unknown[])
    if (!Array.isArray(k) || k.length !== 2 || typeof k[0] !== 'string' || typeof k[1] !== 'number') hata();
  return v as unknown as YaslandirmaSonucu;
}

export function atamaDurumunuDogrula(v: Record<string, unknown>): AtamaDurumu {
  const hata = (): never => {
    throw new KullaniciHatasi('Araç atama yanıtı doğrulanamadı. Yeniden deneyin.');
  };
  if (
    !Array.isArray(v.liste) ||
    v.liste.length > 500 ||
    !nesne(v.isYuku) ||
    typeof v.geriAlinabilir !== 'boolean' ||
    !(v.geriAlindi === null || typeof v.geriAlindi === 'boolean') ||
    !nesne(v.kayit)
  )
    return hata();
  for (const a of v.liste as unknown[])
    if (
      !nesne(a) ||
      ['arac_no', 'sorumlu', 'email', 'telefon', 'departman', 'notlar', 'atama_tarihi'].some(
        (k) => typeof a[k] !== 'string' || (a[k] as string).length > 200,
      )
    )
      hata();
  if (Object.values(v.isYuku).some((n) => !Number.isSafeInteger(n))) hata();
  atamaKaydiniDogrula({ surum: 1, nesil: 0, ...v.kayit });
  return v as unknown as AtamaDurumu;
}
