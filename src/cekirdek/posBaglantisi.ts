import { KullaniciHatasi } from './hata';
import { kurulumDogrula, type PosKurulumu } from './posKurulumu';
import yardimci from './posYardimciSurumu.json';
/** 3: tek site geneli kurulum, CVV/Ad Soyad aktarımı, giriş bilgisinin programdan gelmesi. */
export const POS_YARDIMCI_PROTOKOLU = 3;
/** Yardımcının kendi sürümü; yalnız eklenti kodu değişince artar. Programın sürümünden bağımsızdır, böylece
 * POS'la ilgisi olmayan güncellemeler yeniden kurulum istemez. */
export const YARDIMCI_SURUMU: string = yardimci.surum;
export const YARDIMCI_DURUMLARI = [
  'hazir',
  'giris',
  'alanlar',
  'teslim',
  'dolduruldu',
  'hata',
  'iptal',
] as const;
/** `neden`: kullanıcının programda düzeltebileceği hata türü (“Cariyi düzenle” yolu). */
export const HATA_NEDENLERI = ['giris', 'cari'] as const;
export interface YardimciSonucu {
  durum: (typeof YARDIMCI_DURUMLARI)[number];
  mesaj: string;
  protokol: number;
  surum: string;
  neden?: (typeof HATA_NEDENLERI)[number];
  kurulum?: PosKurulumu | null;
}
export function yardimciYanitiniDogrula(d: unknown): YardimciSonucu {
  const s = d as YardimciSonucu | null;
  if (
    !s ||
    s.protokol !== POS_YARDIMCI_PROTOKOLU ||
    typeof s.surum !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(s.surum)
  )
    throw new KullaniciHatasi(
      'POS yardımcısını güncelleyin: programdaki kurulum dosyasını yeniden çalıştırın (veya yeni ZIP’i aynı klasöre çıkarın), tarayıcının eklenti sayfasında yardımcıyı kaldırmadan “Yeniden yükle” deyin ve bu sayfayı yenileyin.',
    );
  const gecersiz = () =>
    new KullaniciHatasi('POS yardımcısının yanıtı doğrulanamadı. Programı ve yardımcıyı yeniden yükleyin.');
  if (
    !YARDIMCI_DURUMLARI.includes(s.durum) ||
    typeof s.mesaj !== 'string' ||
    s.mesaj.length > 500 ||
    (s.neden !== undefined && !HATA_NEDENLERI.includes(s.neden))
  )
    throw gecersiz();
  let kurulum: PosKurulumu | null | undefined;
  try {
    kurulum = s.kurulum === undefined || s.kurulum === null ? s.kurulum : kurulumDogrula(s.kurulum);
  } catch {
    throw gecersiz();
  }
  return {
    durum: s.durum,
    mesaj: s.mesaj,
    protokol: s.protokol,
    surum: s.surum,
    ...(s.neden ? { neden: s.neden } : {}),
    ...(kurulum !== undefined ? { kurulum } : {}),
  };
}
