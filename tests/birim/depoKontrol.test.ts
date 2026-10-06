import { describe, expect, it } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import type { KaynakVeri } from '../../src/cekirdek/kaynakVeri';
import { tarih } from '../../src/cekirdek/tarih';
import { d01Oku, sayimOku, subeAlisOku } from '../../src/kaynaklar/led';
import { hesapla, type DepoKontrolPlani } from '../../src/raporlar/depoKontrol/hesapla';
import { tarihleriDenetle, uyusmazlikSorusu } from '../../src/raporlar/depoKontrol/tarihDenetimi';
import { ambalajliSayimKitap, d01Kitap, LISTE, sayimKitap, subeKitap } from '../yardimci/sentetik';

const BUGUN = tarih(2026, 10, 1);

function kaynaklar() {
  return {
    d01: d01Oku(d01Kitap(), AYAR),
    sayim: sayimOku(sayimKitap(), AYAR, BUGUN),
    sube: subeAlisOku(subeKitap(), AYAR),
  };
}

function plan(degistir?: (k: ReturnType<typeof kaynaklar>) => void, ayarlar = AYAR): DepoKontrolPlani {
  const k = kaynaklar();
  degistir?.(k);
  return hesapla({ listeAdlari: LISTE, ...k, ayarlar });
}

const satir = (p: DepoKontrolPlani, ad: string, kacinci = 0) => {
  const s = p.satirlar.filter((x) => x.ad === ad)[kacinci];
  if (!s) throw new Error(`${ad} yok`);
  return s;
};

describe('günlük depo kontrol hesabı', () => {
  const p = plan();

  it('adetli ve kolili aynı ürünün kilogram toplamını raporda tek satıra yazar', () => {
    const p = plan((k) => {
      k.sayim = sayimOku(ambalajliSayimKitap(), AYAR, BUGUN);
    });
    expect(p.satirlar.filter((s) => s.ad === 'ALFA ÜRÜN')).toHaveLength(1);
    expect(satir(p, 'ALFA ÜRÜN').d).toBe(25.75);
  });

  it('üç kontrol de tutar', () => {
    expect(p.kontroller.slice(0, 3).map((k) => k.durum)).toEqual(['Tamam', 'Tamam', 'Tamam']);
    expect(p.kontroller.slice(3).map((k) => k.durum)).toEqual(['Bilgi', 'Bilgi']);
  });

  it('donuk ürün sayımda yoksa D = B', () => {
    const s = satir(p, 'DON.GAMA DÖNER(20 KG)');
    expect(s.d).toBe(s.b);
    expect(s.b).toBeCloseTo(108.68);
    expect(s.donuk).toBe(true);
    expect(p.donukToplam).toBeCloseTo(108.68);
  });

  it('donuk ürün sayımda varsa sayım kullanılır', () => {
    expect(satir(p, 'DON.DELTA').d).toBe(29);
    expect(satir(p, 'DON.DELTA').donuk).toBe(false);
  });

  it('donuk olmayan ürün sayımda yoksa D = 0', () => {
    expect(satir(p, 'YENİ ÜRÜN').d).toBe(0);
  });

  it('tekrar eden adda miktar ilk satıra yazılır', () => {
    const ikinci = satir(p, 'DON.GAMA DÖNER(20 KG)', 1);
    expect(ikinci.b).toBe(0);
    expect(ikinci.tekrar).toBe(true);
    expect(p.tekrarlar).toEqual([{ ad: 'DON.GAMA DÖNER(20 KG)', ilkSatir: 7, satir: 8 }]);
    expect(p.notlar.some((n) => n.includes('satır 7 ve 8'))).toBe(true);
  });

  it('listede olmayan ürün alfabetik yerine eklenir', () => {
    expect(p.eklenenler).toEqual([{ ad: 'YENİ ÜRÜN', satir: 9 }]);
    const adlar = p.satirlar.map((s) => s.ad);
    expect(adlar.indexOf('YENİ ÜRÜN')).toBe(adlar.indexOf('ZETA ÜRÜN') - 1);
    expect(satir(p, 'YENİ ÜRÜN').eklendi).toBe(true);
    expect(p.uyarilar).toContain('Listeye yeni ürün eklendi (satır 9): YENİ ÜRÜN');
  });

  it('miktarı sıfır olan eksik ürün eklenmez, not düşülür', () => {
    expect(p.sifirEksikler).toEqual(['SIFIR ÜRÜN']);
    expect(p.satirlar.map((s) => s.ad)).not.toContain('SIFIR ÜRÜN');
    expect(p.notlar.some((n) => n.includes('SIFIR ÜRÜN'))).toBe(true);
  });

  it('ayar açıksa sıfır miktarlı ürün de eklenir', () => {
    const p2 = plan(undefined, { ...AYAR, sifirEksikleriEkle: true });
    expect(p2.eklenenler.map((e) => e.ad)).toEqual(['YENİ ÜRÜN', 'SIFIR ÜRÜN']);
  });

  it('satır numaraları ve dip toplam satırı', () => {
    expect(p.satirlar[0]?.satir).toBe(4);
    expect(p.toplamSatiri).toBe(4 + p.satirlar.length);
  });

  it('yeni ürün eklendiği için genel durum Uyarı', () => {
    expect(p.genelDurum).toBe('Uyarı');
  });

  it('gelen mal şube alış dip toplamıdır', () => {
    expect(p.gelenMal).toBeCloseTo(1015.32);
  });
});

