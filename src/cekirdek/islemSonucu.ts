import { KullaniciHatasi } from './hata';
/** Sonuç metninden başarı tahmin edilmez. Belirsiz yazılar otomatik tekrarlanmaz. */
export type IslemDurumu = 'tamam' | 'dogrulama' | 'hata' | 'iptal' | 'belirsiz';
export interface IslemBaglami {
  kapsam: string;
  islemId: number;
}
export type IslemSonucu<T = void> = IslemBaglami &
  (
    | { durum: 'tamam'; deger: T; mesaj: string; kod: 'TAMAMLANDI' }
    | { durum: Exclude<IslemDurumu, 'tamam'>; mesaj: string; kod: string; alanlar?: Record<string, string> }
  );
export function tamam<T>(deger: T, mesaj: string, baglam: IslemBaglami): IslemSonucu<T> {
  return { ...baglam, durum: 'tamam', deger, mesaj, kod: 'TAMAMLANDI' };
}
export function basarisiz(
  durum: Exclude<IslemDurumu, 'tamam'>,
  mesaj: string,
  kod: string,
  baglam: IslemBaglami,
): IslemSonucu<never> {
  return { ...baglam, durum, mesaj, kod };
}

/** Kullanıcı metni değişse de hata kodu/kesinlik değişmez. Ham servis hataları gösterilmez. */
export class IslemHatasi extends KullaniciHatasi {
  constructor(
    public durum: Exclude<IslemDurumu, 'tamam'>,
    public kod: string,
    mesaj: string,
  ) {
    super(mesaj);
  }
}
export function hataSonucu(e: unknown, baglam: IslemBaglami, yazma = false): IslemSonucu<never> {
  if (e instanceof IslemHatasi) return basarisiz(e.durum, e.message, e.kod, baglam);
  const iptal = e instanceof Error && e.name === 'AbortError';
  return basarisiz(
    yazma ? 'belirsiz' : iptal ? 'iptal' : 'hata',
    e instanceof KullaniciHatasi
      ? e.message
      : yazma
        ? 'İşlem sonucu doğrulanamadı. Bazı kayıtlar tamamlanmış olabilir; yeniden işlem yapmadan güncel kayıtları kontrol edin.'
        : iptal
          ? 'İşlem durduruldu.'
          : 'İşlem tamamlanamadı. Yeniden deneyin.',
    yazma ? 'YAZMA_SONUCU_BELIRSIZ' : iptal ? 'IPTAL' : 'ISLEM_HATASI',
    baglam,
  );
}
