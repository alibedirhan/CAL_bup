import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import referans from '../yardimci/veriler/pythonMetinReferansi.json';
import { harfKatla, musteriAnahtari } from '../../src/cekirdek/musteriTakip/metin';

it('bütün Unicode kod noktaları kaynak Python upper/casefold başvurusuyla eşleşir', () => {
  const upper = createHash('sha256');
  const fold = createHash('sha256');
  for (let i = 0; i < 0x110000; i++) {
    if (i >= 0xd800 && i <= 0xdfff) continue;
    const h = String.fromCodePoint(i);
    upper.update(musteriAnahtari(h, false) + '\0');
    fold.update(harfKatla(h) + '\0');
  }
  expect(upper.digest('hex')).toBe(referans.upper);
  expect(fold.digest('hex')).toBe(referans.fold);
}, 20_000);
