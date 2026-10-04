import { KullaniciHatasi } from '../../cekirdek/hata';
import {
  excelGirdisiniDogrula,
  karlilikKaydiniDogrula,
  senaryoOranlariniDogrula,
  sonucuDogrula,
} from '../../cekirdek/karlilik/dogrulama';
import type { KarlilikIstegi } from '../../cekirdek/karlilik/turler';
import type { KarlilikMotoru } from './portlar';
export async function karlilikIslemi(motor: KarlilikMotoru, istek: KarlilikIstegi, signal: AbortSignal) {
  signal.throwIfAborted();
  karlilikKaydiniDogrula(istek.kayit);
  if (istek.oranlar) senaryoOranlariniDogrula(istek.oranlar);
  if (!['kayit', 'donem-sil', 'donem-geri', 'karsilastir'].includes(istek.eylem)) {
    if (!istek.satis || !istek.fiyat) throw new KullaniciHatasi('Satış ve fiyat raporlarını seçin.');
    for (const d of [istek.satis, istek.fiyat]) excelGirdisiniDogrula(d.ad, d.bayt.byteLength, d.bayt);
  }
  const sonuc = await motor.calistir(istek, signal);
  signal.throwIfAborted();
  if (
    (sonuc.tur === 'analiz' && (!sonuc.sonuc || !sonuc.kayit || !Array.isArray(sonuc.donemler))) ||
    (sonuc.tur === 'kayit' && (!sonuc.kayit || !Array.isArray(sonuc.donemler))) ||
    (sonuc.tur === 'karsilastirma' && !sonuc.karsilastirma)
  )
    throw new KullaniciHatasi('Kârlılık yanıtı eksik. Yeniden deneyin.');
  if (sonuc.sonuc) sonucuDogrula(sonuc.sonuc);
  if (sonuc.kayit) karlilikKaydiniDogrula(sonuc.kayit);
  return sonuc;
}
