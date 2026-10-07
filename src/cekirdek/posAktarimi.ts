import { KullaniciHatasi } from './hata';
import { POS_KIMLIK, kartMetni, kartNumarasi, kartSuresiGecti, type PosKart } from './posKart';
import { posGirisBilgisi, posGirisKullanicisi, posNumarasi, posOzelSifre, type PosCari } from './posCari';

export const POS_KOKENI = 'https://denizpay.bupilic.com.tr';
export const PROGRAM_KOKENI = 'https://alibedirhan.github.io';
// Girişten sonra ödeme sayfasına geçmek için gerçekçi süre; kart yalnız yardımcının oturum belleğinde bekler.
export const AKTARIM_SURESI = 180_000;
/** Tek ödeme için yardımcıya bir kez giden veri. CVV ödeme anında yazılır, hiçbir yerde saklanmaz;
 * boş metin “CVV'yi POS'ta kendim yazacağım” demektir. */
export interface PosAktarimi {
  cariId: string;
  kartId: string;
  cariNumarasi: string;
  kullanici: string;
  sifre: string;
  numara: string;
  ay: string;
  yil: string;
  sahibi: string;
  cvv: string;
}
const AKTARIM_ANAHTARLARI = 'ay,cariId,cariNumarasi,cvv,kartId,kullanici,numara,sahibi,sifre,yil';

/** CVV/CVC 3 veya 4 rakamdır; boşsa doldurulmaz. */
export function cvvDogrula(deger: string): string {
  if (deger === '') return '';
  if (!/^\d{3,4}$/.test(deger)) throw new KullaniciHatasi('CVV 3 veya 4 rakam olmalı.');
  return deger;
}
export function aktarimiDogrula(d: unknown): PosAktarimi {
  const k = d as PosAktarimi | null;
  const hata = () => new KullaniciHatasi('Seçili cari ve kartı kontrol edin.');
  if (
    !k ||
    typeof k !== 'object' ||
    Object.keys(k).sort().join() !== AKTARIM_ANAHTARLARI ||
    !Object.values(k).every((v) => typeof v === 'string') ||
    !POS_KIMLIK.test(k.cariId) ||
    !POS_KIMLIK.test(k.kartId) ||
    !/^(0[1-9]|1[0-2])$/.test(k.ay) ||
    !/^20\d{2}$/.test(k.yil) ||
    !k.kullanici ||
    !k.sifre ||
    kartSuresiGecti(k)
  )
    throw hata();
  return {
    ...k,
    cariNumarasi: posNumarasi(k.cariNumarasi),
    kullanici: posGirisKullanicisi(k.kullanici),
    sifre: posOzelSifre(k.sifre),
    numara: kartNumarasi(k.numara),
    sahibi: kartMetni(k.sahibi, 0, 120),
    cvv: cvvDogrula(k.cvv),
  };
}
export function kartAktarimi(cari: PosCari, kart: PosKart, cvv = ''): PosAktarimi {
  if (kart.cariId !== cari.id) throw new KullaniciHatasi('Kart seçilen cariye ait değil.');
  const giris = posGirisBilgisi(cari);
  return aktarimiDogrula({
    cariId: cari.id,
    kartId: kart.id,
    cariNumarasi: giris.vergiNo,
    kullanici: giris.kullanici,
    sifre: giris.sifre,
    numara: kart.numara,
    ay: kart.ay,
    yil: kart.yil,
    sahibi: kart.sahibi,
    cvv: cvvDogrula(cvv),
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
/** Giriş sayfası büyük/küçük harf ve oturum düşünce eklenen `?ReturnUrl=` ile de tanınır. */
export function girisSayfasi(adres: string): boolean {
  try {
    const u = new URL(adres);
    return (
      u.origin === POS_KOKENI && !u.username && !u.password && u.pathname.toLowerCase() === '/login.aspx'
    );
  } catch {
    return false;
  }
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
