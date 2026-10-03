// Kullanıcının değiştirdiği ayarlar bu tarayıcıda saklanır; varsayılanların üzerine yazılır.

import { VARSAYILAN_AYARLAR, type Ayarlar } from '../cekirdek/ayarlar';
import { oku, yaz } from './saklama';
import { ayarGecerli } from '../cekirdek/ayarDenetimi';
import { KullaniciHatasi } from '../cekirdek/hata';

const ANAHTAR = 'ayarlar';

type Duz = Record<string, unknown>;

function birlestir<T>(varsayilan: T, kayitli: unknown): T {
  if (typeof varsayilan !== 'object' || varsayilan === null) {
    return typeof kayitli === typeof varsayilan && (typeof kayitli !== 'number' || Number.isFinite(kayitli))
      ? (kayitli as T)
      : varsayilan;
  }
  const sonuc: Duz = { ...(varsayilan as Duz) };
  const k = (typeof kayitli === 'object' && kayitli !== null ? kayitli : {}) as Duz;
  for (const anahtar of Object.keys(sonuc)) sonuc[anahtar] = birlestir(sonuc[anahtar], k[anahtar]);
  return sonuc as T;
}

/** Kayıtlı ayarlar; bozuk ya da eksik alanlar varsayılanla tamamlanır. */
export function ayarlariOku(): Ayarlar {
  try {
    const metin = oku(ANAHTAR) ?? '{}';
    if (metin.length > 32768) return structuredClone(VARSAYILAN_AYARLAR);
    const a = birlestir(VARSAYILAN_AYARLAR, JSON.parse(metin));
    return ayarGecerli(a) ? a : structuredClone(VARSAYILAN_AYARLAR);
  } catch {
    return VARSAYILAN_AYARLAR;
  }
}

export function ayarlariYaz(a: Ayarlar): boolean {
  if (!ayarGecerli(a))
    throw new KullaniciHatasi('Ayar değeri geçersiz. Satır, sütun ve tolerans sınırlarını kontrol edin.');
  return yaz(ANAHTAR, JSON.stringify(a));
}

export { birlestir as ayarBirlestir };
