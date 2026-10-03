import { KullaniciHatasi } from '../cekirdek/hata';
import * as idb from './idb';

export const POS_DENEME_ONEKI = 'sanal-pos-deneme-';

/** Beş deneme/60 saniye. Sayfa yenilemesiyle sayaç kaybolmaz; PIN içermez. */
export async function posDenemesiniAyir(cihaz: string): Promise<void> {
  let bekle = false;
  const simdi = Date.now();
  const tamam = await idb.guncelle(POS_DENEME_ONEKI + cihaz, (onceki) => {
    const p = onceki as { baslangic?: unknown; sayi?: unknown } | undefined;
    const gecerli =
      p &&
      typeof p.baslangic === 'number' &&
      typeof p.sayi === 'number' &&
      Number.isInteger(p.sayi) &&
      p.sayi >= 0 &&
      p.sayi <= 5;
    const baslangic = typeof p?.baslangic === 'number' ? p.baslangic : 0;
    const ayniPencere = gecerli && simdi >= baslangic && simdi - baslangic < 60_000;
    const sayi = ayniPencere ? (p.sayi as number) : 0;
    if (sayi >= 5) {
      bekle = true;
      return onceki;
    }
    return { baslangic: ayniPencere ? baslangic : simdi, sayi: sayi + 1 };
  });
  if (!tamam)
    throw new KullaniciHatasi('PIN denemesi kaydedilemedi. Tarayıcı deposunu kontrol edip yeniden deneyin.');
  if (bekle)
    throw new KullaniciHatasi('Çok sayıda PIN denemesi yapıldı. Bir dakika bekleyip yeniden deneyin.');
}

export async function posDenemeleriniTemizle(cihaz: string): Promise<void> {
  if (!(await idb.guncelle(POS_DENEME_ONEKI + cihaz, () => idb.KAYDI_SIL))) {
    throw new KullaniciHatasi('PIN oturumu doğrulanamadı. Tarayıcı deposunu kontrol edip yeniden deneyin.');
  }
}
