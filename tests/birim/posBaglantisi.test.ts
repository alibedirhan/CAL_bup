import { expect, it } from 'vitest';
import { yardimciYanitiniDogrula } from '../../src/cekirdek/posBaglantisi';
import { windowsPosKurulumu } from '../../tools/windowsPosKurulumu';
const yanit = { protokol: 2, surum: '1.6.1', durum: 'hazir', mesaj: 'Bağlı.' };
it('bağlantı sözleşmesi eski veya bozuk yardımcıyı aktarım öncesinde reddeder', () => {
  expect(yardimciYanitiniDogrula(yanit)).toEqual(yanit);
  for (const d of [null, {}, { ...yanit, protokol: 1 }, { ...yanit, surum: 'eski' }])
    expect(() => yardimciYanitiniDogrula(d)).toThrow('güncelle');
  for (const d of [
    { ...yanit, durum: 'otomatikOdeme' },
    { ...yanit, mesaj: 'a'.repeat(301) },
  ])
    expect(() => yardimciYanitiniDogrula(d)).toThrow('yanıtı doğrulanamadı');
  expect(yardimciYanitiniDogrula({ ...yanit, kart: 'yapay' })).toEqual(yanit);
});
it('Windows hazırlayıcı yalnızca sabit yayını hash denetiminden sonra kopyalar, tarayıcı onayı ister', () => {
  const hash = 'a'.repeat(64);
  const cmd = windowsPosKurulumu('1.6.1', hash);
  expect(cmd).toContain('https://alibedirhan.github.io/CAL_bup/pos-yardimcisi.zip?v=1.6.1');
  expect(cmd).toContain(hash);
  expect(cmd.indexOf('Get-FileHash')).toBeLessThan(cmd.indexOf('Expand-Archive'));
  expect(cmd.indexOf('Expand-Archive')).toBeLessThan(cmd.indexOf('Copy-Item'));
  expect(cmd).toContain("'CALbup\\POSYardimcisi'");
  expect(cmd).toContain('Paketlenmemis oge yukle');
  expect(cmd).toContain('ReparsePoint');
  expect(cmd).toContain('-MaximumRedirection 0');
  expect(cmd).not.toMatch(/ExecutionPolicy|EncodedCommand|--load-extension|reg.exe|HKLM|denizpay/i);
  expect(cmd).not.toContain('{;');
  expect(cmd).toContain('\r\n');
});
it('kurulum üreticisi sürüm/hash üzerinden komut eklenmesini reddeder', () => {
  expect(() => windowsPosKurulumu('1.6.1;echo', 'a'.repeat(64))).toThrow();
  expect(() => windowsPosKurulumu('1.6.1', 'a'.repeat(64) + ';echo')).toThrow();
});
