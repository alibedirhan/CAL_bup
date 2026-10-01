import { beforeAll, describe, expect, it } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import { tarih } from '../../src/cekirdek/tarih';
import { hedefiIncele, kitapAc, planla } from '../../src/raporlar/depoKontrol/motor';
import {
  azalt,
  BOS_OTURUM,
  turet,
  type HedefDosya,
  type Oturum,
} from '../../src/raporlar/depoKontrol/oturum';
import { depoKontrolBaytlari } from '../yardimci/depoKontrolExcel';
import { d01Kitap, sayimKitap, subeKitap } from '../yardimci/sentetik';

const BUGUN = tarih(2026, 10, 1);
let hedef: HedefDosya;

beforeAll(async () => {
  const bayt = await depoKontrolBaytlari();
  const acik = await kitapAc(bayt, 'DEPO.xlsx');
  hedef = { ad: 'DEPO.xlsx', bayt, sonDegisiklik: 0, acik, bilgi: hedefiIncele(acik, AYAR, BUGUN) };
});

const gor = (o: Oturum) => turet(o, AYAR, BUGUN, planla);
const kaynaklarla = (o: Oturum, sayimAdi = 'SAYIM_30_09.xlsx') =>
  azalt(o, {
    tur: 'kaynaklarEklendi',
    kaynaklar: {
      d01: { dosyaAdi: 'd01.xlsx', kitap: d01Kitap() },
      sayim: { dosyaAdi: sayimAdi, kitap: sayimKitap(sayimAdi) },
      subeAlis: { dosyaAdi: 'sube.xlsx', kitap: subeKitap() },
    },
    reddedilenler: [],
  });

describe('depo kontrol oturumu', () => {
  it('boşken ilk adım depo kontrol dosyası', () => {
    expect(gor(BOS_OTURUM).adim).toBe(1);
  });

  it('dosya yüklenince önerilen tarih gelir, LED dosyaları beklenir', () => {
    const g = gor(azalt(BOS_OTURUM, { tur: 'hedefYuklendi', hedef }));
    expect(g.tarih).toBe(tarih(2026, 9, 30));
    expect(g.secim?.tur).toBe('yeni');
    expect(g.adim).toBe(3);
  });

  it('LED dosyaları önce bırakılsa da olur; hepsi tamamsa kaydetmeye hazır', () => {
    let o = kaynaklarla(BOS_OTURUM);
    expect(gor(o).adim).toBe(1);
    o = azalt(o, { tur: 'hedefYuklendi', hedef });
    const g = gor(o);
    expect(g.adim).toBe(5);
    expect(g.kaydedilebilir).toBe(true);
    expect(g.plan?.eklenenler.map((e) => e.ad)).toEqual(['YENİ ÜRÜN']);
  });

  it('anlaşılmayan ya da geçersiz tarih', () => {
    const o = azalt(BOS_OTURUM, { tur: 'hedefYuklendi', hedef });
    expect(gor(azalt(o, { tur: 'tarihDegisti', girdi: 'yarın' })).tarihHatasi).toMatch(/anlaşılamadı/);
    expect(gor(azalt(o, { tur: 'tarihDegisti', girdi: '27.09' })).tarihHatasi).toMatch(/son sayfadan/);
  });

  it('var olan gün için üzerine yazma onayı beklenir', () => {
    let o = kaynaklarla(azalt(BOS_OTURUM, { tur: 'hedefYuklendi', hedef }));
    o = azalt(o, { tur: 'tarihDegisti', girdi: '29.09' });
    expect(gor(o).mevcutOnayiGerekli).toBe(true);
    expect(gor(o).adim).toBe(2);
    o = azalt(o, { tur: 'mevcutOnaylandi' });
    expect(gor(o).mevcutOnayiGerekli).toBe(false);
    // 29.09 için D01/sayım 30.09 tarihli, şube 29.09 (beklenen 28.09): üçü de onay bekler
    expect(gor(o).onayBekleyenler.map((d) => d.kaynak)).toEqual(['D01', 'Sayım fişi', 'Şube alış']);
  });

  it('tarihi uymayan dosya onaylanınca devam edilir ve uyarı olarak geçer', () => {
    let o = kaynaklarla(azalt(BOS_OTURUM, { tur: 'hedefYuklendi', hedef }), 'SAYIM_29_09.xlsx');
    expect(gor(o).onayBekleyenler.map((d) => d.kaynak)).toEqual(['Sayım fişi']);
    expect(gor(o).adim).toBe(3);
    o = azalt(o, { tur: 'tarihOnaylandi', kaynak: 'Sayım fişi' });
    const g = gor(o);
    expect(g.adim).toBe(5);
    expect(g.plan?.uyarilar[0]).toMatch(/^Sayım fişi: dosya tarihi 29\.09\.2026/);
  });

  it('dosya değişince eski tarih onayı düşer', () => {
    let o = kaynaklarla(azalt(BOS_OTURUM, { tur: 'hedefYuklendi', hedef }), 'SAYIM_29_09.xlsx');
    o = azalt(o, { tur: 'tarihOnaylandi', kaynak: 'Sayım fişi' });
    o = azalt(o, {
      tur: 'kaynaklarEklendi',
      kaynaklar: { sayim: { dosyaAdi: 'SAYIM_28_09.xlsx', kitap: sayimKitap('SAYIM_28_09.xlsx') } },
      reddedilenler: [],
    });
    expect(o.onaylananTarihler).toEqual([]);
  });

  it('yanlış türde dosya okuma hatası olarak görünür', () => {
    const o = azalt(BOS_OTURUM, {
      tur: 'kaynaklarEklendi',
      kaynaklar: { d01: { dosyaAdi: 'x.xlsx', kitap: subeKitap() } },
      reddedilenler: [],
    });
    expect(gor(o).okumaHatalari.d01).toMatch(/D01 Stok Giriş Çıkış Envanteri değil/);
  });

  it('kaydedildikten sonra LED dosyaları boşalır, depo kontrol dosyası kalır', () => {
    const o = azalt(kaynaklarla(azalt(BOS_OTURUM, { tur: 'hedefYuklendi', hedef })), {
      tur: 'kaydedildi',
      hedef,
    });
    expect(o.kaynaklar).toEqual({});
    expect(o.hedef).toBe(hedef);
  });
});
