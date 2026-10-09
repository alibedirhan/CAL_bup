// Depo kontrol kitabında sayfa düzeyindeki işlemler: kopyalama, satır ekleme, seçme, yazma.
// ExcelJS'in eksik bıraktığı yerler (formül kaydırma, birleşik hücre kopyası, sütun
// genişlikleri, sekme seçimi) burada tamamlanır. Bkz. docs/MIMARI.md "ExcelJS notları".

import type ExcelJS from 'exceljs';
import { KullaniciHatasi } from '../cekirdek/hata';
import { formulKaydir } from './formul';
import { icBaglantilariDuzelt } from './icBaglanti';
import { satirEklemeyiDogrula, satirOzellikleriniHazirla } from './satirOzellikleri';

type FormulDegeri = { formula?: string; sharedFormula?: string; result?: unknown };

/** ExcelJS'in tür tanımlarında olmayan ama çalışma zamanında bulunan alanlar. */
type IcSayfa = ExcelJS.Worksheet & { orderNo: number; conditionalFormattings: { ref: string }[] };

function formulMu(v: ExcelJS.CellValue): v is ExcelJS.CellValue & FormulDegeri {
  return typeof v === 'object' && v !== null && ('formula' in v || 'sharedFormula' in v);
}

/** Veri ya da ayarı (genişlik, gizlilik) olan son sütun. */
function sutunSayisi(ws: ExcelJS.Worksheet): number {
  return Math.max(ws.columnCount, ws.columns?.length ?? 0);
}

function hucreleriGez(ws: ExcelJS.Worksheet, is: (c: ExcelJS.Cell) => void): void {
  ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, is));
}

/**
 * Paylaşılan formülleri her hücrenin kendi formülüne çevirir. Satır ekleyince paylaşılan
 * formülün ana hücresi kayabildiği için ExcelJS dosyayı yazamıyor; açık formülde bu sorun yok.
 */
export function paylasilanFormulleriAc(ws: ExcelJS.Worksheet): void {
  const donusum: [ExcelJS.Cell, string, unknown][] = [];
  hucreleriGez(ws, (c) => {
    const v = c.value;
    if (formulMu(v) && (v.sharedFormula !== undefined || 'shareType' in v)) {
      donusum.push([c, c.formula, v.result]);
    }
  });
  for (const [c, formula, result] of donusum) {
    c.value = result === undefined ? { formula } : ({ formula, result } as ExcelJS.CellFormulaValue);
  }
}

/** Sayfadaki formüllerin hesaplanmış eski sonuçlarını siler; Excel açılışta yeniden hesaplar. */
export function eskiSonuclariSil(ws: ExcelJS.Worksheet, haric: ReadonlySet<string> = new Set()): void {
  hucreleriGez(ws, (c) => {
    const v = c.value;
    if (formulMu(v) && !haric.has(c.address)) c.value = { formula: c.formula };
  });
}

/**
 * `kaynak` sayfasının biçimli kopyasını `ad` adıyla hemen arkasına ekler.
 * Excel'deki "Taşı veya Kopyala → Kopya oluştur" karşılığı.
 */
export function sayfaKopyala(wb: ExcelJS.Workbook, kaynak: ExcelJS.Worksheet, ad: string): ExcelJS.Worksheet {
  if (wb.getWorksheet(ad)) throw new KullaniciHatasi(`'${ad}' adında bir sayfa zaten var.`);
  const yeni = wb.addWorksheet(ad);
  const model = structuredClone(kaynak.model);
  yeni.model = { ...model, name: ad, id: yeni.id } as ExcelJS.WorksheetModel;
  // Model kopyası birleşik hücreleri ve "varsayılan" (9) genişlikteki sütunları almıyor
  for (const aralik of (kaynak.model as { merges?: string[] }).merges ?? []) yeni.mergeCells(aralik);
  for (let c = 1; c <= sutunSayisi(kaynak); c++) {
    const k = kaynak.getColumn(c);
    const y = yeni.getColumn(c);
    if (k.width !== undefined) y.width = k.width;
    if (k.hidden) y.hidden = true;
  }
  const sira = wb.worksheets.filter((w) => w !== yeni);
  sira.splice(sira.indexOf(kaynak) + 1, 0, yeni);
  sira.forEach((w, i) => ((w as IcSayfa).orderNo = i));
  return yeni;
}

/**
 * `satir` numarasına boş bir satır ekler; altındaki her şey bir satır aşağı kayar.
 * Biçim üstteki satırdan alınır; `asagidanBicim` doluysa alttakinden (listenin ilk satırı için).
 * Formüller ve koşullu biçim aralıkları Excel'deki gibi kaydırılır.
 */
export function satirEkle(ws: ExcelJS.Worksheet, satir: number, asagidanBicim = false): void {
  satirEklemeyiDogrula(ws, satir);

  const ozellikleriUygula = satirOzellikleriniHazirla(ws, satir);
  paylasilanFormulleriAc(ws);
  const sutunSayisi = ws.columnCount;
  ws.insertRow(satir, [], 'n');

  const ornek = ws.getRow(asagidanBicim ? satir + 1 : satir - 1);
  const yeni = ws.getRow(satir);
  if (ornek.height !== undefined) yeni.height = ornek.height;
  for (let c = 1; c <= sutunSayisi; c++) {
    yeni.getCell(c).style = structuredClone(ornek.getCell(c).style);
  }

  hucreleriGez(ws, (c) => {
    const v = c.value;
    if (!formulMu(v) || Number(c.row) === satir) return;
    const kaydirilmis = formulKaydir(c.formula, satir);
    if (kaydirilmis !== c.formula) c.value = { formula: kaydirilmis };
  });

  ozellikleriUygula();
}

/** Yalnızca bu sayfa seçili ve açık olsun (kopyadan sonra iki sekme birlikte seçili kalmasın). */
export function sayfaSec(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet): void {
  for (const w of wb.worksheets) {
    const gorunum = (w.views as ExcelJS.WorksheetView[] | null | undefined)?.[0];
    if (gorunum) (gorunum as { tabSelected?: boolean }).tabSelected = w === ws;
    else if (w === ws) w.views = [{ state: 'normal', tabSelected: true } as unknown as ExcelJS.WorksheetView];
  }
  const kitapGorunumu = (wb.views as ExcelJS.WorkbookView[] | null | undefined)?.[0];
  const sira = wb.worksheets.indexOf(ws);
  if (kitapGorunumu) {
    kitapGorunumu.activeTab = sira;
    if ((kitapGorunumu.firstSheet ?? 0) > sira) kitapGorunumu.firstSheet = sira;
  }
}

/**
 * ExcelJS genişliği tam 9 olan sütunları "varsayılan" sayıp yazmıyor; Excel'in varsayılanı
 * ise 8,43. Görünüm değişmesin diye bu sütunlar fark edilmeyecek kadar küçük bir farkla yazılır.
 */
function genislikleriKoru(wb: ExcelJS.Workbook): void {
  for (const ws of wb.worksheets) {
    for (let c = 1; c <= sutunSayisi(ws); c++) {
      const sutun = ws.getColumn(c);
      if (sutun.width === 9) sutun.width = 9.000001;
    }
  }
}

/** Kitabı .xlsx baytlarına çevirir. Excel açılışta bütün formülleri yeniden hesaplar. */
export async function kitapYaz(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  genislikleriKoru(wb);
  wb.calcProperties = { ...wb.calcProperties, fullCalcOnLoad: true };
  const tampon = await wb.xlsx.writeBuffer();
  return icBaglantilariDuzelt(new Uint8Array(tampon as ArrayBuffer));
}
