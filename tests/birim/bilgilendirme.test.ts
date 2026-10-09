import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import {
  BILGI_METNI,
  gunNotu,
  gunNotuMu,
  kayitlariGuncelle,
  zamanMetni,
} from '../../src/cekirdek/bilgilendirme';
import { tarih, type Tarih } from '../../src/cekirdek/tarih';
import { kitapYaz } from '../../src/hedef/sayfa';
import { kitapAc } from '../../src/kaynaklar/excel';
import { gunSec } from '../../src/raporlar/depoKontrol/gunSecimi';
import { hedefiIncele, kaynaklariOku, planla, uygula } from '../../src/raporlar/depoKontrol/islem';
import { depoKontrolBaytlari } from '../yardimci/depoKontrolExcel';
import { d01Kitap, sayimKitap, subeKitap } from '../yardimci/sentetik';
import { xlsxParcalari, xlsxParcasi } from '../yardimci/xml';

const BUGUN = tarih(2026, 10, 2);
const kaynaklar = () =>
  kaynaklariOku({ d01: d01Kitap(), sayim: sayimKitap(), sube: subeKitap() }, AYAR, BUGUN);

/** Sentetik kitapta verilen günü hazırlar (yerel saat 09:12) ve yazılan baytları döndürür. */
async function hazirla(bayt: Uint8Array, gun: Tarih, sayimDosyasi?: string, saat = 9) {
  const hedef = await kitapAc(bayt, 'DEPO KONTROL.xlsx');
  const secim = gunSec(hedefiIncele(hedef, AYAR, BUGUN).gunler, gun);
  const plan = planla(hedef, secim, kaynaklar(), AYAR, [], sayimDosyasi);
  uygula(hedef, secim, plan, AYAR, new Date(2026, 9, 1, saat, 12));
  return kitapYaz(hedef.excel);
}

async function ac(bayt: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bayt as unknown as ExcelJS.Buffer);
  return wb;
}

/** Bilgilendirme düzeni (1.19.1): başlık B2, metin C4 ve C6–C9, düğme D11, yedek yol C12, kayıt C16:E. */
const KAYIT_BASLIGI = 16;
const satirlar = (ws: ExcelJS.Worksheet, ilk = KAYIT_BASLIGI + 1, sutun = 3) => {
  const sonuc: unknown[][] = [];
  for (let r = ilk; ws.getCell(r, sutun).value; r++)
    sonuc.push([0, 1, 2].map((c) => ws.getCell(r, sutun + c).value));
  return sonuc;
};
/** Bilgilendirme'nin sayfa XML'i: çizgisiz ve başlıksız tek sayfa odur. */
async function bilgiXml(bayt: Uint8Array) {
  const x = (await xlsxParcalari(bayt, /^xl\/worksheets\/sheet\d+\.xml$/)).filter((s) =>
    s.includes('showRowColHeaders="0"'),
  );
  expect(x).toHaveLength(1);
  return x[0] ?? '';
}

