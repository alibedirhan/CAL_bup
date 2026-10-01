// Kaynak dosyaların tarihleri yeni günle uyuşuyor mu?
// D01 ve sayım fişi yeni günün, şube alış bir önceki günün olmalı.
// Uyuşmazsa arayüz kullanıcıya sorar; onaylanırsa uyarı olarak kayda geçer.

import type { KaynakVeri } from '../../cekirdek/kaynakVeri';
import { tarihMetni, type Tarih } from '../../cekirdek/tarih';

export type TarihDurumu = 'uygun' | 'tarihYok' | 'uyusmuyor';

export interface TarihDenetimi {
  kaynak: string;
  bulunan: Tarih | null;
  beklenen: Tarih;
  durum: TarihDurumu;
}

function denetle(kaynak: string, bulunan: Tarih | null, beklenen: Tarih): TarihDenetimi {
  const durum: TarihDurumu = bulunan === null ? 'tarihYok' : bulunan === beklenen ? 'uygun' : 'uyusmuyor';
  return { kaynak, bulunan, beklenen, durum };
}

export function tarihleriDenetle(
  kaynaklar: { d01: KaynakVeri; sayim: KaynakVeri; sube: KaynakVeri },
  yeniTarih: Tarih,
  oncekiTarih: Tarih,
): TarihDenetimi[] {
  return [
    denetle('D01', kaynaklar.d01.tarih, yeniTarih),
    denetle('Sayım fişi', kaynaklar.sayim.tarih, yeniTarih),
    denetle('Şube alış', kaynaklar.sube.tarih, oncekiTarih),
  ];
}

/** Kullanıcıya sorulacak soru metni. */
export function uyusmazlikSorusu(d: TarihDenetimi): string {
  const bulunan = d.bulunan ? tarihMetni(d.bulunan) : '?';
  return `${d.kaynak} dosyasının tarihi ${bulunan}, beklenen ${tarihMetni(d.beklenen)}. Yine de bu dosyayla devam edilsin mi?`;
}

/** Denetim sonuçlarının kayda geçen hâli (onaylanmış uyuşmazlıklar uyarı, tarihsizler not). */
export function tarihKayitlari(denetimler: readonly TarihDenetimi[]): {
  uyarilar: string[];
  notlar: string[];
} {
  const uyarilar: string[] = [];
  const notlar: string[] = [];
  for (const d of denetimler) {
    if (d.durum === 'tarihYok') {
      notlar.push(`${d.kaynak}: dosyada tarih bulunamadı, tarih kontrolü yapılamadı.`);
    } else if (d.durum === 'uyusmuyor' && d.bulunan) {
      uyarilar.push(
        `${d.kaynak}: dosya tarihi ${tarihMetni(d.bulunan)} (beklenen ${tarihMetni(d.beklenen)}), onayla devam edildi.`,
      );
    }
  }
  return { uyarilar, notlar };
}
