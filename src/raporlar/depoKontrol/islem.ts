// Günlük depo kontrolün adımları. Arayüz bunları sırayla çağırır, araya kullanıcı
// soruları girer (tarih onayı, uyuşmayan dosya tarihi, var olan sayfanın üzerine yazma).
//
//   hedefiIncele → (tarih seçilir) gunSec → kaynaklariOku → tarihleriDenetle → planla → uygula → kitapYaz

import type { Ayarlar } from '../../cekirdek/ayarlar';
import { KullaniciHatasi } from '../../cekirdek/hata';
import type { KaynakVeri } from '../../cekirdek/kaynakVeri';
import type { Tarih } from '../../cekirdek/tarih';
import { listeOku, planiYaz, yapiDogrula } from '../../hedef/depoKontrol';
import type { AcikKitap } from '../../kaynaklar/excel';
import type { Kitap } from '../../kaynaklar/kitap';
import { d01Oku, sayimOku, subeAlisOku } from '../../kaynaklar/led';
import { depoKontrolMu } from '../../kaynaklar/tani';
import { gunSayfalari, tarihOnerisi, type GunSayfasi, type GunSecimi } from './gunSecimi';
import { hesapla, type DepoKontrolPlani } from './hesapla';
import type { TarihDenetimi } from './tarihDenetimi';

export interface HedefBilgisi {
  gunler: GunSayfasi[];
  son: GunSayfasi;
  oneri: Tarih;
}

/** Seçilen dosyanın depo kontrol dosyası olduğunu doğrular, gün sayfalarını ve önerilen tarihi verir. */
export function hedefiIncele(hedef: AcikKitap, ayarlar: Ayarlar, bugun: Tarih): HedefBilgisi {
  if (!depoKontrolMu(hedef.kitap, ayarlar)) {
    throw new KullaniciHatasi(
      `${hedef.kitap.dosyaAdi} bir günlük depo kontrol dosyası değil: G1 hücresinde ` +
        `'${ayarlar.hedefKontrolBaslik}' yazan bir gün sayfası (GG.AA) bulunamadı.`,
    );
  }
  const gunler = gunSayfalari(
    hedef.excel.worksheets.map((w) => w.name),
    bugun,
  );
  const son = gunler.at(-1);
  if (!son) throw new KullaniciHatasi('Depo kontrol dosyasında gün sayfası bulunamadı.');
  return { gunler, son, oneri: tarihOnerisi(gunler, ayarlar.pazarAtla) };
}

export interface Kaynaklar {
  d01: KaynakVeri;
  sayim: KaynakVeri;
  sube: KaynakVeri;
}

export function kaynaklariOku(
  kitaplar: { d01: Kitap; sayim: Kitap; sube: Kitap },
  ayarlar: Ayarlar,
  bugun: Tarih,
): Kaynaklar {
  return {
    d01: d01Oku(kitaplar.d01, ayarlar),
    sayim: sayimOku(kitaplar.sayim, ayarlar, bugun),
    sube: subeAlisOku(kitaplar.sube, ayarlar),
  };
}

/** Kitaba dokunmadan planı hesaplar; önizleme bundan çizilir. */
export function planla(
  hedef: AcikKitap,
  secim: GunSecimi,
  kaynaklar: Kaynaklar,
  ayarlar: Ayarlar,
  tarihDenetimleri: readonly TarihDenetimi[] = [],
): DepoKontrolPlani {
  const ad = secim.tur === 'mevcut' ? secim.ad : secim.onceki.ad;
  const ws = hedef.excel.getWorksheet(ad);
  if (!ws) throw new KullaniciHatasi(`'${ad}' sayfası bulunamadı.`);
  yapiDogrula(ws, ayarlar);
  return hesapla({ listeAdlari: listeOku(ws, ayarlar), ...kaynaklar, ayarlar, tarihDenetimleri });
}

/** Planı bellekteki kitaba yazar. Diske kaydetmek için ardından kitapYaz çağrılır. */
export function uygula(hedef: AcikKitap, secim: GunSecimi, plan: DepoKontrolPlani, ayarlar: Ayarlar): string {
  return planiYaz({
    wb: hedef.excel,
    tur: secim.tur,
    ad: secim.ad,
    oncekiAd: secim.onceki.ad,
    oncekiTarih: secim.onceki.tarih,
    yeniTarih: secim.tarih,
    plan,
    ayarlar,
  }).name;
}
