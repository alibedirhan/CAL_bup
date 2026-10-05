import { KullaniciHatasi } from './hata';
import { POS_KIMLIK, kartNumarasi, kartSuresiGecti, type PosKart } from './posKart';
import { posNumarasi, type PosCari } from './posCari';

export const POS_KOKENI = 'https://denizpay.bupilic.com.tr';
export const PROGRAM_KOKENI = 'https://alibedirhan.github.io';
// Girişten sonra ödeme sayfasına geçmek için gerçekçi süre; kart yalnız yardımcının oturum belleğinde bekler.
export const AKTARIM_SURESI = 180_000;
export interface PosAktarimi {
  cariId: string;
  kartId: string;
  cariNumarasi: string;
  numara: string;
  ay: string;
  yil: string;
}
export function aktarimiDogrula(d: unknown): PosAktarimi {
  const k = d as PosAktarimi | null;
  if (
    !k ||
    Object.keys(k).sort().join() !== 'ay,cariId,cariNumarasi,kartId,numara,yil' ||
    !Object.values(k).every((v) => typeof v === 'string') ||
    !POS_KIMLIK.test(k.cariId) ||
    !POS_KIMLIK.test(k.kartId) ||
    !/^(0[1-9]|1[0-2])$/.test(k.ay) ||
    !/^20\d{2}$/.test(k.yil) ||
    kartSuresiGecti(k)
  )
    throw new KullaniciHatasi('Seçili cari ve kartı kontrol edin.');
  return { ...k, cariNumarasi: posNumarasi(k.cariNumarasi), numara: kartNumarasi(k.numara) };
}
export function kartAktarimi(cari: PosCari, kart: PosKart): PosAktarimi {
  if (kart.cariId !== cari.id) throw new KullaniciHatasi('Kart seçilen cariye ait değil.');
  return aktarimiDogrula({
    cariId: cari.id,
    kartId: kart.id,
    cariNumarasi: cari.numara,
    numara: kart.numara,
    ay: kart.ay,
    yil: kart.yil,
  });
}
export function programAdresi(adres: string): boolean {
  try {
    const u = new URL(adres);
    return u.origin === PROGRAM_KOKENI && !u.username && !u.password && u.pathname.startsWith('/CAL_bup/');
  } catch {
    return false;
  }
}
export function posSayfasi(adres: string): string {
  const u = new URL(adres);
  if (u.origin !== POS_KOKENI || u.username || u.password) throw new Error('POS adresi uygun değil.');
  return u.origin + u.pathname;
}
export type AlanRolu = 'firma' | 'numara' | 'tarih' | 'ay' | 'yil';
export interface AlanTanimi {
  secici: string;
  etiket: string;
  tur: string;
  /** Kullanıcı, adı/yazısı tanınmayan kutuyu bu rol için açıkça onayladı. Engelli alan kuralı yine geçerlidir. */
  elle?: true;
}
export interface PosAlanlari {
  sayfa: string;
  alanlar: Partial<Record<AlanRolu, AlanTanimi>>;
}
export function alanlariDogrula(d: unknown): PosAlanlari {
  const a = d as PosAlanlari | null;
  if (
    !a ||
    Object.keys(a).sort().join() !== 'alanlar,sayfa' ||
    posSayfasi(a.sayfa) !== a.sayfa ||
    new URL(a.sayfa).pathname.toLowerCase() === '/login.aspx'
  )
    throw new Error('Ödeme sayfasını tanıtın.');
  const roller = Object.keys(a.alanlar);
  if (
    !a.alanlar.firma ||
    !a.alanlar.numara ||
    (a.alanlar.tarih ? a.alanlar.ay || a.alanlar.yil : !a.alanlar.ay || !a.alanlar.yil) ||
    roller.some((r) => !['firma', 'numara', 'tarih', 'ay', 'yil'].includes(r))
  )
    throw new Error('Alan seçimi eksik.');
  const seciciler = new Set<string>();
  for (const [r, f] of Object.entries(a.alanlar)) {
    if (
      !f ||
      !['etiket,secici,tur', 'elle,etiket,secici,tur'].includes(Object.keys(f).sort().join()) ||
      ('elle' in f && (f.elle !== true || r === 'firma')) ||
      typeof f.secici !== 'string' ||
      !f.secici ||
      f.secici.length > 300 ||
      /\d{6}/.test(f.secici) ||
      seciciler.has(f.secici) ||
      !/^(INPUT|SELECT|SPAN|DIV|P|TD|DD|B|STRONG)$/.test(f.etiket) ||
      !['', 'text', 'tel', 'number'].includes(f.tur) ||
      (r !== 'firma' && !['INPUT', 'SELECT'].includes(f.etiket))
    )
      throw new Error('Alan seçimi uygun değil.');
    seciciler.add(f.secici);
  }
  return a;
}

/** Sağlayıcının giriş hata yazısı kullanıcıya aktarılırken kısaltılır; 4+ rakam dizisi maskelenir. */
export function girisMesajiTemizle(d: unknown): string {
  if (typeof d !== 'string') return '';
  return d
    .slice(0, 1000)
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\d{4,}/g, '•••')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
