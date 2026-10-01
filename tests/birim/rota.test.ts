import { describe, expect, it } from 'vitest';
import { ACILIS, rotaAdresi, rotaCoz } from '../../src/arayuz/rota';

describe('rotaCoz', () => {
  it('boş adreste açılış sayfasına gider', () => {
    expect(rotaCoz('')).toEqual(ACILIS);
    expect(rotaCoz('#')).toEqual(ACILIS);
    expect(rotaCoz('#/')).toEqual(ACILIS);
  });

  it('bilinen sayfaları tanır', () => {
    expect(rotaCoz('#/gecmis')).toEqual({ tur: 'gecmis' });
    expect(rotaCoz('#/ayarlar')).toEqual({ tur: 'ayarlar' });
    expect(rotaCoz('#/rapor/envanter')).toEqual({ tur: 'rapor', id: 'envanter' });
  });

  it('bilinmeyen adreste açılış sayfasına döner', () => {
    expect(rotaCoz('#/olmayan/sayfa')).toEqual(ACILIS);
    expect(rotaCoz('#/rapor')).toEqual(ACILIS);
  });

  it('adres ve çözüm birbirinin tersidir', () => {
    for (const r of [ACILIS, { tur: 'gecmis' } as const, { tur: 'ayarlar' } as const]) {
      expect(rotaCoz(rotaAdresi(r))).toEqual(r);
    }
  });
});
