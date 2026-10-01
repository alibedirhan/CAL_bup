// LED raporlarının okuyucuları (eski aracın OkuD01 / OkuSayim / OkuSubeAlis'i).

import type { Ayarlar } from '../cekirdek/ayarlar';
import type { KaynakVeri } from '../cekirdek/kaynakVeri';
import { dosyaAdiTarihi, tarihBul, tarihtenCevir, type Tarih } from '../cekirdek/tarih';
import { OkumaHatasi, type Kitap, type Sayfa } from './kitap';
import { tabloOku } from './tabloOku';

function a1Iceriyor(sayfa: Sayfa | undefined, tanim: string): boolean {
  const a1 = String(sayfa?.hucre(1, 1) ?? '');
  return a1.toLocaleLowerCase('tr').includes(tanim.toLocaleLowerCase('tr'));
}

function baslikTarihleri(sayfa: Sayfa, kv: KaynakVeri, ayarlar: Ayarlar): void {
  const a2 = sayfa.hucre(2, 1);
  kv.tarih = tarihBul(a2, ayarlar.etiketBitisTarihi);
  kv.baslangicTarihi = tarihBul(a2, ayarlar.etiketBaslangicTarihi);
}

export function d01Mi(kitap: Kitap, ayarlar: Ayarlar): boolean {
  return a1Iceriyor(kitap.sayfalar[0], ayarlar.d01.tanim);
}

export function subeAlisMi(kitap: Kitap, ayarlar: Ayarlar): boolean {
  return a1Iceriyor(kitap.sayfalar[0], ayarlar.subeAlis.tanim);
}

export function sayimMi(kitap: Kitap, ayarlar: Ayarlar): boolean {
  return kitap.sayfalar.some((s) => s.ad === ayarlar.sayim.sayfaAdi);
}

export function d01Oku(kitap: Kitap, ayarlar: Ayarlar): KaynakVeri {
  const sayfa = kitap.sayfalar[0];
  if (!sayfa || !d01Mi(kitap, ayarlar)) {
    throw new OkumaHatasi(`${kitap.dosyaAdi} bir D01 Stok Giriş Çıkış Envanteri değil.`);
  }
  const kv = tabloOku(sayfa, ayarlar.d01, 'D01');
  baslikTarihleri(sayfa, kv, ayarlar);
  return kv;
}

export function subeAlisOku(kitap: Kitap, ayarlar: Ayarlar): KaynakVeri {
  const sayfa = kitap.sayfalar[0];
  if (!sayfa || !subeAlisMi(kitap, ayarlar)) {
    throw new OkumaHatasi(`${kitap.dosyaAdi} bir Şube Alış raporu değil.`);
  }
  const kv = tabloOku(sayfa, ayarlar.subeAlis, 'Şube alış');
  baslikTarihleri(sayfa, kv, ayarlar);
  return kv;
}

/**
 * Sayım fişinin içinde tarih yazmaz. Önce dosya adındaki tarih, yoksa dosyanın
 * oluşturulduğu gün kullanılır.
 */
export function sayimOku(kitap: Kitap, ayarlar: Ayarlar, bugun: Tarih): KaynakVeri {
  const sayfa = kitap.sayfalar.find((s) => s.ad === ayarlar.sayim.sayfaAdi);
  if (!sayfa) {
    throw new OkumaHatasi(
      `${kitap.dosyaAdi} bir sayım fişi değil ('${ayarlar.sayim.sayfaAdi}' sayfası yok).`,
    );
  }
  const kv = tabloOku(sayfa, ayarlar.sayim, 'Sayım fişi');
  kv.tarih =
    dosyaAdiTarihi(kitap.dosyaAdi, bugun) ?? (kitap.olusturulma ? tarihtenCevir(kitap.olusturulma) : null);
  return kv;
}
