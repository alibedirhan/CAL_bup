/** POS yardımcısının site geneli alan kurulumu. Bir kez tanıtılır, bütün cariler ve POS sayfa adresleri
 * için geçerlidir. Kart, cari veya firma değeri içermez; yalnız kutuyu yeniden bulmaya yarayan seçiciler. */

export type AlanRolu = 'firma' | 'numara' | 'tarih' | 'ay' | 'yil' | 'ad' | 'cvv';
export const KART_ROLLERI = ['numara', 'tarih', 'ay', 'yil', 'ad', 'cvv'] as const;
export type KartRolu = (typeof KART_ROLLERI)[number];

export interface AlanTanimi {
  /** Önce denenen seçici: kalıcı kimlik, `name` veya son çare olarak sayfadaki sıra. */
  secici: string;
  etiket: string;
  tur: string;
  /** Kullanıcı, adı/yazısı tanınmayan kutuyu bu rol için açıkça onayladı. Engelli alan kuralı yine geçerlidir. */
  elle?: true;
  /** Kutunun `name` adı; seçici kayarsa ikinci yol. */
  ad?: string;
  /** Kutunun rakamsız, küçük harfli başlığı (“kredi karti numarasi”); üçüncü yol. */
  baslik?: string;
}

export interface PosKurulumu {
  surum: 2;
  alanlar: Partial<Record<AlanRolu, AlanTanimi>>;
}

const ROLLER: readonly AlanRolu[] = ['firma', ...KART_ROLLERI];
const ANAHTARLAR = ['ad', 'baslik', 'elle', 'etiket', 'secici', 'tur'];
const YAZI_OGESI = /^(SPAN|DIV|P|TD|DD|B|STRONG|LABEL|H[1-6])$/;

function tanimDogrula(r: AlanRolu, f: unknown, seciciler: Set<string>): AlanTanimi {
  const t = f as AlanTanimi | null;
  const hata = () => new Error('Alan seçimi uygun değil.');
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw hata();
  const anahtarlar = Object.keys(t);
  if (
    !['etiket', 'secici', 'tur'].every((a) => anahtarlar.includes(a)) ||
    anahtarlar.some((a) => !ANAHTARLAR.includes(a)) ||
    typeof t.secici !== 'string' ||
    !t.secici ||
    t.secici.length > 300 ||
    /\d{6}/.test(t.secici) ||
    seciciler.has(t.secici) ||
    typeof t.etiket !== 'string' ||
    typeof t.tur !== 'string' ||
    ('elle' in t && (t.elle !== true || r === 'firma')) ||
    ('ad' in t && (typeof t.ad !== 'string' || !t.ad || t.ad.length > 120 || /\d{6}/.test(t.ad))) ||
    ('baslik' in t &&
      (typeof t.baslik !== 'string' || !t.baslik || t.baslik.length > 60 || /\d/.test(t.baslik)))
  )
    throw hata();
  const kutu = r === 'cvv' || r === 'ad' ? ['INPUT'] : ['INPUT', 'SELECT'];
  const turler = r === 'cvv' ? ['text', 'tel', 'number', 'password'] : ['', 'text', 'tel', 'number'];
  if (r === 'firma' ? !YAZI_OGESI.test(t.etiket) || t.tur !== '' : !kutu.includes(t.etiket)) throw hata();
  if (r !== 'firma' && !turler.includes(t.tur)) throw hata();
  if ((r === 'numara' || r === 'tarih' || r === 'ad') && !['text', 'tel', ''].includes(t.tur)) throw hata();
  seciciler.add(t.secici);
  return { ...t };
}

/** Kaydedilen veya iletilen kurulumun tek doğrulayıcısı. Fazla alan, değer veya eksik rol reddedilir. */
export function kurulumDogrula(d: unknown): PosKurulumu {
  const k = d as PosKurulumu | null;
  if (
    !k ||
    typeof k !== 'object' ||
    Object.keys(k).sort().join() !== 'alanlar,surum' ||
    k.surum !== 2 ||
    !k.alanlar ||
    typeof k.alanlar !== 'object' ||
    Array.isArray(k.alanlar)
  )
    throw new Error('Alan kurulumu uygun değil.');
  const a = k.alanlar;
  const roller = Object.keys(a) as AlanRolu[];
  if (roller.some((r) => !ROLLER.includes(r)) || !a.numara || (a.tarih ? a.ay || a.yil : !a.ay || !a.yil))
    throw new Error('Alan seçimi eksik.');
  const seciciler = new Set<string>();
  const alanlar: PosKurulumu['alanlar'] = {};
  for (const r of ROLLER) if (a[r]) alanlar[r] = tanimDogrula(r, a[r], seciciler);
  return { surum: 2, alanlar };
}

/** 1.6–1.15 yardımcısı kurulumu sayfa adresine bağlı `{ sayfa, alanlar }` kayıtları olarak tutuyordu.
 * Geçerli ilk kayıt site geneli kuruluma dönüştürülür; giriş sayfası kaydı alınmaz. */
export function eskiKurulumuDonustur(d: unknown): PosKurulumu | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  for (const kayit of Object.values(d as Record<string, unknown>)) {
    const k = kayit as { sayfa?: unknown; alanlar?: unknown } | null;
    if (!k || typeof k.sayfa !== 'string' || /\/login\.aspx$/i.test(k.sayfa)) continue;
    try {
      return kurulumDogrula({ surum: 2, alanlar: k.alanlar });
    } catch {
      /* Sonraki kayıt denenir. */
    }
  }
  return null;
}

/** Program ekranının bilmesi gereken özet: hangi isteğe bağlı kutular tanıtıldı. */
export function kurulumOzeti(k: PosKurulumu | null | undefined): { ad: boolean; cvv: boolean } {
  return { ad: Boolean(k?.alanlar.ad), cvv: Boolean(k?.alanlar.cvv) };
}
