// Depo kontrol kitabına sorumluluk notu (1.19.0): gün sayfasının sağ üstüne üç satırlık kısa not
// ve çıktı alt bilgisi; kitabın açılışta gösterdiği "Bilgilendirme" sayfası (metin, gün sayfasına
// bağlantı, rapor kaydı). Makro yoktur: dosya e-postayla gittiğinde de her Excel'de açılır.

import type ExcelJS from 'exceljs';
import {
  BILGI_BASLIGI,
  BILGI_METNI,
  BILGI_SAYFASI,
  KAYIT_BASLIKLARI,
  gecisMetni,
  gunNotu,
  gunNotuMu,
  kayitlariGuncelle,
  zamanMetni,
  type RaporKaydi,
} from '../cekirdek/bilgilendirme';
import { KullaniciHatasi } from '../cekirdek/hata';
import { adNormal } from '../cekirdek/metin';
import { gunSayfasiMi, tarihMetni, type Tarih } from '../cekirdek/tarih';
import { hucreDegeri } from '../kaynaklar/excel';
import { sayfaSec } from './sayfa';

type IcSayfa = ExcelJS.Worksheet & { orderNo: number };

const YAZI = 'Calibri';
const NOT_RENGI = { argb: 'FF1F3864' };
const INCE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};
const GENISLIKLER = [14, 40, 20, 14];
/** Birleşik A:D genişliğine bir satırda sığan yaklaşık karakter; Excel birleşik satırı kendisi büyütmez. */
const SATIR_KARAKTERI = 80;

const metin = (c: ExcelJS.Cell) => adNormal(hucreDegeri(c.value));

function bilgiSayfasiBul(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  const ad = BILGI_SAYFASI.toLocaleLowerCase('tr');
  return wb.worksheets.find((w) => w.name.trim().toLocaleLowerCase('tr') === ad);
}

/** Aynı adda kullanıcının kendi sayfası varsa üzerine yazılmaz; önizlemede söylenir. */
export function bilgilendirmeDogrula(wb: ExcelJS.Workbook): void {
  const ws = bilgiSayfasiBul(wb);
  if (ws && metin(ws.getCell('A1')) !== BILGI_BASLIGI)
    throw new KullaniciHatasi(
      `Dosyada '${ws.name}' adında başka bir sayfa var. Program bu adı sorumluluk notu için kullanıyor; ` +
        'o sayfanın adını Excel’de değiştirip dosyayı yeniden açın.',
    );
}

/** Önceki günden kopyalanan not aynı sütunda yenilenir; yoksa son dolu sütundan bir boşluk sonra. */
function notSutunu(ws: ExcelJS.Worksheet): number {
  for (let r = 1; r <= 3; r++) {
    let bulunan = 0;
    ws.getRow(r).eachCell((c, sutun) => {
      if (!bulunan && typeof c.value === 'string' && gunNotuMu(c.value)) bulunan = sutun;
    });
    if (bulunan) return bulunan;
  }
  let son = 0;
  ws.eachRow((satir) =>
    satir.eachCell((c, sutun) => {
      if (c.value !== null && c.value !== '') son = Math.max(son, sutun);
    }),
  );
  return son + 2;
}

function gunNotunuYaz(ws: ExcelJS.Worksheet, gun: Tarih, sayimDosyasi?: string): void {
  const not = gunNotu(gun, sayimDosyasi);
  const sutun = notSutunu(ws);
  not.forEach((m, i) => {
    const c = ws.getCell(i + 1, sutun);
    c.value = m;
    c.style = { font: { name: YAZI, size: 11, bold: i < 2, italic: true, color: NOT_RENGI } };
  });
  // Çıktıda her sayfanın altında; kullanıcının kendi alt bilgisi varsa ona dokunulmaz.
  const alt = (ws.headerFooter as Partial<ExcelJS.HeaderFooter> | null)?.oddFooter;
  if (!alt || alt.includes(not[1]))
    ws.headerFooter = { ...ws.headerFooter, oddFooter: `&L&8${`${not[0]} ${not[1]}`.replace(/&/g, '&&')}` };
}

function kayitlariOku(ws: ExcelJS.Worksheet): RaporKaydi[] {
  let r = 1;
  while (
    r <= ws.rowCount &&
    !(metin(ws.getCell(r, 1)) === KAYIT_BASLIKLARI[0] && metin(ws.getCell(r, 2)) === KAYIT_BASLIKLARI[1])
  )
    r++;
  const kayitlar: RaporKaydi[] = [];
  for (r++; r <= ws.rowCount && metin(ws.getCell(r, 1)); r++)
    kayitlar.push({
      gun: metin(ws.getCell(r, 1)),
      sayimDosyasi: metin(ws.getCell(r, 2)),
      hazirlanma: metin(ws.getCell(r, 3)),
    });
  return kayitlar;
}

