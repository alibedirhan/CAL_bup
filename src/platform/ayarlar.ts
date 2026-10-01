// Kullanıcının değiştirdiği ayarlar bu tarayıcıda saklanır; varsayılanların üzerine yazılır.

import { VARSAYILAN_AYARLAR, type Ayarlar } from '../cekirdek/ayarlar';
import { oku, yaz } from './saklama';

const ANAHTAR = 'ayarlar';

type Duz = Record<string, unknown>;

function birlestir<T>(varsayilan: T, kayitli: unknown): T {
  if (typeof varsayilan !== 'object' || varsayilan === null) {
    return typeof kayitli === typeof varsayilan ? (kayitli as T) : varsayilan;
  }
  const sonuc: Duz = { ...(varsayilan as Duz) };
  const k = (typeof kayitli === 'object' && kayitli !== null ? kayitli : {}) as Duz;
  for (const anahtar of Object.keys(sonuc)) sonuc[anahtar] = birlestir(sonuc[anahtar], k[anahtar]);
  return sonuc as T;
}

/** Kayıtlı ayarlar; bozuk ya da eksik alanlar varsayılanla tamamlanır. */
export function ayarlariOku(): Ayarlar {
  try {
    return birlestir(VARSAYILAN_AYARLAR, JSON.parse(oku(ANAHTAR) ?? '{}'));
  } catch {
    return VARSAYILAN_AYARLAR;
  }
}

export function ayarlariYaz(a: Ayarlar): void {
  yaz(ANAHTAR, JSON.stringify(a));
}

export { birlestir as ayarBirlestir };
