// Gerçek depo kontrol dosyasının düzenini taklit eden sentetik ExcelJS kitabı.

import ExcelJS from 'exceljs';
import { LISTE } from './sentetik';

const KENAR: Partial<ExcelJS.Borders> = {
  left: { style: 'thin' },
  right: { style: 'thin' },
  top: { style: 'thin' },
  bottom: { style: 'thin' },
};

function gunSayfasi(
  wb: ExcelJS.Workbook,
  ad: string,
  onceki: string | null,
  tarihMetni: string,
  oncekiMetni: string,
) {
  const ws = wb.addWorksheet(ad);
  ws.getColumn(1).width = 49.14;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 49.14;
  ws.getCell('A1').value = 'GÜNLÜK DEPO KONTROLÜ';
  ws.mergeCells('A1:D1');
  ws.getCell('G1').value = 'GELEN MAL';
  ws.getCell('H1').value = 'DEPO SAYIMI';
  ws.getCell('A2').value = `${oncekiMetni} LED DEPO STOĞU (D01)`;
  ws.getCell('C2').value = `${oncekiMetni} DEPO KAPANIŞ STOĞU`;
  ws.getCell('A3').value = `${tarihMetni} LED DEPO STOĞU(D01)`;
  ws.mergeCells('A3:B3');
  ws.getCell('C3').value = `${tarihMetni} DEPO SAYIMI`;
  ws.mergeCells('C3:D3');
  ws.getCell('E3').value = 'FARK';
  const ilk = 4;
  const toplam = ilk + LISTE.length;
  LISTE.forEach((ad, i) => {
    const r = ilk + i;
    ws.getCell(r, 1).value = ad;
    ws.getCell(r, 2).value = 1;
    // İlk satır ana formül, diğerleri paylaşılan (gerçek dosyadaki gibi)
    ws.getCell(r, 3).value =
      i === 0
        ? { formula: `A${r}`, result: ad }
        : ({ sharedFormula: `C${ilk}`, result: ad } as ExcelJS.CellValue);
    ws.getCell(r, 4).value = 1;
    ws.getCell(r, 5).value = { formula: `B${r}-D${r}`, result: 0 };
    ws.getCell(r, 7).value = i === 1 ? 'elle not' : null;
    for (let c = 1; c <= 5; c++) ws.getCell(r, c).border = KENAR;
  });
  ws.getCell(toplam, 2).value = { formula: `SUM(B${ilk}:B${toplam - 1})`, result: LISTE.length };
  ws.getCell(toplam, 4).value = { formula: `SUM(D${ilk}:D${toplam - 1})`, result: LISTE.length };
  ws.getCell(toplam, 5).value = { formula: `SUM(E${ilk}:E${toplam - 1})`, result: 0 };
  if (onceki) {
    ws.getCell('B2').value = { formula: `+'${onceki}'!B${toplam}`, result: LISTE.length };
    ws.getCell('D2').value = { formula: `+'${onceki}'!D${toplam}`, result: LISTE.length };
  }
  ws.getCell('E2').value = { formula: '+B2-D2', result: 0 };
  ws.getCell('G2').value = 500;
  ws.getCell('H2').value = { formula: `D${toplam}`, result: LISTE.length };
  ws.addConditionalFormatting({
    ref: `E${ilk}:F${toplam - 1}`,
    rules: [
      {
        type: 'colorScale',
        priority: 1,
        cfvo: [{ type: 'min' }, { type: 'max' }],
        color: [{ argb: 'FF63BE7B' }, { argb: 'FFF8696B' }],
      },
    ],
  });
  ws.views = [{ state: 'normal', tabSelected: ad === '29.09' } as unknown as ExcelJS.WorksheetView];
  return ws;
}

/** "Ana Sayfa" + 28.09 + 29.09 (Salı) gün sayfaları. */
export async function depoKontrolBaytlari(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Ana Sayfa').getCell('A1').value = 'Not';
  gunSayfasi(wb, '28.09', null, '28.09.2026', '27.09.2026');
  gunSayfasi(wb, '29.09', '28.09', '29.09.2026', '28.09.2026');
  wb.views = [{ x: 0, y: 0, width: 10000, height: 8000, visibility: 'visible', activeTab: 2, firstSheet: 0 }];
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