/** Biçim birleştirmeden önce verilir; ExcelJS onu birleşen hücrelere kopyalar (sağ kenarlık D'dedir). */
function birlesikYaz(
  ws: ExcelJS.Worksheet,
  r: number,
  deger: ExcelJS.CellValue,
  stil: Partial<ExcelJS.Style>,
) {
  const c = ws.getCell(r, 1);
  c.value = deger;
  c.style = stil;
  ws.mergeCells(r, 1, r, GENISLIKLER.length);
  return c;
}

/** Sayfa her seferinde baştan kurulur; yalnız rapor kaydı satırları korunur. */
function bilgiSayfasiKur(wb: ExcelJS.Workbook, gunSayfasi: ExcelJS.Worksheet, kayitlar: RaporKaydi[]) {
  const eski = bilgiSayfasiBul(wb);
  if (eski) wb.removeWorksheet(eski.id);
  const ws = wb.addWorksheet(BILGI_SAYFASI, {
    properties: { tabColor: { argb: 'FFC00000' } },
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  GENISLIKLER.forEach((g, i) => (ws.getColumn(i + 1).width = g));

  birlesikYaz(ws, 1, BILGI_BASLIGI, {
    font: { name: YAZI, size: 16, bold: true, color: { argb: 'FFC00000' } },
  });
  ws.getRow(1).height = 26;
  BILGI_METNI.forEach((m, i) => {
    const r = 3 + i;
    birlesikYaz(ws, r, m, {
      font: { name: YAZI, size: 11, bold: m.startsWith('• Raporu hazırlayan') },
      alignment: { wrapText: true, vertical: 'top' },
    });
    ws.getRow(r).height = 15 * Math.ceil(m.length / SATIR_KARAKTERI) + 4;
  });

  // Makrosuz bağlantı: HYPERLINK formülü e-postayla gelen dosyada da çalışır.
  const r = 3 + BILGI_METNI.length + 1;
  const hedef = `#'${gunSayfasi.name.replace(/'/g, "''")}'!A1`;
  const yazi = gecisMetni(gunSayfasi.name);
  birlesikYaz(
    ws,
    r,
    { formula: `HYPERLINK("${hedef}","${yazi}")`, result: yazi } as ExcelJS.CellFormulaValue,
    {
      font: { name: YAZI, size: 14, bold: true, underline: true, color: { argb: 'FF0563C1' } },
      alignment: { vertical: 'middle', horizontal: 'center' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } },
      border: INCE,
    },
  );
  ws.getRow(r).height = 30;

  const k = r + 2;
  ws.getCell(k, 1).value = 'Rapor kaydı';
  ws.getCell(k, 1).font = { name: YAZI, size: 12, bold: true };
  KAYIT_BASLIKLARI.forEach((b, i) => {
    const c = ws.getCell(k + 1, i + 1);
    c.value = b;
    c.style = {
      font: { name: YAZI, size: 11, bold: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } },
      border: INCE,
    };
  });
  kayitlar.forEach((kayit, i) =>
    [kayit.gun, kayit.sayimDosyasi, kayit.hazirlanma].forEach((d, j) => {
      const c = ws.getCell(k + 2 + i, j + 1);
      c.value = d;
      c.style = { font: { name: YAZI, size: 11 }, border: INCE };
    }),
  );

  // En yeni gün sayfasının hemen arkasında durur; sekme çubuğunda son günün yanında görünür.
  const sira = wb.worksheets.filter((w) => w !== ws);
  let sonGun = -1;
  sira.forEach((w, i) => {
    if (gunSayfasiMi(w.name)) sonGun = i;
  });
  sira.splice(sonGun + 1, 0, ws);
  sira.forEach((w, i) => ((w as IcSayfa).orderNo = i));
  return ws;
}

export interface RaporNotu {
  gun: Tarih;
  sayimDosyasi?: string;
  zaman: Date;
}

/** Gün sayfasına kısa notu yazar, Bilgilendirme sayfasını yeniler; kitap o sayfayla açılır. */
export function raporNotunuYaz(wb: ExcelJS.Workbook, gunSayfasi: ExcelJS.Worksheet, n: RaporNotu): void {
  bilgilendirmeDogrula(wb);
  gunNotunuYaz(gunSayfasi, n.gun, n.sayimDosyasi);
  const eski = bilgiSayfasiBul(wb);
  const kayitlar = kayitlariGuncelle(eski ? kayitlariOku(eski) : [], {
    gun: tarihMetni(n.gun),
    sayimDosyasi: n.sayimDosyasi ?? '',
    hazirlanma: zamanMetni(n.zaman),
  });
  sayfaSec(wb, bilgiSayfasiKur(wb, gunSayfasi, kayitlar));
}
