// Bilgilendirme sayfasının görünümü (1.19.1, kullanıcı isteği): CAL bup renkleriyle ortalanmış koyu kutu,
// kırmızı başlık şeridi, beyaz yazı; sorumluluk cümlesi kırmızı şeritte kalın; açık düğme gibi iç bağlantı,
// altında sekme yedeği; kutunun altında rapor kaydı. Excel'de pencere/şekil yok, kutu hücre dolgusudur.
// Çizgiler ve satır/sütun başlıkları gizlidir. Ortalama yaygın geniş ekrana göredir (sol boş sütun).

import type ExcelJS from 'exceljs';
import {
  BILGI_BASLIGI,
  BILGI_METNI,
  BILGI_SAYFASI,
  KAYIT_BASLIKLARI,
  ONEMLI_SIRA,
  baglantiIpucu,
  gecisMetni,
  yedekYolMetni,
  type RaporKaydi,
} from '../cekirdek/bilgilendirme';
import { adNormal } from '../cekirdek/metin';
import { hucreDegeri } from '../kaynaklar/excel';

/** src/arayuz/stiller/tema.css belirteçleri (Excel ARGB). */
const RENK = {
  vurgu: 'FFB3222E', // --vurgu
  koyu: 'FF151A22', // --murekkep: kutunun zemini
  koyu3: 'FF212833', // koyu tema --yuzey-3: kayıt başlığı
  buz: 'FF2E6FA8', // --buz: bağlantı yazısı
  buzYumusak: 'FFE8F1F9', // --buz-yumusak: bağlantı düğmesi (LibreOffice bağlantıyı lacivert boyar; açık zeminde okunur)
  beyaz: 'FFFFFFFF', // --vurgu-uzeri
  ikincil: 'FFC9CED7', // --cizgi-guclu: koyu zeminde ikincil yazı
  satir: 'FFF7F8FA', // --yuzey-2
  cizgi: 'FFC9CED7', // --cizgi-guclu
} as const;

const YAZI = 'Calibri';
/**
 * A: ortalamak için boşluk; B ve F: kutunun iç kenar boşluğu (girinti LibreOffice'te alt satıra geçmediği
 * için boşluk sütunla verilir); C–E: yazı ve kayıt tablosu aynı hizada.
 */
const GENISLIKLER = [70, 4, 22, 62, 22, 4];
const ILK = 2;
const SON = 6;
/** C:E birleşik genişliğine 12 punto bir satırda sığan yaklaşık karakter (Excel birleşik satırı büyütmez). */
const SATIR_KARAKTERI = 95;

const metin = (c: ExcelJS.Cell) => adNormal(hucreDegeri(c.value));
const dolgu = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** 1.19.0 sayfası başlığı A1'de, 1.19.1 ve sonrası B2'de taşır. */
export function bilgiSayfasiMi(ws: ExcelJS.Worksheet): boolean {
  return metin(ws.getCell('A1')) === BILGI_BASLIGI || metin(ws.getCell('B2')) === BILGI_BASLIGI;
}

/** Kayıt tablosu başlığının yeri sürüme göre değişir; "Gün | Sayım fişi" çifti aranır. */
export function kayitlariOku(ws: ExcelJS.Worksheet): RaporKaydi[] {
  for (let r = 1; r <= ws.rowCount; r++) {
    for (let c = 1; c < ws.columnCount; c++) {
      if (
        metin(ws.getCell(r, c)) !== KAYIT_BASLIKLARI[0] ||
        metin(ws.getCell(r, c + 1)) !== KAYIT_BASLIKLARI[1]
      )
        continue;
      const kayitlar: RaporKaydi[] = [];
      for (let k = r + 1; k <= ws.rowCount && metin(ws.getCell(k, c)); k++)
        kayitlar.push({
          gun: metin(ws.getCell(k, c)),
          sayimDosyasi: metin(ws.getCell(k, c + 1)),
          hazirlanma: metin(ws.getCell(k, c + 2)),
        });
      return kayitlar;
    }
  }
  return [];
}

/**
 * Kutunun bir satırı: B–F aynı zeminde; yazı `icte` ise C:E'de (kenar boşluklu), değilse B:F'de birleşik.
 * Biçim birleştirmeden önce verilir; ExcelJS onu birleşen hücrelere kopyalar.
 */
function kutuSatiri(
  ws: ExcelJS.Worksheet,
  r: number,
  yukseklik: number,
  deger?: string,
  stil: Partial<ExcelJS.Style> = {},
  icte = false,
) {
  const zemin = stil.fill ?? dolgu(RENK.koyu);
  for (let c = ILK; c <= SON; c++) ws.getCell(r, c).fill = zemin;
  const [bas, son] = icte ? [ILK + 1, SON - 1] : [ILK, SON];
  const c = ws.getCell(r, bas);
  if (deger !== undefined) c.value = deger;
  c.style = { ...stil, fill: zemin };
  ws.mergeCells(r, bas, r, son);
  ws.getRow(r).height = yukseklik;
}

