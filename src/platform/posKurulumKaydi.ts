import { kurulumDogrula, type PosKurulumu } from '../cekirdek/posKurulumu';
import { oku, yaz } from './saklama';

/** POS yardımcısının alan kurulumunun programdaki kopyası. Yalnız kutu seçicileri ve başlıkları içerir
 * (kart, cari, firma değeri yoktur); bu yüzden şifreli kasaya değil yerel ayara yazılır. Yardımcı
 * kaldırılıp yeniden kurulursa ilk aktarımda geri verilir. */
const ANAHTAR = 'pos-yardimci-kurulumu';
export function kurulumKopyasiOku(): PosKurulumu | null {
  const s = oku(ANAHTAR);
  if (!s) return null;
  try {
    return kurulumDogrula(JSON.parse(s));
  } catch {
    return null;
  }
}
export function kurulumKopyasiYaz(k: PosKurulumu | null): void {
  yaz(ANAHTAR, k ? JSON.stringify(k) : '');
}
