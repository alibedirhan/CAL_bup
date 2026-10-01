import { describe, expect, it } from 'vitest';
import { aralikKaydir, formulKaydir } from '../../src/hedef/formul';

describe('formulKaydir', () => {
  it('eklenen satır ve altındaki başvuruları kaydırır', () => {
    expect(formulKaydir('D212', 106)).toBe('D213');
    expect(formulKaydir('+E2+G2-H2', 106)).toBe('+E2+G2-H2');
    expect(formulKaydir('B105-D106', 106)).toBe('B105-D107');
  });

  it('aralığın içine eklenen satırda aralık genişler', () => {
    expect(formulKaydir('SUM(B4:B211)', 106)).toBe('SUM(B4:B212)');
    expect(formulKaydir('SUM(B4:B211)', 212)).toBe('SUM(B4:B211)');
  });

  it('sabit başvuruları da kaydırır', () => {
    expect(formulKaydir('$B$210*2', 106)).toBe('$B$211*2');
  });

  it('başka sayfaya başvurulara dokunmaz', () => {
    expect(formulKaydir("+'28.09'!B212", 106)).toBe("+'28.09'!B212");
    expect(formulKaydir('Sayfa1!B212+B212', 106)).toBe('Sayfa1!B212+B213');
  });

  it('metinlere ve işlev adlarına dokunmaz', () => {
    expect(formulKaydir('IF(A300="B300",LOG10(A300),0)', 106)).toBe('IF(A301="B300",LOG10(A301),0)');
  });

  it('koşullu biçim aralık listesini kaydırır', () => {
    expect(aralikKaydir('G22:G23 G151:G187 G27:G149 E4:F211', 106)).toBe(
      'G22:G23 G152:G188 G27:G150 E4:F212',
    );
  });
});