const yaziStili = (boyut: number, ekstra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({
  name: YAZI,
  size: boyut,
  color: { argb: RENK.beyaz },
  ...ekstra,
});

function paragraf(ws: ExcelJS.Worksheet, r: number, m: string, boyut: number, onemli = false) {
  const satir = Math.max(1, Math.ceil(m.length / SATIR_KARAKTERI));
  kutuSatiri(
    ws,
    r,
    satir * (boyut + 5) + 12,
    m,
    {
      font: yaziStili(boyut, { bold: onemli }),
      fill: dolgu(onemli ? RENK.vurgu : RENK.koyu),
      alignment: { wrapText: true, vertical: 'middle', horizontal: 'left' },
    },
    true,
  );
}

/** Sayfayı `ws` üzerine kurar (boş, yeni eklenmiş sayfa beklenir) ve son satırını döndürür. */
export function bilgiSayfasiCiz(
  ws: ExcelJS.Worksheet,
  gunSayfasi: string,
  kayitlar: readonly RaporKaydi[],
): number {
  GENISLIKLER.forEach((g, i) => (ws.getColumn(i + 1).width = g));
  ws.getRow(1).height = 30;

  kutuSatiri(ws, 2, 42, BILGI_BASLIGI, {
    font: yaziStili(18, { bold: true }),
    fill: dolgu(RENK.vurgu),
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  kutuSatiri(ws, 3, 10);
  let r = 4;
  const [giris, ...maddeler] = BILGI_METNI;
  paragraf(ws, r++, giris ?? '', 12);
  kutuSatiri(ws, r++, 4);
  maddeler.forEach((m, i) => paragraf(ws, r++, m, 12, i + 1 === ONEMLI_SIRA));
  kutuSatiri(ws, r++, 12);

  // Düğme gibi iç bağlantı: Excel'in "bu belgedeki yer" bağlantısı (kitapYaz dış ilişkiyi temizler).
  const dugme = r++;
  for (let c = ILK; c <= SON; c++) ws.getCell(dugme, c).fill = dolgu(RENK.koyu);
  const d = ws.getCell(dugme, 4);
  d.value = {
    text: gecisMetni(gunSayfasi),
    hyperlink: `'${gunSayfasi.replace(/'/g, "''")}'!A1`,
    tooltip: baglantiIpucu(gunSayfasi),
  };
  d.style = {
    font: yaziStili(14, { bold: true, color: { argb: RENK.buz } }),
    fill: dolgu(RENK.buzYumusak),
    alignment: { vertical: 'middle', horizontal: 'center' },
  };
  ws.getRow(dugme).height = 36;
  kutuSatiri(
    ws,
    r++,
    24,
    yedekYolMetni(gunSayfasi),
    {
      font: { name: YAZI, size: 10, italic: true, color: { argb: RENK.ikincil } },
      alignment: { vertical: 'middle', horizontal: 'center' },
    },
    true,
  );
  kutuSatiri(ws, r++, 10);

  r++;
  const baslik = ws.getCell(r++, 3);
  baslik.value = 'Rapor kaydı';
  baslik.font = { name: YAZI, size: 12, bold: true, color: { argb: RENK.koyu } };
  const kenar: Partial<ExcelJS.Borders> = { bottom: { style: 'thin', color: { argb: RENK.cizgi } } };
  KAYIT_BASLIKLARI.forEach((b, i) => {
    const c = ws.getCell(r, 3 + i);
    c.value = b;
    c.style = {
      font: yaziStili(11, { bold: true }),
      fill: dolgu(RENK.koyu3),
      alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
    };
  });
  ws.getRow(r++).height = 22;
  kayitlar.forEach((k, i) => {
    [k.gun, k.sayimDosyasi, k.hazirlanma].forEach((deger, j) => {
      const c = ws.getCell(r, 3 + j);
      c.value = deger;
      c.style = {
        font: { name: YAZI, size: 11, color: { argb: RENK.koyu } },
        fill: dolgu(i % 2 ? RENK.satir : RENK.beyaz),
        border: kenar,
        alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
      };
    });
    ws.getRow(r++).height = 20;
  });
  return r - 1;
}

/** Yeni Bilgilendirme sayfası: çizgisiz, başlıksız görünüm; çıktıda kutu kâğıdın ortasında. */
export function bilgiSayfasiEkle(wb: ExcelJS.Workbook, gunSayfasi: string, kayitlar: readonly RaporKaydi[]) {
  const ws = wb.addWorksheet(BILGI_SAYFASI, {
    properties: { tabColor: { argb: RENK.vurgu } },
    views: [
      {
        state: 'normal',
        showGridLines: false,
        showRowColHeaders: false,
        zoomScale: 100,
        activeCell: 'A1',
      },
    ],
  });
  const son = bilgiSayfasiCiz(ws, gunSayfasi, kayitlar);
  ws.pageSetup = {
    ...ws.pageSetup,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    // ExcelJS yalnız sütunun önüne $ koyar; satır da sabit olsun ($B$1:$F$n).
    printArea: `B$1:F$${son}`,
  };
  return ws;
}
