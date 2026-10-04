// Günlük depo kontrol ekranının durumu. Kullanıcının yaptıkları (dosya seçme, tarih yazma,
// onaylar) burada tutulur; ekranda görünen her şey `turet` ile bu durumdan hesaplanır.

import type { Ayarlar } from '../../cekirdek/ayarlar';
import { KullaniciHatasi } from '../../cekirdek/hata';
import type { KaynakVeri } from '../../cekirdek/kaynakVeri';
import { girilenTarih, yilOf, type Tarih } from '../../cekirdek/tarih';
import type { AcikKitap } from '../../kaynaklar/excel';
import type { Kitap } from '../../kaynaklar/kitap';
import { d01Oku, sayimOku, subeAlisOku } from '../../kaynaklar/led';
import { gunSec, tarihOnerisi, type GunSecimi } from './gunSecimi';
import type { DepoKontrolPlani } from './hesapla';
import type { HedefBilgisi } from './islem';
import { tarihleriDenetle, type TarihDenetimi } from './tarihDenetimi';
import { hedefTarihleri } from './hedefTarihleri';

export type KaynakTuru = 'd01' | 'sayim' | 'subeAlis';
export const KAYNAK_TURLERI: readonly KaynakTuru[] = ['d01', 'sayim', 'subeAlis'];

export interface HedefDosya {
  ad: string;
  bayt: Uint8Array;
  sonDegisiklik: number;
  tanitici?: FileSystemFileHandle;
  acik: AcikKitap;
  bilgi: HedefBilgisi;
  onayliSonYil?: number;
}

export interface YuklenenKaynak {
  dosyaAdi: string;
  kitap: Kitap;
  bayt?: Uint8Array;
}

export interface Oturum {
  hedef: HedefDosya | null;
  /** Kullanıcının yazdığı tarih; boşsa öneri kullanılır. */
  tarihGirdisi: string;
  yilGirdisi: string;
  yilOnayi: boolean;
  /** Seçilen günün sayfası zaten varsa üzerine yazma onayı. */
  mevcutOnayi: boolean;
  kaynaklar: Partial<Record<KaynakTuru, YuklenenKaynak>>;
  /** Tarihi uyuşmadığı hâlde kullanıcının onayladığı kaynaklar ("D01", "Sayım fişi", "Şube alış"). */
  onaylananTarihler: string[];
  /** Tanınmayan dosyalar ve nedenleri. */
  reddedilenler: { dosyaAdi: string; mesaj: string }[];
}

export const BOS_OTURUM: Oturum = {
  hedef: null,
  tarihGirdisi: '',
  yilGirdisi: '',
  yilOnayi: false,
  mevcutOnayi: false,
  kaynaklar: {},
  onaylananTarihler: [],
  reddedilenler: [],
};

export type Eylem =
  | { tur: 'ayarlarDegisti'; pazarAtla: boolean }
  | { tur: 'hedefYuklendi'; hedef: HedefDosya }
  | { tur: 'hedefKaldirildi' }
  | { tur: 'tarihDegisti'; girdi: string }
  | { tur: 'yilDegisti'; girdi: string }
  | { tur: 'yilOnaylandi' }
  | { tur: 'mevcutOnaylandi' }
  | {
      tur: 'kaynaklarEklendi';
      kaynaklar: Partial<Record<KaynakTuru, YuklenenKaynak>>;
      reddedilenler: Oturum['reddedilenler'];
    }
  | { tur: 'kaynakKaldirildi'; kaynak: KaynakTuru }
  | { tur: 'tarihOnaylandi'; kaynak: string }
  | { tur: 'kaydedildi'; hedef: HedefDosya };

