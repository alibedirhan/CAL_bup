// Kullanıcı dosyaları hep birlikte bırakır; hangisinin hangisi olduğu içeriğinden anlaşılır.

import type { Ayarlar } from '../cekirdek/ayarlar';
import { adNormal } from '../cekirdek/metin';
import { OkumaHatasi } from './kitap';
import { gunSayfasiMi } from '../cekirdek/tarih';
import type { Kitap } from './kitap';
import { d01Mi, sayimMi, subeAlisMi } from './led';

export type DosyaTuru = 'd01' | 'sayim' | 'subeAlis' | 'depoKontrol';

export const DOSYA_TURU_ADLARI: Record<DosyaTuru, string> = {
  d01: 'D01 Stok Giriş Çıkış Envanteri',
  sayim: 'Sayım fişi',
  subeAlis: 'Şube alış',
  depoKontrol: 'Günlük depo kontrol dosyası',
};

/** Gün sayfası olan ve G1'inde beklenen başlık bulunan kitap depo kontrol dosyasıdır. */
export function depoKontrolMu(kitap: Kitap, ayarlar: Ayarlar): boolean {
  const beklenen = ayarlar.hedefKontrolBaslik.toLocaleUpperCase('tr');
  return kitap.sayfalar.some(
    (s) => gunSayfasiMi(s.ad) && adNormal(s.hucre(1, 7)).toLocaleUpperCase('tr') === beklenen,
  );
}

export function dosyaTuru(kitap: Kitap, ayarlar: Ayarlar): DosyaTuru | null {
  const turler: DosyaTuru[] = [];
  if (d01Mi(kitap, ayarlar)) turler.push('d01');
  if (subeAlisMi(kitap, ayarlar)) turler.push('subeAlis');
  if (sayimMi(kitap, ayarlar)) turler.push('sayim');
  if (depoKontrolMu(kitap, ayarlar)) turler.push('depoKontrol');
  if (turler.length > 1)
    throw new OkumaHatasi(
      'Dosya birden fazla rapor türüne uyuyor. LED raporlarını ayrı dosyalar halinde seçin.',
    );
  return turler[0] ?? null;
}