describe('kontrollerin yakaladıkları', () => {
  it('eksik ürün eklenmezse LED toplamı tutmaz', () => {
    // Ürünü kaynaktan sil ama dip toplamı bırak: kontrol hata vermeli
    const p = plan((k) => k.d01.miktarlar.delete('YENİ ÜRÜN'));
    expect(p.kontroller[0]?.durum).toBe('Hata');
    expect(p.genelDurum).toBe('Hata');
  });

  it('kaynak dosyanın satırları kendi dip toplamını tutmuyorsa uyarır', () => {
    const p = plan((k) => (k.sube.dipToplam = 999));
    expect(p.uyarilar.some((u) => u.startsWith('Şube alış: satırların toplamı'))).toBe(true);
  });

  it('şube alış birden fazla günü kapsıyorsa uyarır', () => {
    const p = plan((k) => (k.sube.baslangicTarihi = tarih(2026, 9, 28)));
    expect(p.uyarilar).toContain('Şube alış raporu birden fazla günü kapsıyor.');
  });

  it('şube alışta dip toplam yoksa satır toplamını kullanır ve uyarır', () => {
    const p = plan((k: { sube: KaynakVeri }) => (k.sube.dipToplamVar = false));
    expect(p.gelenMal).toBeCloseTo(1015.32);
    expect(p.uyarilar.some((u) => u.includes('dip toplam satırı bulunamadı'))).toBe(true);
  });
});

describe('tarih denetimi', () => {
  it('doğru günün dosyaları uygun', () => {
    const d = tarihleriDenetle(kaynaklar(), tarih(2026, 9, 30), tarih(2026, 9, 29));
    expect(d.map((x) => x.durum)).toEqual(['uygun', 'uygun', 'uygun']);
  });

  it('uyuşmazlık sorulur, onaylanırsa uyarı olur', () => {
    const k = kaynaklar();
    const d = tarihleriDenetle(k, tarih(2026, 10, 1), tarih(2026, 9, 30));
    expect(d.map((x) => x.durum)).toEqual(['uyusmuyor', 'uyusmuyor', 'uyusmuyor']);
    const [ilkDenetim] = d;
    if (!ilkDenetim) throw new Error('denetim yok');
    expect(uyusmazlikSorusu(ilkDenetim)).toBe(
      'D01 dosyasının tarihi 30.09.2026, beklenen 01.10.2026. Yine de bu dosyayla devam edilsin mi?',
    );
    const p = hesapla({ listeAdlari: LISTE, ...k, ayarlar: AYAR, tarihDenetimleri: d });
    expect(p.uyarilar[0]).toBe('D01: dosya tarihi 30.09.2026 (beklenen 01.10.2026), onayla devam edildi.');
  });

  it('tarihi olmayan dosya not olarak geçer', () => {
    const k = kaynaklar();
    k.sayim.tarih = null;
    const d = tarihleriDenetle(k, tarih(2026, 9, 30), tarih(2026, 9, 29));
    const p = hesapla({ listeAdlari: LISTE, ...k, ayarlar: AYAR, tarihDenetimleri: d });
    expect(p.notlar[0]).toBe('Sayım fişi: dosyada tarih bulunamadı, tarih kontrolü yapılamadı.');
  });
});

describe('atlanan gün uyarısı', () => {
  it('arada sayfası açılmamış gün varsa uyarı olarak kayda geçer', () => {
    const k = kaynaklar();
    const p = hesapla({
      listeAdlari: LISTE,
      ...k,
      ayarlar: AYAR,
      atlananGunler: [tarih(2026, 9, 29)],
      oncekiSayfa: '28.09',
    });
    expect(p.uyarilar).toContain(
      'Arada gün sayfası açılmamış: 29.09.2026. Bu gün 28.09 sayfasının devamı olarak hazırlandı.',
    );
    expect(p.genelDurum).not.toBe('Tamam');
  });

  it('atlanan gün yoksa uyarı eklenmez', () => {
    const k = kaynaklar();
    const p = hesapla({ listeAdlari: LISTE, ...k, ayarlar: AYAR, atlananGunler: [] });
    expect(p.uyarilar.some((u) => u.startsWith('Arada gün sayfası'))).toBe(false);
  });
});
