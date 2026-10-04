// Günlük depo kontrol sayfasını okuma ve hesap planını sayfaya yazma.
//
// Sayfa düzeni (gerçek dosyadan): A1:D1 başlık, G1 "GELEN MAL", G2 gelen mal.
// A2/C2 önceki günün, A3/C3 yeni günün tarih metinleri. B2/D2 önceki sayfanın dip toplamına
// bağlı formül. Liste 4. satırdan başlar: A ad, B LED, C =A, D sayım, E =B-D. Listenin hemen
// altında B/D/E dip toplamları (TOPLA).

import type ExcelJS from 'exceljs';
import type { Ayarlar } from '../cekirdek/ayarlar';
import { KullaniciHatasi } from '../cekirdek/hata';
import { adAnahtari, adNormal } from '../cekirdek/metin';
import { yuvarla3 } from '../cekirdek/sayi';
import { tarihDegistir, type Tarih } from '../cekirdek/tarih';
import type { DepoKontrolPlani } from '../raporlar/depoKontrol/hesapla';
import { hucreDegeri } from '../kaynaklar/excel';
import { eskiSonuclariSil, satirEkle, sayfaKopyala, sayfaSec } from './sayfa';

const EN_UZUN_LISTE = 5000;

/** Sayfanın depo kontrol sayfası olduğunu G1 başlığından doğrular. */
export function yapiDogrula(ws: ExcelJS.Worksheet, ayarlar: Ayarlar): void {
  const g1 = adNormal(hucreDegeri(ws.getCell('G1').value));
  if (g1.toLocaleUpperCase('tr') !== ayarlar.hedefKontrolBaslik.toLocaleUpperCase('tr')) {
    throw new KullaniciHatasi(
      `'${ws.name}' sayfasının yapısı tanınmadı: G1 hücresinde '${ayarlar.hedefKontrolBaslik}' başlığı bekleniyordu.`,
    );
  }
}

