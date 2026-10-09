// Depo kontrol kitabına sorumluluk notu (1.19.0): gün sayfasının sağ üstüne üç satırlık kısa not
// ve çıktı alt bilgisi; kitabın açılışta gösterdiği "Bilgilendirme" sayfası (görünümü bilgiSayfasi.ts).
// Makro yoktur: dosya e-postayla gittiğinde de her Excel'de açılır.

import type ExcelJS from 'exceljs';
import { BILGI_SAYFASI, gunNotu, gunNotuMu, kayitlariGuncelle, zamanMetni } from '../cekirdek/bilgilendirme';
import { KullaniciHatasi } from '../cekirdek/hata';
import { gunSayfasiMi, tarihMetni, type Tarih } from '../cekirdek/tarih';
import { bilgiSayfasiEkle, bilgiSayfasiMi, kayitlariOku } from './bilgiSayfasi';
import { sayfaSec } from './sayfa';

type IcSayfa = ExcelJS.Worksheet & { orderNo: number };

const YAZI = 'Calibri';
const NOT_RENGI = { argb: 'FF1F3864' };

function bilgiSayfasiBul(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  const ad = BILGI_SAYFASI.toLocaleLowerCase('tr');
  return wb.worksheets.find((w) => w.name.trim().toLocaleLowerCase('tr') === ad);
}

/** Aynı adda kullanıcının kendi sayfası varsa üzerine yazılmaz; önizlemede söylenir. */
export function bilgilendirmeDogrula(wb: ExcelJS.Workbook): void {
  const ws = bilgiSayfasiBul(wb);
  if (ws && !bilgiSayfasiMi(ws))
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

/** En yeni gün sayfasının hemen arkasına; sekme çubuğunda son günün yanında görünür. */
function siraya(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet): void {
  const sira = wb.worksheets.filter((w) => w !== ws);
  let sonGun = -1;
  sira.forEach((w, i) => {
    if (gunSayfasiMi(w.name)) sonGun = i;
  });
  sira.splice(sonGun + 1, 0, ws);
  sira.forEach((w, i) => ((w as IcSayfa).orderNo = i));
}

export interface RaporNotu {
  gun: Tarih;
  sayimDosyasi?: string;
  zaman: Date;
}

/**
 * Gün sayfasına kısa notu yazar, Bilgilendirme sayfasını baştan kurar (yalnız rapor kaydı satırları
 * korunur; 1.19.0 düzeni de okunur) ve kitabın o sayfayla açılmasını sağlar.
 */
export function raporNotunuYaz(wb: ExcelJS.Workbook, gunSayfasi: ExcelJS.Worksheet, n: RaporNotu): void {
  bilgilendirmeDogrula(wb);
  gunNotunuYaz(gunSayfasi, n.gun, n.sayimDosyasi);
  const eski = bilgiSayfasiBul(wb);
  const kayitlar = kayitlariGuncelle(eski ? kayitlariOku(eski) : [], {
    gun: tarihMetni(n.gun),
    sayimDosyasi: n.sayimDosyasi ?? '',
    hazirlanma: zamanMetni(n.zaman),
  });
  if (eski) wb.removeWorksheet(eski.id);
  const ws = bilgiSayfasiEkle(wb, gunSayfasi.name, kayitlar);
  siraya(wb, ws);
  sayfaSec(wb, ws);
}
