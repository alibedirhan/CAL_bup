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

const satirlar = (ws: ExcelJS.Worksheet, ilk: number) => {
  const sonuc: unknown[][] = [];
  for (let r = ilk; ws.getCell(r, 1).value; r++) sonuc.push([1, 2, 3].map((c) => ws.getCell(r, c).value));
  return sonuc;
};

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
    expect(b.getCell('A1').value).toBe('BİLGİLENDİRME');
    expect(BILGI_METNI.map((_, i) => b.getCell(3 + i, 1).value)).toEqual([...BILGI_METNI]);
    const baglanti = b.getCell(3 + BILGI_METNI.length + 1, 1);
    expect(baglanti.formula).toBe('HYPERLINK("#\'30.09\'!A1","Okudum, 30.09 gün sayfasına geç →")');
    expect(baglanti.result).toBe('Okudum, 30.09 gün sayfasına geç →');
    // Makro ve dış bağlantı ilişkisi yok; bağlantı yalnız formüldür
    expect(await xlsxParcalari(bayt, /vbaProject/)).toHaveLength(0);
    for (const x of await xlsxParcalari(bayt, /^xl\/worksheets\/_rels\//))
      expect(x).not.toMatch(/hyperlink/i);
    const ilk = 3 + BILGI_METNI.length + 5;
    expect(b.getCell(ilk - 1, 1).value).toBe('Gün');
    expect(satirlar(b, ilk)).toEqual([['30.09.2026', 'SAYIM_30_09.xlsx', '01.10.2026 09:12']]);

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
    expect(b.getCell(3 + BILGI_METNI.length + 1, 1).formula).toContain("#'01.10'!A1");
    expect(satirlar(b, 3 + BILGI_METNI.length + 5)).toEqual([
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
    expect(satirlar(b, 3 + BILGI_METNI.length + 5)).toEqual([
      ['30.09.2026', 'SAYIM_30_09_duzeltilmis.xlsx', '01.10.2026 11:12'],
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
