import { KullaniciHatasi } from '../cekirdek/hata';
import { karlilikKaydiniDogrula } from '../cekirdek/karlilik/dogrulama';
import type { KarlilikKaydi } from '../cekirdek/karlilik/turler';
import { guncelle, okuKesin } from './idb';
export const KARLILIK_ANAHTARI = 'satis:karlilik:v1';
export async function karlilikKaydiniOku() {
  return karlilikKaydiniDogrula(await okuKesin(KARLILIK_ANAHTARI));
}
/** İki depo ve yedekleri tek CAS aktarımıdır. İptal edilen veya eski sekme kaydı ezemez. */
export async function karlilikKaydiniYaz(eski: KarlilikKaydi, yeni: KarlilikKaydi, signal: AbortSignal) {
  signal.throwIfAborted();
  karlilikKaydiniDogrula(yeni);
  const sonuc = { ...yeni, nesil: eski.nesil + 1 };
  let hata: unknown;
  const ok = await guncelle(KARLILIK_ANAHTARI, (onceki) => {
    try {
      signal.throwIfAborted();
      const guncel = karlilikKaydiniDogrula(onceki);
      if (JSON.stringify(guncel) !== JSON.stringify(eski))
        throw new KullaniciHatasi(
          'Kârlılık kayıtları başka sekmede değişti. Kayıtları yenileyip yeniden deneyin.',
        );
      return sonuc;
    } catch (e) {
      hata = e;
      throw e;
    }
  });
  if (hata) throw hata;
  if (!ok) throw new KullaniciHatasi('Kârlılık kaydı saklanamadı. Önceki kayıt korundu.');
  return sonuc;
}
