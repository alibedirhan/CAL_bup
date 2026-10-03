import { KullaniciHatasi } from '../cekirdek/hata';
import * as idb from './idb';

export const POS_CIHAZ_ONEKI = 'sanal-pos-cihaz-';

export async function yeniPosCihazAnahtari(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
}

export async function posCihazAnahtariOku(cihaz: string): Promise<CryptoKey> {
  let anahtar: CryptoKey | undefined;
  try {
    anahtar = await idb.okuKesin<CryptoKey>(POS_CIHAZ_ONEKI + cihaz);
  } catch {
    throw new KullaniciHatasi('Bu bilgisayarın kasa anahtarı okunamadı. Yeniden deneyin.');
  }
  if (
    !anahtar ||
    anahtar.type !== 'secret' ||
    anahtar.algorithm.name !== 'HMAC' ||
    anahtar.extractable ||
    !anahtar.usages.includes('sign')
  ) {
    throw new KullaniciHatasi(
      'Bu tarayıcının kasa anahtarı bulunamadı. Taşınabilir şifreli yedeğinizden carileri geri ekleyin.',
    );
  }
  return anahtar;
}