export function azalt(o: Oturum, e: Eylem): Oturum {
  switch (e.tur) {
    case 'ayarlarDegisti':
      return {
        ...o,
        mevcutOnayi: false,
        onaylananTarihler: [],
        hedef: o.hedef
          ? {
              ...o.hedef,
              bilgi: { ...o.hedef.bilgi, oneri: tarihOnerisi(o.hedef.bilgi.gunler, e.pazarAtla) },
            }
          : null,
      };
    case 'hedefYuklendi':
      return {
        ...o,
        hedef: e.hedef,
        tarihGirdisi: '',
        yilGirdisi: String(yilOf(e.hedef.bilgi.son.tarih)),
        yilOnayi: false,
        mevcutOnayi: false,
        onaylananTarihler: [],
      };
    case 'hedefKaldirildi':
      return {
        ...o,
        hedef: null,
        tarihGirdisi: '',
        yilGirdisi: '',
        yilOnayi: false,
        mevcutOnayi: false,
        onaylananTarihler: [],
      };
    case 'yilDegisti': {
      const hedef = o.hedef ? { ...o.hedef } : null;
      if (hedef) delete hedef.onayliSonYil;
      return {
        ...o,
        hedef,
        yilGirdisi: e.girdi,
        yilOnayi: false,
        tarihGirdisi: '',
        mevcutOnayi: false,
        onaylananTarihler: [],
      };
    }
    case 'yilOnaylandi':
      if (!o.hedef || !/^\d{4}$/.test(o.yilGirdisi)) return o;
      try {
        hedefTarihleri(o.hedef.acik.kitap.sayfalar, o.hedef.bilgi.son.tarih, Number(o.yilGirdisi));
        return { ...o, hedef: { ...o.hedef, onayliSonYil: Number(o.yilGirdisi) }, yilOnayi: true };
      } catch {
        return o;
      }
    case 'tarihDegisti':
      return { ...o, tarihGirdisi: e.girdi, mevcutOnayi: false, onaylananTarihler: [] };
    case 'mevcutOnaylandi':
      return { ...o, mevcutOnayi: true };
    case 'kaynaklarEklendi': {
      const degisen = new Set(Object.keys(e.kaynaklar));
      return {
        ...o,
        kaynaklar: { ...o.kaynaklar, ...e.kaynaklar },
        // Değişen dosyanın eski tarih onayı geçersiz olur
        onaylananTarihler: o.onaylananTarihler.filter((k) => !degisen.has(KAYNAK_ADINDAN[k] ?? '')),
        reddedilenler: e.reddedilenler,
      };
    }
    case 'kaynakKaldirildi': {
      const kaynaklar = Object.fromEntries(
        Object.entries(o.kaynaklar).filter(([tur]) => tur !== e.kaynak),
      ) as Oturum['kaynaklar'];
      return {
        ...o,
        kaynaklar,
        onaylananTarihler: o.onaylananTarihler.filter((k) => KAYNAK_ADINDAN[k] !== e.kaynak),
      };
    }
    case 'tarihOnaylandi':
      return { ...o, onaylananTarihler: [...new Set([...o.onaylananTarihler, e.kaynak])] };
    case 'kaydedildi':
      // Aynı dosyayla ertesi güne geçilebilsin diye hedef yenilenir, LED dosyaları boşalır
      return { ...BOS_OTURUM, hedef: e.hedef };
  }
}

/** Tarih denetimindeki kaynak adı → dosya türü */
const KAYNAK_ADINDAN: Record<string, KaynakTuru> = {
  D01: 'd01',
  'Sayım fişi': 'sayim',
  'Şube alış': 'subeAlis',
};

export type Adim = 1 | 2 | 3 | 4 | 5;

export interface Gorunum {
  /** Şu an tamamlanması gereken adım: 1 dosya, 2 tarih, 3 LED dosyaları, 4 kontrol, 5 kaydet. */
  adim: Adim;
  tarih: Tarih | null;
  oneri: Tarih | null;
  tarihHatasi: string | null;
  secim: GunSecimi | null;
  mevcutOnayiGerekli: boolean;
  yilOnayiGerekli: boolean;
  okunan: Partial<Record<KaynakTuru, KaynakVeri>>;
  okumaHatalari: Partial<Record<KaynakTuru, string>>;
  denetimler: TarihDenetimi[];
  onayBekleyenler: TarihDenetimi[];
  plan: DepoKontrolPlani | null;
  planHatasi: string | null;
  kaydedilebilir: boolean;
}

