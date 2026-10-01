// Excel dosyasını (ExcelJS) okuyucuların gördüğü Kitap biçimine çevirir.
// ExcelJS'e bağlı tek okuma dosyası budur.

import ExcelJS from 'exceljs';
import { OkumaHatasi, type HucreDegeri, type Kitap, type Sayfa } from './kitap';

/** Açılmış dosya: okuyucular için Kitap görünümü + yazmak için ExcelJS kitabı. */
export interface AcikKitap {
  kitap: Kitap;
  excel: ExcelJS.Workbook;
}

/** En büyük dosya: LED çıktıları birkaç yüz KB, depo kontrol dosyası ~1 MB. */
export const EN_BUYUK_DOSYA = 25 * 1024 * 1024;

export async function kitapAc(veri: ArrayBuffer | Uint8Array, dosyaAdi: string): Promise<AcikKitap> {
  if (veri.byteLength > EN_BUYUK_DOSYA) {
    throw new OkumaHatasi(`${dosyaAdi} çok büyük (${Math.round(veri.byteLength / 1048576)} MB).`);
  }
  const excel = new ExcelJS.Workbook();
  try {
    // ExcelJS'in türü Node Buffer bekliyor; tarayıcıda ArrayBuffer/Uint8Array da çalışıyor
    await excel.xlsx.load(
      (veri instanceof Uint8Array ? veri : new Uint8Array(veri)) as unknown as ExcelJS.Buffer,
    );
  } catch {
    throw new OkumaHatasi(
      `${dosyaAdi} açılamadı. Dosyanın .xlsx biçiminde olduğundan ve bozuk olmadığından emin olun.`,
    );
  }
  return { kitap: kitapGorunumu(excel, dosyaAdi), excel };
}

export function kitapGorunumu(excel: ExcelJS.Workbook, dosyaAdi: string): Kitap {
  return {
    dosyaAdi,
    olusturulma:
      excel.created instanceof Date && !Number.isNaN(excel.created.getTime()) ? excel.created : null,
    sayfalar: excel.worksheets.map(sayfaGorunumu),
  };
}

export function sayfaGorunumu(ws: ExcelJS.Worksheet): Sayfa {
  return {
    ad: ws.name,
    sonSatir: ws.rowCount,
    hucre: (r, c) => hucreDegeri(ws.getCell(r, c).value),
  };
}

/**
 * ExcelJS hücre değeri → düz değer. Formülde hesaplanmış sonuç, biçimli metinde düz metin,
 * köprüde görünen metin alınır. Excel tarihleri saat diliminden bağımsız gün olarak döner.
 */
export function hucreDegeri(v: ExcelJS.CellValue): HucreDegeri {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return excelTarihi(v);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((p) => p.text).join('');
    if ('formula' in v || 'sharedFormula' in v) {
      const sonuc = (v as { result?: unknown }).result;
      if (sonuc === undefined || sonuc === null) return null;
      if (typeof sonuc === 'object' && 'error' in sonuc) return String((sonuc as { error: unknown }).error);
      return hucreDegeri(sonuc as ExcelJS.CellValue);
    }
    if ('error' in v) return String(v.error);
    if ('text' in v) return hucreDegeri((v as { text: ExcelJS.CellValue }).text);
  }
  return null;
}

/** ExcelJS tarihleri UTC olarak verir; aynı takvim gününü yerel saatte kurarız. */
function excelTarihi(d: Date): Date {
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  );
}
