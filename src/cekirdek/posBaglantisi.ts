import { KullaniciHatasi } from './hata';
export const POS_YARDIMCI_PROTOKOLU = 2;
export const YARDIMCI_DURUMLARI = [
  'hazir',
  'giris',
  'alanlar',
  'teslim',
  'dolduruldu',
  'hata',
  'iptal',
] as const;
export interface YardimciSonucu {
  durum: (typeof YARDIMCI_DURUMLARI)[number];
  mesaj: string;
  protokol: number;
  surum: string;
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
      'POS yardımcısını güncelleyin. Yeni ZIP’i çıkarıp eklentiyi yeniden yükleyin, ardından program sekmesini yenileyin.',
    );
  if (!YARDIMCI_DURUMLARI.includes(s.durum) || typeof s.mesaj !== 'string' || s.mesaj.length > 300)
    throw new KullaniciHatasi(
      'POS yardımcısının yanıtı doğrulanamadı. Programı ve yardımcıyı yeniden yükleyin.',
    );
  return { durum: s.durum, mesaj: s.mesaj, protokol: s.protokol, surum: s.surum };
}
