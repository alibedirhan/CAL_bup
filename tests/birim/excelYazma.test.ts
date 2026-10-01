import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import { tarih } from '../../src/cekirdek/tarih';
import { kitapYaz } from '../../src/hedef/sayfa';
import { kitapAc, type AcikKitap } from '../../src/kaynaklar/excel';
import { OkumaHatasi } from '../../src/kaynaklar/kitap';
import { gunSec } from '../../src/raporlar/depoKontrol/gunSecimi';
import { hedefiIncele, kaynaklariOku, planla, uygula } from '../../src/raporlar/depoKontrol/islem';
import { depoKontrolBaytlari } from '../yardimci/depoKontrolExcel';
import { xlsxParcasi } from '../yardimci/xml';
import { d01Kitap, sayimKitap, subeKitap } from '../yardimci/sentetik';

const BUGUN = tarih(2026, 10, 1);
const kaynaklar = () =>
  kaynaklariOku({ d01: d01Kitap(), sayim: sayimKitap(), sube: subeKitap() }, AYAR, BUGUN);

async function ac(bayt: Uint8Array): Promise<ExcelJS.Workbook> {
  const yeni = new ExcelJS.Workbook();
  await yeni.xlsx.load(bayt as unknown as ExcelJS.Buffer);
  return yeni;
}

const formul = (ws: ExcelJS.Worksheet, adres: string) => ws.getCell(adres).formula;

describe('yeni gün sayfası (sentetik dosya)', () => {
  let hedef: AcikKitap;
  let bayt: Uint8Array;
  let cikti: ExcelJS.Workbook;
  let ws: ExcelJS.Worksheet;

  beforeAll(async () => {
    hedef = await kitapAc(await depoKontrolBaytlari(), 'DEPO KONTROL.xlsx');
    const bilgi = hedefiIncele(hedef, AYAR, BUGUN);
    expect(bilgi.oneri).toBe(tarih(2026, 9, 30));
    const secim = gunSec(bilgi.gunler, bilgi.oneri);
    const plan = planla(hedef, secim, kaynaklar(), AYAR);
    expect(uygula(hedef, secim, plan, AYAR)).toBe('30.09');
    bayt = await kitapYaz(hedef.excel);
    cikti = await ac(bayt);
    const s = cikti.getWorksheet('30.09');
    if (!s) throw new Error('30.09 yok');
    ws = s;
  });

  it('önceki günün hemen arkasına eklenir ve tek seçili sayfa olur', async () => {
    expect(cikti.worksheets.map((w) => w.name)).toEqual(['Ana Sayfa', '28.09', '29.09', '30.09']);
    // ExcelJS sekme seçimini geri okumadığı için dosyanın içine bakılır
    const secili = [];
    for (let i = 1; i <= 4; i++) {
      if ((await xlsxParcasi(bayt, `xl/worksheets/sheet${i}.xml`)).includes('tabSelected="1"'))
        secili.push(i);
    }
    expect(secili).toEqual([4]);
    expect(await xlsxParcasi(bayt, 'xl/workbook.xml')).toMatch(/activeTab="3"/);
  });

  it('eksik ürün alfabetik yerine, biçimiyle eklenir', () => {
    expect(ws.getCell('A9').value).toBe('YENİ ÜRÜN');
    expect(ws.getCell('A10').value).toBe('ZETA ÜRÜN');
    expect(ws.getCell('B9').border?.left?.style).toBe('thin');
    expect(formul(ws, 'C9')).toBe('A9');
    expect(formul(ws, 'E9')).toBe('B9-D9');
  });

  it('satır eklenince alttaki elle notlar ürünüyle birlikte kayar', () => {
    expect(ws.getCell('A5').value).toBe('BETA ÜRÜN');
    expect(ws.getCell('G5').value).toBe('elle not');
  });

  it('LED ve sayım miktarları yazılır, tekrar eden satır sıfırlanır', () => {
    expect(ws.getCell('B4').value).toBeCloseTo(1250.5);
    expect(ws.getCell('D4').value).toBe(1240);
    expect(ws.getCell('B7').value).toBeCloseTo(108.68);
    expect(ws.getCell('D7').value).toBeCloseTo(108.68); // donuk
    expect(ws.getCell('B8').value).toBe(0); // tekrar
  });

  it('dip toplamlar tüm listeyi kapsar, sağ üstteki bağlantı kayar', () => {
    expect(formul(ws, 'B11')).toBe('SUM(B4:B10)');
    expect(formul(ws, 'D11')).toBe('SUM(D4:D10)');
    expect(formul(ws, 'E11')).toBe('SUM(E4:E10)');
    expect(formul(ws, 'H2')).toBe('D11');
  });

  it('başlıklar yeni güne geçer ve önceki güne bağlanır', () => {
    expect(ws.getCell('A2').value).toBe('29.09.2026 LED DEPO STOĞU (D01)');
    expect(ws.getCell('C2').value).toBe('29.09.2026 DEPO KAPANIŞ STOĞU');
    expect(ws.getCell('A3').value).toBe('30.09.2026 LED DEPO STOĞU(D01)');
    expect(ws.getCell('C3').value).toBe('30.09.2026 DEPO SAYIMI');
    expect(formul(ws, 'B2')).toBe("+'29.09'!B10");
    expect(formul(ws, 'D2')).toBe("+'29.09'!D10");
    expect(ws.getCell('G2').value).toBeCloseTo(1015.32);
  });

  it('birleşik hücreler, sütun genişlikleri ve koşullu biçim korunur', () => {
    expect((ws.model as { merges?: string[] }).merges?.sort()).toEqual(['A1:D1', 'A3:B3', 'C3:D3']);
    expect(ws.getColumn(2).width).toBe(10);
    expect(ws.getColumn(1).width).toBeCloseTo(49.14, 2);
    const cf = (ws as unknown as { conditionalFormattings: { ref: string }[] }).conditionalFormattings;
    expect(cf.map((c) => c.ref)).toEqual(['E4:F10']);
  });

  it('önceki gün sayfası değişmez', () => {
    const onceki = cikti.getWorksheet('29.09');
    expect(onceki?.getCell('A9').value).toBe('ZETA ÜRÜN');
    expect(onceki?.getCell('B9').value).toBe(1);
    expect(onceki?.getCell('H2').formula).toBe('D10');
  });

  it('Excel açılışta yeniden hesaplar', async () => {
    expect(await xlsxParcasi(bayt, 'xl/workbook.xml')).toMatch(/<calcPr [^>]*fullCalcOnLoad="1"/);
  });
});

