// Yalnızca yapay veri. Derlemede Windows kabulü için indirilebilir paket üretir.
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const zip = new JSZip();
const adlar = ['YAPAY ALFA', 'DON.YAPAY BETA', 'YAPAY YENİ'];
async function ekle(ad: string, wb: ExcelJS.Workbook) {
  wb.creator = 'CAL bup yapay deneme';
  wb.created = new Date('2026-10-01T00:00:00Z');
  zip.file(ad, await wb.xlsx.writeBuffer());
}
const hedef = new ExcelJS.Workbook();
for (const gun of ['30.09', '01.10']) {
  const s = hedef.addWorksheet(gun);
  const tarih = gun + '.2026';
  s.getCell('A1').value = 'YAPAY DENEME — ŞİRKET VERİSİ DEĞİLDİR';
  s.mergeCells('A1:D1');
  s.getCell('G1').value = 'GELEN MAL';
  s.getCell('G2').value = 0;
  s.getCell('A3').value = tarih + ' LED DEPO STOĞU (D01)';
  s.getCell('C3').value = tarih + ' DEPO KAPANIŞ STOĞU';
  s.mergeCells('A3:B3');
  s.mergeCells('C3:D3');
  for (const [i, ad] of adlar.slice(0, 2).entries()) {
    const r = i + 4;
    s.getCell(r, 1).value = ad;
    s.getCell(r, 2).value = 0;
    s.getCell(r, 3).value = { formula: `A${r}`, result: ad };
    s.getCell(r, 4).value = 0;
    s.getCell(r, 5).value = { formula: `B${r}-D${r}`, result: 0 };
  }
  for (const c of ['B', 'D', 'E']) s.getCell(c + '6').value = { formula: `SUM(${c}4:${c}5)`, result: 0 };
  s.getCell('H2').value = { formula: 'D6', result: 0 };
  s.getColumn(1).width = 48;
  for (const c of [2, 4, 5, 7, 8]) s.getColumn(c).width = 14;
  s.getColumn(3).width = 38;
  s.pageSetup.printArea = 'A1:H6';
  s.pageSetup.printTitlesRow = '1:3';
  s.autoFilter = 'A3:E5';
}
await ekle('YAPAY_DEPO_KONTROL.xlsx', hedef);
const d01 = new ExcelJS.Workbook();
const d = d01.addWorksheet('LED');
d.addRow(['D01.Stok Giriş Çıkış Envanteri']);
d.addRow(['Başlangıç Tarihi : 02.10.2026\nBitiş Tarihi : 02.10.2026']);
d.addRow(['Stok Kodu', 'Stok İsmi', 'Birim', null, null, null, null, 'Net Miktar']);
for (const [i, miktar] of [10, 5, 2].entries())
  d.addRow(['Y' + i, adlar[i], 'KG', null, null, null, null, miktar]);
d.addRow([null, null, null, null, null, null, null, 17]);
await ekle('YAPAY_D01.xlsx', d01);
const sayim = new ExcelJS.Workbook();
const s = sayim.addWorksheet('Sayım Fişi');
s.addRow([null, 'Stok Kartı', 'Stok Kartı', 'Miktar', 'Birim']);
s.addRow([null, 'Y0', adlar[0], 9, 'KG']);
s.addRow([null, 'Y2', adlar[2], 2, 'KG']);
s.addRow([null, null, null, 11]);
await ekle('YAPAY_SAYIM_02.10.2026.xlsx', sayim);
const sube = new ExcelJS.Workbook();
const a = sube.addWorksheet('LED');
a.addRow(['Şube Alış']);
a.addRow(['Başlangıç Tarihi : 01.10.2026\nBitiş Tarihi : 01.10.2026']);
a.addRow([null, null, null, 'Stok İsim', 'Tarih', 'Stok Kodu', 'Birim', 'Miktar']);
a.addRow([null, null, null, adlar[0], '01.10.2026', 'Y0', 'KG', 7]);
a.addRow([null, null, null, null, null, null, null, 7]);
await ekle('YAPAY_SUBE_ALIS.xlsx', sube);
zip.file(
  'DENEME.txt',
  `CAL bup — tamamen yapay Windows/Excel denemesi

Gerçek raporunuzdan ayrı bir klasöre çıkarın. Rapor ayarları varsayılan olmalı.
1. Dört Excel dosyasını Günlük depo kontrol ekranına bırakın; tarihi 02.10.2026 seçin.
2. Beklenen: LED stoğu 17 kg, depo sayımı 16 kg, gelen mal 7 kg, fark 1 kg.
   YAPAY ALFA: B=10, D=9; DON.YAPAY BETA: B=5, D=5; YAPAY YENİ: B=2, D=2.
   Bir yeni ürün eklenir; genel durum Uyarı, üç toplam kontrolü Tamam olmalı.
3. Yeni dosya olarak indirin. Masaüstü Excel'de açın: onarım uyarısı olmamalı.
   02.10 sayfasında B7=17, D7=16, E7=1, G2=7, H2=16; önceki sayfalar aynı kalmalı.
   Filtre A3:E6, baskı alanı A1:H7 olmalı. Excel'de kaydedip yeniden açın.
4. Yeni bir deneme kopyasını uygulamada dosya seçiciyle açın ve dosyaya kaydı deneyin.
   Excel'de açıkken de deneyin. Yazma hatası varsa başarı mesajı verilmemeli;
   Excel'i kapatıp dosyayı yeniden açın. Excel kilit davranışı sürüme göre değişebilir.
5. Google Drive kurulduğunda yalnızca bu yapay dosyayla gönderme/ikinci cihazda açmayı deneyin.

Bu paket POS kartı/fotoğrafı içermez. Müşteri kartı, SMS veya ödeme ile deneme yapmayın.
Windows/Google denemesi kullanıcı tarafından daha sonra yapılacaktır.
`,
);
await writeFile(
  resolve(import.meta.dirname, '../dist/deneme-dosyalari.zip'),
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
