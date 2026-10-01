// Gerçek 30.09 dosyalarıyla: TypeScript kuralları eski aracın Python ikiziyle
// birebir aynı sonucu vermeli. Dosyalar ornekler/ altındadır ve git'e girmez;
// yoksa (ör. GitHub Actions'ta) bu testler atlanır. Bkz. tools/ikiz_aktar.py.

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import type { Tarih } from '../../src/cekirdek/tarih';
import { diziSayfa, type HucreDegeri, type Kitap } from '../../src/kaynaklar/kitap';
import { d01Oku, sayimOku, subeAlisOku } from '../../src/kaynaklar/led';
import { dosyaTuru } from '../../src/kaynaklar/tani';
import { hesapla } from '../../src/raporlar/depoKontrol/hesapla';
import { tarihleriDenetle } from '../../src/raporlar/depoKontrol/tarihDenetimi';

const IKIZ = new URL('../../ornekler/ikiz.json', import.meta.url);
const BEKLENEN = new URL('../../ornekler/beklenen.json', import.meta.url);
const VAR = existsSync(IKIZ) && existsSync(BEKLENEN);

interface DisaAktarilanKitap {
  dosyaAdi: string;
  olusturulma: string | null;
  sayfalar: { ad: string; satirlar: (HucreDegeri | { $tarih: string })[][] }[];
}

function kitap(k: DisaAktarilanKitap): Kitap {
  const hucre = (v: HucreDegeri | { $tarih: string }): HucreDegeri =>
    v !== null && typeof v === 'object' && '$tarih' in v ? new Date(v.$tarih) : v;
  return {
    dosyaAdi: k.dosyaAdi,
    olusturulma: k.olusturulma ? new Date(k.olusturulma) : null,
    sayfalar: k.sayfalar.map((s) =>
      diziSayfa(
        s.ad,
        s.satirlar.map((r) => r.map(hucre)),
      ),
    ),
  };
}

describe.skipIf(!VAR)('gerçek 30.09 dosyaları', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON şeması tools/ikiz_aktar.py'de
  const veri: any = VAR ? JSON.parse(readFileSync(IKIZ, 'utf8')) : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beklenen: any = VAR ? JSON.parse(readFileSync(BEKLENEN, 'utf8')) : {};
  const ikiz = veri.ikiz;
  const kitaplar = VAR
    ? {
        d01: kitap(veri.dosyalar.d01),
        sayim: kitap(veri.dosyalar.sayim),
        sube: kitap(veri.dosyalar.sube),
      }
    : null;
  const k = kitaplar && {
    d01: d01Oku(kitaplar.d01, AYAR),
    sayim: sayimOku(kitaplar.sayim, AYAR, veri.bugun as Tarih),
    sube: subeAlisOku(kitaplar.sube, AYAR),
  };
  const denetimler = k ? tarihleriDenetle(k, veri.yeniTarih, veri.oncekiTarih) : [];
  const p = k && hesapla({ listeAdlari: veri.liste, ...k, ayarlar: AYAR, tarihDenetimleri: denetimler });
  if (!kitaplar || !k || !p) return;

  it('dosyalar içeriğinden tanınır', () => {
    expect(dosyaTuru(kitaplar.d01, AYAR)).toBe('d01');
    expect(dosyaTuru(kitaplar.sayim, AYAR)).toBe('sayim');
    expect(dosyaTuru(kitaplar.sube, AYAR)).toBe('subeAlis');
  });

  it('kaynaklar ikizle aynı okunur', () => {
    for (const ad of ['d01', 'sayim', 'sube'] as const) {
      const bek = ikiz.kaynaklar[ad];
      expect(k[ad].tarih, `${ad} tarih`).toBe(bek.tarih);
      expect(k[ad].baslangicTarihi, `${ad} başlangıç`).toBe(bek.baslangicTarihi);
      expect(k[ad].dipToplamVar, `${ad} dip var`).toBe(bek.dipToplamVar);
      expect(k[ad].dipToplam, `${ad} dip`).toBeCloseTo(bek.dipToplam, 9);
      expect(k[ad].toplam(), `${ad} toplam`).toBeCloseTo(bek.toplam, 6);
      expect(k[ad].miktarlar.size, `${ad} ürün sayısı`).toBe(bek.urunSayisi);
    }
  });

  it('tarihler yeni günle uyuşur', () => {
    expect(denetimler.map((d) => d.durum)).toEqual(['uygun', 'uygun', 'uygun']);
  });

  it('her satır ikizle birebir aynı', () => {
    expect(p.satirlar).toHaveLength(ikiz.satirlar.length);
    p.satirlar.forEach((s, i) => {
      const [ad, b, d, eklendi] = ikiz.satirlar[i];
      expect([s.ad, s.b, s.d, s.eklendi], `satır ${s.satir}`).toEqual([ad, b, d, eklendi]);
    });
  });

  it('eklenen, eksik ve tekrar eden ürünler ikizle aynı', () => {
    expect(p.eklenenler.map((e) => e.ad)).toEqual(ikiz.eklenenler);
    expect(p.sifirEksikler).toEqual(ikiz.sifirEksikler);
    expect(p.tekrarlar.map((t) => [t.ilkSatir, t.satir, t.ad])).toEqual(ikiz.tekrarlar);
  });

  it('toplamlar ve kontroller ikizle aynı', () => {
    expect(p.bToplam).toBe(ikiz.bToplam);
    expect(p.dToplam).toBe(ikiz.dToplam);
    expect(p.donukToplam).toBe(ikiz.donukToplam);
    ikiz.kontroller.forEach(([ad, bek, bul, durum]: [string, number, number, string], i: number) => {
      const kt = p.kontroller[i];
      expect(kt?.ad).toBe(ad);
      expect(kt?.beklenen).toBeCloseTo(bek, 9);
      expect(kt?.bulunan).toBeCloseTo(bul, 9);
      expect(kt?.durum).toBe(durum);
    });
  });

  it('doğrulanmış 30.09 rakamları çıkar', () => {
    expect(p.bToplam).toBe(beklenen.bToplam);
    expect(p.dToplam).toBe(beklenen.dToplam);
    expect(p.gelenMal).toBe(beklenen.gelenMal);
    expect(p.satirlar).toHaveLength(beklenen.satirSayisi);
    expect(p.eklenenler).toEqual([beklenen.eklenen]);
    expect(p.genelDurum).toBe(beklenen.genelDurum);
    expect(p.uyarilar).toHaveLength(1);
    const ornek = p.satirlar.find((s) => s.ad === beklenen.ornekSatir.ad);
    expect(ornek?.b).toBe(beklenen.ornekSatir.b);
  });
});