type Planlayici = (
  hedef: AcikKitap,
  secim: GunSecimi,
  k: { d01: KaynakVeri; sayim: KaynakVeri; sube: KaynakVeri },
  ayarlar: Ayarlar,
  denetimler: readonly TarihDenetimi[],
) => DepoKontrolPlani;

function mesaj(e: unknown): string {
  return e instanceof KullaniciHatasi
    ? e.message
    : 'Rapor hazırlanamadı. Dosya düzenini ve ayarları kontrol edin.';
}

/** Ekranın gösterdiği her şey. `planla` motor yüklenmeden önce verilmeyebilir. */
export function turet(o: Oturum, ayarlar: Ayarlar, bugun: Tarih, planla?: Planlayici): Gorunum {
  const g: Gorunum = {
    adim: 1,
    tarih: null,
    oneri: null,
    tarihHatasi: null,
    secim: null,
    mevcutOnayiGerekli: false,
    yilOnayiGerekli: false,
    okunan: {},
    okumaHatalari: {},
    denetimler: [],
    onayBekleyenler: [],
    plan: null,
    planHatasi: null,
    kaydedilebilir: false,
  };

  // LED dosyaları hedeften bağımsız okunur, böylece sıra fark etmez
  const okuyucular: Record<KaynakTuru, (k: Kitap) => KaynakVeri> = {
    d01: (k) => d01Oku(k, ayarlar),
    sayim: (k) => sayimOku(k, ayarlar, bugun),
    subeAlis: (k) => subeAlisOku(k, ayarlar),
  };
  for (const tur of KAYNAK_TURLERI) {
    const y = o.kaynaklar[tur];
    if (!y) continue;
    try {
      g.okunan[tur] = okuyucular[tur](y.kitap);
    } catch (e) {
      g.okumaHatalari[tur] = mesaj(e);
    }
  }

  if (!o.hedef) return g;
  g.adim = 2;

  let gunler = o.hedef.bilgi.gunler;
  if (o.hedef.bilgi.yilKaynagi === 'tahmin') {
    g.yilOnayiGerekli = !o.yilOnayi;
    try {
      if (!/^\d{4}$/.test(o.yilGirdisi)) throw new KullaniciHatasi('Dosya yılını dört rakamla yazın.');
      gunler = hedefTarihleri(o.hedef.acik.kitap.sayfalar, bugun, Number(o.yilGirdisi)).gunler;
    } catch (e) {
      g.tarihHatasi = mesaj(e);
      return g;
    }
  }
  const oneri = tarihOnerisi(gunler, ayarlar.pazarAtla);
  g.oneri = oneri;
  if (g.yilOnayiGerekli) return g;
  g.tarih = o.tarihGirdisi.trim() ? girilenTarih(o.tarihGirdisi, oneri) : oneri;
  if (!g.tarih) {
    g.tarihHatasi = 'Tarih anlaşılamadı. Örnek: 30.09';
    return g;
  }
  try {
    g.secim = gunSec(gunler, g.tarih);
  } catch (e) {
    g.tarihHatasi = mesaj(e);
    return g;
  }
  g.mevcutOnayiGerekli = g.secim.tur === 'mevcut' && !o.mevcutOnayi;
  if (g.mevcutOnayiGerekli) return g;
  g.adim = 3;

  const { d01, sayim, subeAlis: sube } = g.okunan;
  if (!d01 || !sayim || !sube) return g;

  g.denetimler = tarihleriDenetle({ d01, sayim, sube }, g.secim.tarih, g.secim.onceki.tarih);
  g.onayBekleyenler = g.denetimler.filter(
    (d) => d.durum === 'uyusmuyor' && !o.onaylananTarihler.includes(d.kaynak),
  );
  if (g.onayBekleyenler.length > 0 || !planla) return g;
  g.adim = 4;

  try {
    g.plan = planla(o.hedef.acik, g.secim, { d01, sayim, sube }, ayarlar, g.denetimler);
  } catch (e) {
    g.planHatasi = mesaj(e);
    return g;
  }
  g.adim = 5;
  g.kaydedilebilir = true;
  return g;
}
