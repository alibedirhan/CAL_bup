// Günlük depo kontrol raporunun hesabı (eski aracın modRaporDepoKontrol'ü, Excel'e yazma hariç).
// Saf işlevdir: gün sayfasının ürün listesini ve üç kaynağı alır, sayfaya ne yazılacağını
// anlatan bir plan döndürür. Önizleme bu plandan çizilir, kaydetme aynı planı uygular.

import type { Ayarlar } from '../../cekirdek/ayarlar';
import type { KaynakVeri } from '../../cekirdek/kaynakVeri';
import { bilgi, genelDurum, karsilastir, type Kontrol } from '../../cekirdek/kontrol';
import { adAnahtari, adNormal, sonraGelirMi } from '../../cekirdek/metin';
import { esitMi, sayiMetni, yuvarla3 } from '../../cekirdek/sayi';
import type { Tarih } from '../../cekirdek/tarih';
import { atlananGunMetni } from './gunSecimi';
import type { TarihDenetimi } from './tarihDenetimi';
import { tarihKayitlari } from './tarihDenetimi';

export interface PlanSatiri {
  /** Sayfadaki satır numarası. */
  satir: number;
  ad: string;
  /** B sütunu: LED stoğu (D01). */
  b: number;
  /** D sütunu: depo sayımı. */
  d: number;
  /** Listede yoktu, bu çalıştırmada eklendi. */
  eklendi: boolean;
  /** Aynı ad daha yukarıda var; miktar orada, burada 0. */
  tekrar: boolean;
  /** Donuk ürün: sayım fişinde yoktu, LED miktarı yazıldı. */
  donuk: boolean;
}

export interface DepoKontrolPlani {
  satirlar: PlanSatiri[];
  /** Dip toplamın yazılacağı satır. */
  toplamSatiri: number;
  eklenenler: { ad: string; satir: number }[];
  sifirEksikler: string[];
  tekrarlar: { ad: string; ilkSatir: number; satir: number }[];
  bToplam: number;
  dToplam: number;
  donukToplam: number;
  /** G2: gelen mal (şube alış dip toplamı). */
  gelenMal: number;
  kontroller: Kontrol[];
  uyarilar: string[];
  notlar: string[];
  genelDurum: 'Tamam' | 'Uyarı' | 'Hata';
}

export interface HesapGirdisi {
  /** Gün sayfasının A sütunundaki adlar, ilk satırdan başlayarak. */
  listeAdlari: readonly string[];
  d01: KaynakVeri;
  sayim: KaynakVeri;
  sube: KaynakVeri;
  ayarlar: Ayarlar;
  tarihDenetimleri?: readonly TarihDenetimi[];
  /** Önceki sayfa ile yeni gün arasında sayfası olmayan iş günleri. */
  atlananGunler?: readonly Tarih[];
  /** Yeni günün kopyalandığı (önceki) sayfanın adı. */
  oncekiSayfa?: string;
}

