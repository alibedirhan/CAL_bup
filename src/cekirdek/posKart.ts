import { KullaniciHatasi } from './hata';

export interface PosKart {
  id: string;
  cariId: string;
  ad: string;
  numara: string;
  sahibi: string;
  ay: string;
  yil: string;
  telefon: string;
  onayTarihi: string;
  /** Kullanıcı kararıyla (2026-10-08) kartla birlikte şifreli profilde saklanır; ekranda hep maskelidir.
   * Kaydedilmemişse alan hiç yoktur (eski kayıtlar ve yedekler aynen okunur). */
  cvv?: string;
}
export const EN_FAZLA_CARI_KARTI = 10;
export const POS_KIMLIK = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function kartMetni(metin: string, enAz: number, enFazla: number): string {
  const s = metin.trim().replace(/\s+/gu, ' ');
  if (s.length < enAz || s.length > enFazla || /[\p{Cc}\p{Cf}]/u.test(s))
    throw new KullaniciHatasi('Kart adı veya kart sahibinin yazımını kontrol edin.');
  return s;
}
export function kartNumarasi(deger: string): string {
  if (deger.length > 40) throw new KullaniciHatasi('Kart numarasının yazımını kontrol edin.');
  const n = deger.replace(/ /g, '');
  if (!/^[0-9]{12,19}$/.test(n))
    throw new KullaniciHatasi('Kart numarası 12–19 rakam olmalı; aralara boşluk koyabilirsiniz.');
  let toplam = 0;
  for (let i = n.length - 1, iki = false; i >= 0; i--, iki = !iki) {
    let d = Number(n[i]);
    if (iki) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    toplam += d;
  }
  if (toplam % 10 !== 0 || /^0+$/.test(n))
    throw new KullaniciHatasi('Kart numarası kontrolü geçmedi. Rakamları yeniden kontrol edin.');
  return n;
}
export function kartTelefonu(deger: string): string {
  if (!deger.trim()) return '';
  if (deger.length > 24 || !/^[+0-9 ()-]+$/.test(deger))
    throw new KullaniciHatasi('Telefonu 05xx xxx xx xx veya +90 5xx xxx xx xx biçiminde yazın.');
  let n = deger.replace(/[ ()-]/g, '');
  if (/^05[0-9]{9}$/.test(n)) n = '+90' + n.slice(1);
  else if (/^5[0-9]{9}$/.test(n)) n = '+90' + n;
  if (!/^\+905[0-9]{9}$/.test(n))
    throw new KullaniciHatasi('Türkiye cep telefonunu 05xx xxx xx xx veya +90 ile yazın.');
  return n;
}
/** Kart üzerindeki 3 veya 4 rakamlık güvenlik kodu; boş metin “kaydedilmedi” demektir. */
export function kartCvv(deger: string): string {
  if (deger === '') return '';
  if (!/^[0-9]{3,4}$/.test(deger)) throw new KullaniciHatasi('CVV 3 veya 4 rakam olmalı.');
  return deger;
}
export function kartSuresiGecti(kart: Pick<PosKart, 'ay' | 'yil'>, simdi = new Date()): boolean {
  return (
    Number(kart.yil) < simdi.getFullYear() ||
    (Number(kart.yil) === simdi.getFullYear() && Number(kart.ay) < simdi.getMonth() + 1)
  );
}
export function kartDogrula(kart: PosKart): PosKart {
  if (!POS_KIMLIK.test(kart.id) || !POS_KIMLIK.test(kart.cariId))
    throw new KullaniciHatasi('Kartın bağlı olduğu cari kaydı geçersiz.');
  if (!/^(0[1-9]|1[0-2])$/.test(kart.ay) || !/^20[0-9]{2}$/.test(kart.yil))
    throw new KullaniciHatasi('Son kullanma ayını ve dört haneli yılını kontrol edin.');
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(kart.onayTarihi) ||
    !Number.isFinite(Date.parse(kart.onayTarihi)) ||
    new Date(kart.onayTarihi).toISOString() !== kart.onayTarihi
  )
    throw new KullaniciHatasi('Kart kontrol tarihi geçersiz.');
  const { cvv, ...diger } = kart;
  const kod = kartCvv(cvv ?? '');
  return {
    ...diger,
    ad: kartMetni(kart.ad, 2, 80),
    numara: kartNumarasi(kart.numara),
    sahibi: kartMetni(kart.sahibi, 0, 120),
    telefon: kartTelefonu(kart.telefon),
    ...(kod ? { cvv: kod } : {}),
  };
}
export function kartMaskesi(kart: Pick<PosKart, 'numara'>): string {
  return `•••• •••• •••• ${kart.numara.slice(-4)}`;
}