/** A sütunundaki listenin hemen altındaki dip toplam satırı (B'de TOPLA formülü olmalı). */
export function toplamSatiriBul(ws: ExcelJS.Worksheet, ilk: number): number {
  let r = ilk;
  while (adNormal(hucreDegeri(ws.getCell(r, 1).value)) && r < ilk + EN_UZUN_LISTE) r++;
  const b = ws.getCell(r, 2);
  if (b.type !== 6 /* ValueType.Formula */ || !/SUM\(/i.test(b.formula)) {
    throw new KullaniciHatasi(
      `'${ws.name}' sayfasında dip toplam satırı bulunamadı. A sütunundaki listenin hemen altında, ` +
        'B sütununda TOPLA formülü bekleniyordu.',
    );
  }
  return r;
}

/** Gün sayfasının ürün listesi (A sütunu, ilk satırdan dip toplama kadar). */
export function listeOku(ws: ExcelJS.Worksheet, ayarlar: Ayarlar): string[] {
  const ilk = ayarlar.hedefIlkSatir;
  const toplam = toplamSatiriBul(ws, ilk);
  const adlar: string[] = [];
  for (let r = ilk; r < toplam; r++) adlar.push(adNormal(hucreDegeri(ws.getCell(r, 1).value)));
  return adlar;
}

/** Başlıktaki tarih: hücrede gerçek tarih varsa tarih, metin varsa metnin başındaki tarih değişir. */
function baslikTarihiYaz(c: ExcelJS.Cell, t: Tarih): void {
  if (c.value instanceof Date) {
    const [y, a, g] = t.split('-').map(Number);
    c.value = new Date(Date.UTC(y ?? 0, (a ?? 1) - 1, g ?? 1));
  } else {
    c.value = tarihDegistir(hucreDegeri(c.value), t);
  }
}

function sayfaAdiBasvurusu(ad: string): string {
  return `'${ad.replace(/'/g, "''")}'`;
}

export interface YazmaGirdisi {
  wb: ExcelJS.Workbook;
  /** Yeni sayfa için önceki günün sayfası kopyalanır; mevcut sayfa yerinde doldurulur. */
  tur: 'yeni' | 'mevcut';
  /** Oluşturulacak ya da doldurulacak sayfanın adı. */
  ad: string;
  oncekiAd: string;
  oncekiTarih: Tarih;
  yeniTarih: Tarih;
  plan: DepoKontrolPlani;
  ayarlar: Ayarlar;
}

/** Planı kitaba uygular ve doldurulan sayfayı döndürür. Kitap bellekte değişir, diske yazılmaz. */
export function planiYaz(g: YazmaGirdisi): ExcelJS.Worksheet {
  const { wb, plan, ayarlar } = g;
  const ilk = ayarlar.hedefIlkSatir;
  const onceki = wb.getWorksheet(g.oncekiAd);
  if (!onceki) throw new KullaniciHatasi(`'${g.oncekiAd}' sayfası bulunamadı.`);
  yapiDogrula(onceki, ayarlar);
  const oncekiToplam = toplamSatiriBul(onceki, ilk);

  let ws: ExcelJS.Worksheet;
  if (g.tur === 'yeni') {
    ws = onceki;
  } else {
    const mevcut = wb.getWorksheet(g.ad);
    if (!mevcut) throw new KullaniciHatasi(`'${g.ad}' sayfası bulunamadı.`);
    ws = mevcut;
    yapiDogrula(ws, ayarlar);
  }

  // Liste, planın hesaplandığı listeyle aynı olmalı (dosya arada değişmemiş olmalı)
  const liste = listeOku(ws, ayarlar);
  const beklenenUzunluk = plan.satirlar.length - plan.eklenenler.length;
  const beklenenAdlar = plan.satirlar.filter((s) => !s.eklendi).map((s) => adAnahtari(s.ad));
  if (liste.length !== beklenenUzunluk || liste.some((ad, i) => adAnahtari(ad) !== beklenenAdlar[i])) {
    throw new KullaniciHatasi(`'${ws.name}' sayfasının listesi değişmiş; işlemi baştan başlatın.`);
  }

  if (g.tur === 'yeni') ws = sayfaKopyala(wb, onceki, g.ad);

  // 1. Eksik ürün satırları (plan sırasıyla; her satır numarası eklendiği andaki yerdir)
  for (const e of plan.eklenenler) satirEkle(ws, e.satir, e.satir === ilk);

  // 2. Ürün satırları
  for (const s of plan.satirlar) {
    const r = s.satir;
    if (s.eklendi) ws.getCell(r, 1).value = s.ad;
    ws.getCell(r, 2).value = s.b;
    ws.getCell(r, 3).value = { formula: `A${r}`, result: s.ad } as ExcelJS.CellFormulaValue;
    ws.getCell(r, 4).value = s.d;
    ws.getCell(r, 5).value = {
      formula: `B${r}-D${r}`,
      result: yuvarla3(s.b - s.d),
    } as ExcelJS.CellFormulaValue;
  }

  // 3. Dip toplamlar
  const t = plan.toplamSatiri;
  const son = t - 1;
  ws.getCell(t, 2).value = {
    formula: `SUM(B${ilk}:B${son})`,
    result: plan.bToplam,
  } as ExcelJS.CellFormulaValue;
  ws.getCell(t, 4).value = {
    formula: `SUM(D${ilk}:D${son})`,
    result: plan.dToplam,
  } as ExcelJS.CellFormulaValue;
  ws.getCell(t, 5).value = {
    formula: `SUM(E${ilk}:E${son})`,
    result: yuvarla3(plan.bToplam - plan.dToplam),
  } as ExcelJS.CellFormulaValue;

  // 4. Başlıklar: tarihler, önceki güne bağlantı, gelen mal
  baslikTarihiYaz(ws.getCell('A2'), g.oncekiTarih);
  baslikTarihiYaz(ws.getCell('C2'), g.oncekiTarih);
  baslikTarihiYaz(ws.getCell('A3'), g.yeniTarih);
  baslikTarihiYaz(ws.getCell('C3'), g.yeniTarih);
  const ref = sayfaAdiBasvurusu(onceki.name);
  ws.getCell('B2').value = { formula: `+${ref}!B${oncekiToplam}` };
  ws.getCell('D2').value = { formula: `+${ref}!D${oncekiToplam}` };
  ws.getCell('G2').value = plan.gelenMal;

  // Sonucunu bilmediğimiz formüllerin eski sonuçları silinir; Excel açılışta hesaplar.
  const bilinen = new Set<string>();
  for (const s of plan.satirlar) bilinen.add(`C${s.satir}`).add(`E${s.satir}`);
  for (const c of 'BDE') bilinen.add(`${c}${t}`);
  eskiSonuclariSil(ws, bilinen);

  sayfaSec(wb, ws);
  return ws;
}
