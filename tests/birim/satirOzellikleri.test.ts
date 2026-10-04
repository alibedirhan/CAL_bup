import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { kitapYaz, satirEkle } from '../../src/hedef/sayfa';
import { kitapAc } from '../../src/kaynaklar/excel';

describe('satır eklerken Excel özellikleri', () => {
  it('koşullu biçim formülü, veri doğrulama, filtre ve yazdırma alanını birlikte kaydırır', async () => {
    const w = new ExcelJS.Workbook();
    const s = w.addWorksheet('Yapay');
    s.getCell('A10').value = 123;
    s.getCell('H10').dataValidation = { type: 'custom', formulae: ['A10>0'] };
    s.getCell('H4').dataValidation = { type: 'list', formulae: ['"A10,B10"'] };
    s.autoFilter = { from: { row: 4, column: 1 }, to: { row: 10, column: 8 } };
    s.pageSetup.printArea = 'A1:H10&&J10:K12';
    s.pageSetup.printTitlesRow = '8:10';
    s.addConditionalFormatting({
      ref: 'A10:H10',
      rules: [{ type: 'expression', priority: 1, formulae: ['A10>0'], style: { font: { bold: true } } }],
    });
    satirEkle(s, 6);
    const acik = await kitapAc(await kitapYaz(w), 'Yapay.xlsx');
    const ws = acik.excel.getWorksheet('Yapay');
    expect(ws?.getCell('A11').value).toBe(123);
    expect(ws?.getCell('H11').dataValidation.formulae).toEqual(['A11>0']);
    expect(ws?.getCell('H10').dataValidation).toBeUndefined();
    expect(ws?.getCell('H4').dataValidation.formulae).toEqual(['"A10,B10"']);
    expect(ws?.autoFilter).toBe('A4:H11');
    expect(ws?.pageSetup.printArea).toBe('A1:H11&&J11:K13');
    expect(ws?.pageSetup.printTitlesRow).toBe('9:11');
    const cf = (ws as ExcelJS.Worksheet & { conditionalFormattings: ExcelJS.ConditionalFormattingOptions[] })
      .conditionalFormattings[0];
    expect(cf?.ref).toBe('A11:H11');
    expect(cf?.rules[0]).toMatchObject({ formulae: ['A11>0'] });
  });
  it.each(['tablo', 'ad', 'resim', 'dizi', 'renk'] as const)(
    'desteklenmeyen %s yapısında tek bir hücreyi bile değiştirmez',
    (tur) => {
      const w = new ExcelJS.Workbook();
      const s = w.addWorksheet('Yapay');
      s.getCell('A10').value = 'Yapay son hücre';
      if (tur === 'tablo')
        s.addTable({ name: 'YapayTablo', ref: 'B2', columns: [{ name: 'Yapay sütun' }], rows: [[1], [2]] });
      if (tur === 'ad') w.definedNames.add('Yapay!$A$10', 'YapayAd');
      if (tur === 'resim') {
        const id = w.addImage({ base64: 'eWFwYXk=', extension: 'png' });
        s.addImage(id, 'B2:C3');
      }
      if (tur === 'dizi')
        s.getCell('B10').value = {
          formula: 'A10:A11*2',
          shareType: 'array',
          ref: 'B10:B11',
        } as unknown as ExcelJS.CellValue;
      if (tur === 'renk')
        s.addConditionalFormatting({
          ref: 'B2:B10',
          rules: [
            {
              type: 'colorScale',
              priority: 1,
              cfvo: [{ type: 'formula', value: 1 }, { type: 'max' }],
              color: [{ argb: 'FF000000' }, { argb: 'FFFFFFFF' }],
            },
          ],
        });
      const onceki = structuredClone(s.model);
      expect(() => satirEkle(s, 6)).toThrow(/kopya/);
      expect(s.model).toEqual(onceki);
    },
  );
  it('metin olarak filtre aralığı da kayar', () => {
    const s = new ExcelJS.Workbook().addWorksheet('Yapay');
    s.autoFilter = 'A4:H10';
    satirEkle(s, 6);
    expect(s.autoFilter).toBe('A4:H11');
  });
  it.each(['metin', 'adres', 'koordinat'] as const)(
    'son üründen sonra eklenen satır filtreye katılır: %s',
    (tur) => {
      const s = new ExcelJS.Workbook().addWorksheet('Yapay');
      s.autoFilter =
        tur === 'metin'
          ? 'A3:H5'
          : tur === 'adres'
            ? { from: 'A3', to: 'H5' }
            : { from: { row: 3, column: 1 }, to: { row: 5, column: 8 } };
      satirEkle(s, 6);
      expect(s.autoFilter).toEqual(
        tur === 'metin'
          ? 'A3:H6'
          : tur === 'adres'
            ? { from: 'A3', to: 'H6' }
            : { from: { row: 3, column: 1 }, to: { row: 6, column: 8 } },
      );
    },
  );
});