describe('sorumluluk notu metinleri', () => {
  it('gün notu tarihi ve sayım fişinin adını yazar; önceki günün notu tanınır', () => {
    const not = gunNotu(tarih(2026, 9, 30), 'SAYIM_30_09.xlsx');
    expect(not).toEqual([
      'Depo sayımı, depo sorumlusunun 30.09.2026 sayımından (SAYIM_30_09.xlsx) alınmıştır.',
      'Hazırlayan fiziki sayım yapmamıştır.',
      'Ayrıntı: Bilgilendirme sayfası.',
    ]);
    expect(gunNotu(tarih(2026, 9, 30))[0]).toBe(
      'Depo sayımı, depo sorumlusunun 30.09.2026 sayımından alınmıştır.',
    );
    expect(not.every(gunNotuMu)).toBe(true);
    expect(gunNotuMu('DEPO SAYIMI')).toBe(false);
  });

  it('Bilgilendirme metni kullanıcıyla kararlaştırıldığı gibidir', () => {
    expect(BILGI_METNI[0]).toMatch(/^Bu rapor, İzmir Bupiliç İdari Asistanı tarafından masa başında/);
    expect(BILGI_METNI.join(' ')).toContain(
      'Sayım miktarlarının doğruluğu, sayımı yapan depo sorumlusuna aittir.',
    );
    expect(BILGI_METNI.join(' ')).toContain(
      'Sayım fişinde bulunmayan donuk ürünlerde LED stoğu esas alınır.',
    );
  });

  it('rapor kaydında aynı gün yenilenir, en yeni gün üstte; okunamayan satır sonda', () => {
    const k = (gun: string, saat = '09:00') => ({
      gun,
      sayimDosyasi: 'S.xlsx',
      hazirlanma: `01.10.2026 ${saat}`,
    });
    expect(kayitlariGuncelle([k('29.09.2026'), k('elle not'), k('28.09.2026')], k('30.09.2026'))).toEqual([
      k('30.09.2026'),
      k('29.09.2026'),
      k('28.09.2026'),
      k('elle not'),
    ]);
    expect(kayitlariGuncelle([k('30.09.2026'), k('29.09.2026')], k('29.09.2026', '10:30'))).toEqual([
      k('30.09.2026'),
      k('29.09.2026', '10:30'),
    ]);
    expect(zamanMetni(new Date(2026, 0, 5, 7, 3))).toBe('05.01.2026 07:03');
  });
});