describe('var olan gün sayfasını yeniden doldurma', () => {
  it('sayfayı yerinde doldurur, kopya açmaz', async () => {
    const hedef = await kitapAc(await depoKontrolBaytlari(), 'DEPO KONTROL.xlsx');
    const bilgi = hedefiIncele(hedef, AYAR, BUGUN);
    const secim = gunSec(bilgi.gunler, tarih(2026, 9, 29));
    expect(secim.tur).toBe('mevcut');
    const plan = planla(hedef, secim, kaynaklar(), AYAR);
    uygula(hedef, secim, plan, AYAR);
    const cikti = await ac(await kitapYaz(hedef.excel));
    expect(cikti.worksheets.map((w) => w.name)).toEqual(['Ana Sayfa', '28.09', '29.09']);
    const ws = cikti.getWorksheet('29.09');
    expect(ws?.getCell('A9').value).toBe('YENİ ÜRÜN');
    expect(ws?.getCell('B2').formula).toBe("+'28.09'!B10");
    expect(ws?.getCell('A3').value).toBe('29.09.2026 LED DEPO STOĞU(D01)');
  });
});

describe('sütun genişlikleri', () => {
  it('genişliği tam 9 olan sütun kaybolmaz', async () => {
    // Gerçek dosyada B, E, F sütunları 9 genişliğinde; ExcelJS bunu varsayılan sayıp yazmıyordu
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('30.09');
    ws.getCell('A1').value = 'x';
    ws.getColumn(2).width = 9;
    const geri = await ac(await kitapYaz(wb));
    expect(geri.getWorksheet('30.09')?.getColumn(2).width).toBeCloseTo(9, 4);
  });
});

describe('dosya açma', () => {
  it('Excel olmayan dosyayı anlaşılır hatayla reddeder', async () => {
    await expect(kitapAc(new TextEncoder().encode('merhaba'), 'not.txt')).rejects.toThrow(OkumaHatasi);
  });

  it('depo kontrol dosyası olmayan kitabı reddeder', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('30.09').getCell('A1').value = 'x';
    const acik = await kitapAc(new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer), 'x.xlsx');
    expect(() => hedefiIncele(acik, AYAR, BUGUN)).toThrow(/depo kontrol dosyası değil/);
  });
});
