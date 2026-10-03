import { KullaniciHatasi } from './hata';

export const KASA_PAROLA_EN_AZ = 14;
export const KASA_PAROLA_EN_FAZLA = 128;

/** Kısa PIN yalnızca cihaz anahtarıyla korunan v2 kasada kullanılabilir. */
export function kasaAcilisBilgisiDogrula(parola: string): void {
  if (/^\d{4,12}$/.test(parola)) return;
  if (!parola || (/^\d+$/.test(parola) && parola.length < KASA_PAROLA_EN_AZ))
    throw new KullaniciHatasi('4–12 rakamlık PIN veya en az 14 karakterlik uzun kasa parolanızı yazın.');
  kasaParolasiDogrula(parola);
}

/** Mevcut v1 kasaların parola baytları korunur; parola sessizce kırpılmaz. */
export function kasaParolasiDogrula(parola: string): void {
  if (!parola) throw new KullaniciHatasi('Kasa parolasını yazın.');
  if (parola.trim().length < KASA_PAROLA_EN_AZ || parola.length > KASA_PAROLA_EN_FAZLA) {
    throw new KullaniciHatasi(
      'Kasa parolası en az 14, en fazla 128 karakter olmalı. Birkaç kelimeden oluşan, size özel uzun bir parola kullanabilirsiniz.',
    );
  }
}

export function yeniKasaParolasiDogrula(parola: string, tekrar: string, sadeceUzun = false): void {
  if (sadeceUzun) kasaParolasiDogrula(parola);
  else kasaAcilisBilgisiDogrula(parola);
  if (parola !== parola.trim())
    throw new KullaniciHatasi('Yeni kasa parolasının başında veya sonunda boşluk olmasın.');
  if (!tekrar) throw new KullaniciHatasi('Aynı kasa parolasını tekrar alanına da yazın.');
  if (parola !== tekrar) throw new KullaniciHatasi('İki kasa parolası aynı olmalı. Yazımı kontrol edin.');
}