describe('depo kontrol kitabında sorumluluk notu', () => {
  it('yeni gün: Bilgilendirme son günün arkasında, açılışta o görünür; gün sayfasında not ve alt bilgi', async () => {
    const bayt = await hazirla(await depoKontrolBaytlari(), tarih(2026, 9, 30), 'SAYIM_30_09.xlsx');
    const wb = await ac(bayt);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Ana Sayfa',
      '28.09',
      '29.09',
      '30.09',
      'Bilgilendirme',
    ]);
    expect(await xlsxParcasi(bayt, 'xl/workbook.xml')).toMatch(/activeTab="4"/);
    const sayfalar = await xlsxParcalari(bayt, /^xl\/worksheets\/sheet\d+\.xml$/);
    expect(sayfalar.filter((x) => x.includes('tabSelected="1"'))).toHaveLength(1);

    const b = wb.getWorksheet('Bilgilendirme');
    if (!b) throw new Error('Bilgilendirme yok');
    expect(b.getCell('B2').value).toBe('BİLGİLENDİRME');
    expect(b.getCell('B2').fill).toMatchObject({ fgColor: { argb: 'FFB3222E' } });
    expect([4, 6, 7, 8, 9].map((r) => b.getCell(r, 3).value)).toEqual([...BILGI_METNI]);
    // Yazılar beyaz, kutu koyu; sorumluluk cümlesi kırmızı şeritte kalın
    expect(b.getCell('C4').font).toMatchObject({ color: { argb: 'FFFFFFFF' } });
    expect(b.getCell('C4').fill).toMatchObject({ fgColor: { argb: 'FF151A22' } });
    expect(b.getCell('C8').value).toMatch(/^• Raporu hazırlayan/);
    expect(b.getCell('C8').font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
    expect(b.getCell('C8').fill).toMatchObject({ fgColor: { argb: 'FFB3222E' } });
    expect(b.getCell('D11').fill).toMatchObject({ fgColor: { argb: 'FFE8F1F9' } });
    expect(b.getCell('D11').font).toMatchObject({ bold: true, color: { argb: 'FF2E6FA8' } });
    expect(b.getCell('C12').value).toBe('Bağlantı açılmazsa alttaki 30.09 sekmesine tıklayın.');
    // Excel'in kendi iç bağlantısı: yalnız location; dış ilişki, makro yok
    const xml = await bilgiXml(bayt);
    expect(xml).toContain(
      '<hyperlink ref="D11" tooltip="30.09 sayfasına git" location="&apos;30.09&apos;!A1"/>',
    );
    expect(xml).toMatch(/showGridLines="0"/);
    expect(xml).not.toMatch(/<hyperlink [^>]*r:id=/);
    expect(await xlsxParcalari(bayt, /vbaProject/)).toHaveLength(0);
    for (const x of await xlsxParcalari(bayt, /^xl\/worksheets\/_rels\//))
      expect(x).not.toMatch(/hyperlink/i);
    expect(await xlsxParcasi(bayt, 'xl/workbook.xml')).toMatch(/&apos;Bilgilendirme&apos;!\$B\$1:\$F\$17/);
    expect(b.getCell(KAYIT_BASLIGI, 3).value).toBe('Gün');
    expect(satirlar(b)).toEqual([['30.09.2026', 'SAYIM_30_09.xlsx', '01.10.2026 09:12']]);

    // Sentetik sayfada son dolu sütun H; not bir sütun boşluk bırakıp J'ye yazılır.
    const g = wb.getWorksheet('30.09');
    if (!g) throw new Error('30.09 yok');
    expect([1, 2, 3].map((r) => g.getCell(r, 10).value)).toEqual(
      gunNotu(tarih(2026, 9, 30), 'SAYIM_30_09.xlsx'),
    );
    expect(g.getCell('I1').value).toBeNull();
    expect(g.headerFooter.oddFooter).toBe(
      '&L&8Depo sayımı, depo sorumlusunun 30.09.2026 sayımından (SAYIM_30_09.xlsx) alınmıştır. Hazırlayan fiziki sayım yapmamıştır.',
    );
    // Önceki gün sayfasına not yazılmaz
    expect(wb.getWorksheet('29.09')?.getCell(1, 10).value).toBeNull();
  });

  it('ertesi gün: not aynı sütunda yenilenir, kayıt birikir, Bilgilendirme yine son günün arkasında', async () => {
    const ilkGun = await hazirla(await depoKontrolBaytlari(), tarih(2026, 9, 30), 'SAYIM_30_09.xlsx');
    const wb = await ac(await hazirla(ilkGun, tarih(2026, 10, 1), 'SAYIM_01_10.xlsx', 10));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Ana Sayfa',
      '28.09',
      '29.09',
      '30.09',
      '01.10',
      'Bilgilendirme',
    ]);
    const g = wb.getWorksheet('01.10');
    expect(g?.getCell(1, 10).value).toBe(gunNotu(tarih(2026, 10, 1), 'SAYIM_01_10.xlsx')[0]);
    expect(g?.getCell(1, 12).value).toBeNull();
    expect(wb.getWorksheet('30.09')?.getCell(1, 10).value).toBe(
      gunNotu(tarih(2026, 9, 30), 'SAYIM_30_09.xlsx')[0],
    );
    const b = wb.getWorksheet('Bilgilendirme');
    if (!b) throw new Error('Bilgilendirme yok');
    expect(b.getCell('D11').text).toBe('Okudum, 01.10 gün sayfasına geç →');
    expect(satirlar(b)).toEqual([
      ['01.10.2026', 'SAYIM_01_10.xlsx', '01.10.2026 10:12'],
      ['30.09.2026', 'SAYIM_30_09.xlsx', '01.10.2026 09:12'],
    ]);
  });

  it('aynı gün yeniden hazırlanınca kaydı çoğalmaz, saati yenilenir', async () => {
    const ilk = await hazirla(await depoKontrolBaytlari(), tarih(2026, 9, 30), 'SAYIM_30_09.xlsx');
    const wb = await ac(await hazirla(ilk, tarih(2026, 9, 30), 'SAYIM_30_09_duzeltilmis.xlsx', 11));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Ana Sayfa',
      '28.09',
      '29.09',
      '30.09',
      'Bilgilendirme',
    ]);
    const b = wb.getWorksheet('Bilgilendirme');
    if (!b) throw new Error('Bilgilendirme yok');
    expect(satirlar(b)).toEqual([['30.09.2026', 'SAYIM_30_09_duzeltilmis.xlsx', '01.10.2026 11:12']]);
  });

  it('1.19.0 düzenindeki Bilgilendirme yeni görünüme geçer, kayıt satırları korunur', async () => {
    const wb = await ac(await depoKontrolBaytlari());
    const eski = wb.addWorksheet('Bilgilendirme');
    eski.getCell('A1').value = 'BİLGİLENDİRME';
    eski.getCell('A9').value = 'Okudum, 29.09 gün sayfasına geç →';
    eski.getCell('A11').value = 'Rapor kaydı';
    ['Gün', 'Sayım fişi', 'Hazırlanma'].forEach((d, i) => (eski.getCell(12, i + 1).value = d));
    ['29.09.2026', 'SAYIM_29_09.xlsx', '30.09.2026 08:00'].forEach(
      (d, i) => (eski.getCell(13, i + 1).value = d),
    );
    const bayt = await hazirla(await kitapYaz(wb), tarih(2026, 9, 30), 'SAYIM_30_09.xlsx');
    const b = (await ac(bayt)).getWorksheet('Bilgilendirme');
    if (!b) throw new Error('Bilgilendirme yok');
    expect(b.getCell('A1').value).toBeNull();
    expect(b.getCell('B2').value).toBe('BİLGİLENDİRME');
    expect(satirlar(b)).toEqual([
      ['30.09.2026', 'SAYIM_30_09.xlsx', '01.10.2026 09:12'],
      ['29.09.2026', 'SAYIM_29_09.xlsx', '30.09.2026 08:00'],
    ]);
  });

  it('kullanıcının kendi alt bilgisine dokunulmaz', async () => {
    const wb = await ac(await depoKontrolBaytlari());
    const s = wb.getWorksheet('29.09');
    if (!s) throw new Error('29.09 yok');
    s.headerFooter = { ...s.headerFooter, oddFooter: '&RSayfa &P' };
    const cikti = await ac(await hazirla(await kitapYaz(wb), tarih(2026, 9, 30)));
    expect(cikti.getWorksheet('30.09')?.headerFooter.oddFooter).toBe('&RSayfa &P');
    expect(cikti.getWorksheet('30.09')?.getCell(1, 10).value).toBe(
      'Depo sayımı, depo sorumlusunun 30.09.2026 sayımından alınmıştır.',
    );
  });

  it('aynı adda kullanıcının kendi sayfası varsa önizleme durur, dosyaya dokunulmaz', async () => {
    const wb = await ac(await depoKontrolBaytlari());
    wb.addWorksheet('BİLGİLENDİRME').getCell('A1').value = 'Benim notlarım';
    const hedef = await kitapAc(await kitapYaz(wb), 'DEPO KONTROL.xlsx');
    const secim = gunSec(hedefiIncele(hedef, AYAR, BUGUN).gunler, tarih(2026, 9, 30));
    expect(() => planla(hedef, secim, kaynaklar(), AYAR)).toThrow(/adında başka bir sayfa var/);
  });
});

describe('iç bağlantı düzeltmesi', () => {
  it('iç bağlantının dış ilişkisi silinir, gerçek dış bağlantıya dokunulmaz', async () => {
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet('Yapay');
    wb.addWorksheet('30.09');
    s.getCell('A1').value = { text: 'iç', hyperlink: "'30.09'!A1" };
    s.getCell('A2').value = { text: 'dış', hyperlink: 'https://ornek.invalid/yapay' };
    const bayt = await kitapYaz(wb);
    const xml = await xlsxParcasi(bayt, 'xl/worksheets/sheet1.xml');
    expect(xml).toContain('<hyperlink ref="A1" location="&apos;30.09&apos;!A1"/>');
    expect(xml).toMatch(/<hyperlink ref="A2" r:id="rId\d+"\/>/);
    const iliski = await xlsxParcasi(bayt, 'xl/worksheets/_rels/sheet1.xml.rels');
    expect(iliski).toContain('https://ornek.invalid/yapay');
    expect(iliski).not.toContain('30.09');
    expect((await ac(bayt)).getWorksheet('Yapay')?.getCell('A2').hyperlink).toBe(
      'https://ornek.invalid/yapay',
    );
  });
});
