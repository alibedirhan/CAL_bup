// Gerçek dosyalarla uçtan uca: LED dosyaları ExcelJS ile okunur, depo kontrol dosyasında
// 30.09 sayfası silinip yeni program tarafından yeniden oluşturulur. Sonuç, kullanıcının
// elle hazırladığı 30.09 sayfasıyla hücre hücre karşılaştırılır. Dosyalar ornekler/ altında
// (git dışı); yoksa testler atlanır. Çıktı incelemek için ornekler/cikti_<gün>.xlsx'e yazılır.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import type { Tarih } from '../../src/cekirdek/tarih';
import { kitapYaz } from '../../src/hedef/sayfa';
import { hucreDegeri, kitapAc, type AcikKitap } from '../../src/kaynaklar/excel';
import { dosyaTuru } from '../../src/kaynaklar/tani';
import { gunSec } from '../../src/raporlar/depoKontrol/gunSecimi';
import type { DepoKontrolPlani } from '../../src/raporlar/depoKontrol/hesapla';
import { hedefiIncele, kaynaklariOku, planla, uygula } from '../../src/raporlar/depoKontrol/islem';
import { tarihleriDenetle } from '../../src/raporlar/depoKontrol/tarihDenetimi';
import { xlsxParcalari, xlsxParcasi } from '../yardimci/xml';

const ORN = fileURLToPath(new URL('../../ornekler/', import.meta.url));
const IKIZ = join(ORN, 'ikiz.json');
const BEKLENEN = join(ORN, 'beklenen.json');

function bul(...parcalar: string[]): string | null {
  if (!existsSync(ORN)) return null;
  const ad = readdirSync(ORN).find((f) => {
    const n = f.normalize('NFC').toLocaleUpperCase('tr');
    return /\.xlsx$/i.test(f) && !n.startsWith('ÇIKTI') && parcalar.every((p) => n.includes(p));
  });
  return ad ? join(ORN, ad) : null;
}

const YOLLAR = { d01: bul('D01'), sayim: bul('SAYIM'), sube: bul('ŞUBE'), hedef: bul('DEPO', 'KONTROL') };
const VAR = Object.values(YOLLAR).every(Boolean) && existsSync(IKIZ) && existsSync(BEKLENEN);

const ac = (yol: string | null) => kitapAc(readFileSync(yol ?? ''), yol?.split('/').pop() ?? '');