export function hesapla(g: HesapGirdisi): DepoKontrolPlani {
  const { d01, sayim, sube, ayarlar } = g;
  const ilk = ayarlar.hedefIlkSatir;
  const tarihler = tarihKayitlari(g.tarihDenetimleri ?? []);
  const uyarilar = [...tarihler.uyarilar];
  const notlar = [...tarihler.notlar];
  if (g.atlananGunler?.length) {
    uyarilar.push(
      `Arada gün sayfası açılmamış: ${atlananGunMetni(g.atlananGunler)}. ` +
        `Bu gün${g.oncekiSayfa ? ` ${g.oncekiSayfa} sayfasının` : ' önceki sayfanın'} devamı olarak hazırlandı.`,
    );
  }

  if (sube.baslangicTarihi && sube.tarih && sube.baslangicTarihi !== sube.tarih) {
    uyarilar.push('Şube alış raporu birden fazla günü kapsıyor.');
  }
  if (!sube.dipToplamVar) {
    uyarilar.push('Şube alış raporunda dip toplam satırı bulunamadı; satırların toplamı kullanıldı.');
  }

  // 1. Listede olmayan ürünler
  const adlar = g.listeAdlari.map(adNormal);
  const listede = new Set(adlar.map(adAnahtari));
  const aday = new Map<string, number>();
  for (const kaynak of [d01, sayim]) {
    for (const [k, v] of kaynak.miktarlar) {
      if (!listede.has(k)) aday.set(k, (aday.get(k) ?? 0) + Math.abs(v));
    }
  }
  const eklenenler: DepoKontrolPlani['eklenenler'] = [];
  const sifirEksikler: string[] = [];
  for (const [k, v] of aday) {
    const ad = d01.adlar.get(k) ?? sayim.adlar.get(k) ?? k;
    if (v > 0.0005 || ayarlar.sifirEksikleriEkle) {
      let poz = adlar.findIndex((a) => sonraGelirMi(a, ad));
      if (poz < 0) poz = adlar.length;
      adlar.splice(poz, 0, ad);
      eklenenler.push({ ad, satir: ilk + poz });
      uyarilar.push(`Listeye yeni ürün eklendi (satır ${ilk + poz}): ${ad}`);
    } else {
      sifirEksikler.push(ad);
    }
  }
  if (sifirEksikler.length > 0) {
    notlar.push(`Listede olmayan, miktarı sıfır ürünler eklenmedi: ${sifirEksikler.join(', ')}`);
  }

  // 2. Satırlar
  const eklenenAdlar = new Set(eklenenler.map((e) => e.ad));
  const onek = adAnahtari(ayarlar.donukOnek);
  const gorulen = new Map<string, number>();
  const tekrarlar: DepoKontrolPlani['tekrarlar'] = [];
  let donukToplam = 0;
  const satirlar: PlanSatiri[] = adlar.map((ad, i) => {
    const satir = ilk + i;
    const s: PlanSatiri = {
      satir,
      ad,
      b: 0,
      d: 0,
      eklendi: eklenenAdlar.has(ad),
      tekrar: false,
      donuk: false,
    };
    const k = adAnahtari(ad);
    const ilkSatir = gorulen.get(k);
    if (ilkSatir !== undefined) {
      s.tekrar = true;
      tekrarlar.push({ ad, ilkSatir, satir });
      notlar.push(
        `Listede tekrar eden ürün (satır ${ilkSatir} ve ${satir}): ${ad}. Miktar ilk satıra yazıldı.`,
      );
      return s;
    }
    gorulen.set(k, satir);
    s.b = yuvarla3(d01.miktar(ad));
    if (sayim.icerir(ad)) {
      s.d = yuvarla3(sayim.miktar(ad));
    } else if (onek && k.startsWith(onek)) {
      s.d = s.b;
      s.donuk = true;
      donukToplam += s.b;
    }
    return s;
  });
  donukToplam = yuvarla3(donukToplam);

  // 3. Kontroller
  const bToplam = yuvarla3(satirlar.reduce((t, s) => t + s.b, 0));
  const dToplam = yuvarla3(satirlar.reduce((t, s) => t + s.d, 0));
  const gelenMal = yuvarla3(sube.esasToplam());
  const tol = ayarlar.tolerans;
  const kontroller: Kontrol[] = [
    karsilastir('LED stoğu = D01 dip toplamı', d01.esasToplam(), bToplam, tol),
    karsilastir('Depo sayımı = sayım fişi + donuk', sayim.esasToplam() + donukToplam, dToplam, tol),
    karsilastir('Gelen mal = şube alış dip toplamı', sube.esasToplam(), gelenMal, tol),
    bilgi("Donuk ürünler (sayılmadı, D01'den)", donukToplam),
    bilgi('Günlük fark (E toplamı)', yuvarla3(bToplam - dToplam)),
  ];

  // Kaynak dosya satırları kendi dip toplamını tutuyor mu?
  for (const kv of [d01, sayim, sube]) {
    if (kv.dipToplamVar && !esitMi(kv.toplam(), kv.dipToplam, tol)) {
      uyarilar.push(
        `${kv.raporTuru}: satırların toplamı (${sayiMetni(kv.toplam())}) dosyanın kendi dip toplamıyla (${sayiMetni(kv.dipToplam)}) tutmuyor.`,
      );
    }
  }

  return {
    satirlar,
    toplamSatiri: ilk + satirlar.length,
    eklenenler,
    sifirEksikler,
    tekrarlar,
    bToplam,
    dToplam,
    donukToplam,
    gelenMal,
    kontroller,
    uyarilar,
    notlar,
    genelDurum: genelDurum(kontroller, uyarilar.length),
  };
}
