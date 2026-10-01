import { describe, expect, it } from 'vitest';
import { RAPORLAR, raporBul } from '../../src/raporlar/kayit';

describe('rapor kaydı', () => {
  it('rapor kimlikleri tekil ve adrese uygun', () => {
    const idler = RAPORLAR.map((r) => r.id);
    expect(new Set(idler).size).toBe(idler.length);
    for (const id of idler) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('günlük depo kontrol üç LED dosyası okur', () => {
    expect(raporBul('depo-kontrol')?.kaynaklar).toHaveLength(3);
  });
});