describe.skipIf(!VAR)('gerçek dosyalarla yeni gün (Excel okuma ve yazma)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON şeması tools/ikiz_aktar.py'de
  const ikiz: any = VAR ? JSON.parse(readFileSync(IKIZ, 'utf8')) : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beklenen: any = VAR ? JSON.parse(readFileSync(BEKLENEN, 'utf8')) : {};
  const gun: string = ikiz.gun;

  let led: { d01: AcikKitap; sayim: AcikKitap; sube: AcikKitap };
  let elle: ExcelJS.Worksheet;
  let asil: ExcelJS.Workbook;
  let plan: DepoKontrolPlani;
  let bayt: Uint8Array;
  let cikti: ExcelJS.Workbook;
  let ws: ExcelJS.Worksheet;

  beforeAll(async () => {
    led = { d01: await ac(YOLLAR.d01), sayim: await ac(YOLLAR.sayim), sube: await ac(YOLLAR.sube) };

    // Kullanıcının dosyası: elle hazırlanmış gün sayfası karşılaştırma için ayrı açılır
    asil = (await ac(YOLLAR.hedef)).excel;
    const e = asil.getWorksheet(gun);
    if (!e) throw new Error(`${gun} sayfası yok`);
    elle = e;

    // Senaryo: gün sayfası silinmiş dosya
    const once = await ac(YOLLAR.hedef);
    once.excel.removeWorksheet(once.excel.getWorksheet(gun)?.id ?? -1);
    const hedef = await kitapAc(await kitapYaz(once.excel), 'YENİ GÜNLÜK DEPO KONTROL.xlsx');

    const bugun = ikiz.bugun as Tarih;
    const bilgi = hedefiIncele(hedef, AYAR, bugun);
    expect(bilgi.oneri).toBe(ikiz.yeniTarih);
    const secim = gunSec(bilgi.gunler, bilgi.oneri);
    expect(secim).toMatchObject({ tur: 'yeni', ad: gun, onceki: { ad: ikiz.oncekiGun } });

    const kaynaklar = kaynaklariOku(
      { d01: led.d01.kitap, sayim: led.sayim.kitap, sube: led.sube.kitap },
      AYAR,
      bugun,
    );
    const denetimler = tarihleriDenetle(kaynaklar, secim.tarih, secim.onceki.tarih);
    expect(denetimler.map((d) => d.durum)).toEqual(['uygun', 'uygun', 'uygun']);
    plan = planla(hedef, secim, kaynaklar, AYAR, denetimler);
    uygula(hedef, secim, plan, AYAR);
    bayt = await kitapYaz(hedef.excel);
    writeFileSync(join(ORN, `cikti_${gun}.xlsx`), bayt);
    cikti = (await kitapAc(bayt, 'cikti.xlsx')).excel;
    const y = cikti.getWorksheet(gun);
    if (!y) throw new Error('yeni sayfa yok');
    ws = y;
  });

  it('LED dosyaları içeriğinden tanınır', () => {
    expect(dosyaTuru(led.d01.kitap, AYAR)).toBe('d01');
    expect(dosyaTuru(led.sayim.kitap, AYAR)).toBe('sayim');
    expect(dosyaTuru(led.sube.kitap, AYAR)).toBe('subeAlis');
  });

  it('Excel dosyasından okunan plan Python ikiziyle birebir aynı', () => {
    expect(plan.satirlar.map((s) => [s.ad, s.b, s.d, s.eklendi])).toEqual(ikiz.ikiz.satirlar);
    expect(plan.kontroller.slice(0, 3).map((k) => k.durum)).toEqual(['Tamam', 'Tamam', 'Tamam']);
  });

  it('doğrulanmış rakamlar çıkar', () => {
    expect([plan.bToplam, plan.dToplam, plan.gelenMal]).toEqual([
      beklenen.bToplam,
      beklenen.dToplam,
      beklenen.gelenMal,
    ]);
    expect(plan.eklenenler).toEqual([beklenen.eklenen]);
    expect(plan.genelDurum).toBe(beklenen.genelDurum);
  });

  it('yeni sayfa önceki günün arkasında, son sayfa olarak durur', () => {
    const adlar = cikti.worksheets.map((w) => w.name);
    expect(adlar).toEqual(asil.worksheets.map((w) => w.name));
  });

  it('elle hazırlanan sayfayla aynı ürün listesi ve miktarlar (bilinen tek fark hariç)', () => {
    const farklar: string[] = [];
    const ilk = AYAR.hedefIlkSatir;
    for (let r = ilk; r <= plan.toplamSatiri; r++) {
      const a = (c: number) => hucreDegeri(ws.getCell(r, c).value);
      const e = (c: number) => hucreDegeri(elle.getCell(r, c).value);
      if (a(1) !== e(1)) farklar.push(`satır ${r} ad: ${String(e(1))} / ${String(a(1))}`);
      for (const c of [2, 4]) {
        const fark = Math.abs(Number(a(c) ?? 0) - Number(e(c) ?? 0));
        if (r < plan.toplamSatiri && fark > 5e-4)
          farklar.push(`satır ${r} ${a(1)} sütun ${c}: elle ${e(c)} / araç ${a(c)}`);
      }
    }
    expect(farklar).toHaveLength(1);
    expect(farklar[0]).toContain(beklenen.ornekSatir.ad);
    expect(farklar[0]).toContain(`araç ${beklenen.ornekSatir.b}`);
  });

  it('formüller elle hazırlanan sayfadakiyle aynı yerlere bakar', () => {
    const t = plan.toplamSatiri;
    const f = (w: ExcelJS.Worksheet, adres: string) => w.getCell(adres).formula?.replace(/^\+/, '');
    for (const adres of [`B${t}`, `D${t}`, 'B2', 'D2', 'E2', 'H2', 'I2', 'J2']) {
      expect(f(ws, adres), adres).toBe(f(elle, adres));
    }
    // Elle hazırlanan sayfada E toplamı son satırı kapsamıyor (eklemeden sonra güncellenmemiş);
    // araç her seferinde bütün listeyi kapsayacak şekilde yeniden yazar.
    expect(f(ws, `E${t}`)).toBe(`SUM(E4:E${t - 1})`);
    for (const r of [4, 105, 106, 107, t - 1]) {
      expect(f(ws, `C${r}`)).toBe(`A${r}`);
      expect(f(ws, `E${r}`)).toBe(`B${r}-D${r}`);
    }
  });

  it('başlık tarihleri yeni güne geçer', () => {
    for (const adres of ['A2', 'C2', 'A3', 'C3']) {
      const a = String(hucreDegeri(ws.getCell(adres).value));
      const e = String(hucreDegeri(elle.getCell(adres).value));
      expect(a.slice(0, 10), adres).toBe(e.slice(0, 10));
    }
  });

  it('biçim: birleşik hücreler, sütun genişlikleri, satır kenarlıkları', () => {
    const birlesik = (w: ExcelJS.Worksheet) => [...((w.model as { merges?: string[] }).merges ?? [])].sort();
    expect(birlesik(ws)).toEqual(birlesik(elle));
    for (let c = 1; c <= 10; c++) {
      expect(ws.getColumn(c).width ?? 0, `sütun ${c}`).toBeCloseTo(elle.getColumn(c).width ?? 0, 3);
    }
    const eklenen = beklenen.eklenen.satir as number;
    for (let c = 1; c <= 5; c++) {
      expect(ws.getCell(eklenen, c).style.border, `eklenen satır sütun ${c}`).toEqual(
        ws.getCell(eklenen - 1, c).style.border,
      );
    }
  });

  it('yalnızca yeni sayfa seçili ve açık', async () => {
    const sira = cikti.worksheets.findIndex((w) => w.name === gun);
    expect(await xlsxParcasi(bayt, 'xl/workbook.xml')).toMatch(new RegExp(`activeTab="${sira}"`));
    const sayfalar = await xlsxParcalari(bayt, /^xl\/worksheets\/sheet\d+\.xml$/);
    expect(sayfalar).toHaveLength(cikti.worksheets.length);
    expect(sayfalar.filter((x) => x.includes('tabSelected="1"'))).toHaveLength(1);
  });

  it('diğer bütün sayfalar hiç değişmez', () => {
    for (const a of asil.worksheets) {
      if (a.name === gun) continue;
      const b = cikti.getWorksheet(a.name);
      expect(b, a.name).toBeDefined();
      if (!b) continue;
      const satir = Math.max(a.rowCount, b.rowCount);
      const sutun = Math.max(a.columnCount, b.columnCount);
      for (let r = 1; r <= satir; r++) {
        for (let c = 1; c <= sutun; c++) {
          const x: ExcelJS.Cell = a.getCell(r, c);
          const y: ExcelJS.Cell = b.getCell(r, c);
          const deger = (h: ExcelJS.Cell) => (h.type === 6 ? `=${h.formula}` : hucreDegeri(h.value));
          if (deger(x) !== deger(y)) {
            expect.fail(`${a.name}!${x.address}: ${String(deger(x))} → ${String(deger(y))}`);
          }
        }
      }
      for (let c = 1; c <= sutun; c++) {
        expect(b.getColumn(c).width ?? 0, `${a.name} sütun ${c}`).toBeCloseTo(a.getColumn(c).width ?? 0, 3);
      }
    }
  });
});
