import { oku, yaz } from '../platform/saklama';

export type TemaTercihi = 'sistem' | 'acik' | 'koyu';

const ANAHTAR = 'tema';
const GECERLI: readonly TemaTercihi[] = ['sistem', 'acik', 'koyu'];

export function tercihCoz(deger: string | null): TemaTercihi {
  return GECERLI.includes(deger as TemaTercihi) ? (deger as TemaTercihi) : 'sistem';
}

/** <html data-theme> değeri. "sistem" seçiliyken öznitelik konmaz, CSS medya sorgusu karar verir. */
export function temaOzniteligi(tercih: TemaTercihi): 'light' | 'dark' | null {
  if (tercih === 'acik') return 'light';
  if (tercih === 'koyu') return 'dark';
  return null;
}

export function kayitliTercih(): TemaTercihi {
  return tercihCoz(oku(ANAHTAR));
}

export function temaUygula(tercih: TemaTercihi): void {
  const oz = temaOzniteligi(tercih);
  const kok = document.documentElement;
  if (oz) kok.setAttribute('data-theme', oz);
  else kok.removeAttribute('data-theme');
  yaz(ANAHTAR, tercih);
}
