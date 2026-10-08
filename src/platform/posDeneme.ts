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

const PAROLA_DENEMESI = 'sanal-pos-parola-deneme';
/** Yanlış parolada bekleme: ilk 5 deneme serbest, sonra 30 sn'den başlayıp her denemede ikiye katlanır
 * (en çok 15 dk). Sayfa yenilemek sayacı sıfırlamaz; parola içermez. */
export function parolaBeklemesi(sayi: number): number {
  return sayi < 5 ? 0 : Math.min(30_000 * 2 ** (sayi - 5), 15 * 60_000);
}
type Deneme = { sayi: number; son: number };
function denemeOku(d: unknown): Deneme {
  const p = d as Partial<Deneme> | undefined;
  return p && Number.isInteger(p.sayi) && (p.sayi ?? -1) >= 0 && Number.isFinite(p.son)
    ? { sayi: p.sayi as number, son: p.son as number }
    : { sayi: 0, son: 0 };
}
export async function parolaDenemesiIzni(simdi = Date.now()): Promise<void> {
  const d = denemeOku(await idb.okuKesin(PAROLA_DENEMESI));
  // Saat geri alınırsa bekleme yeniden başlar.
  const kalan = d.son > simdi ? parolaBeklemesi(d.sayi) : d.son + parolaBeklemesi(d.sayi) - simdi;
  if (kalan > 0)
    throw new KullaniciHatasi(
      `Çok sayıda yanlış parola denendi. ${Math.ceil(kalan / 1000)} saniye bekleyip yeniden deneyin.`,
    );
}
export async function parolaDenemesiBasarisiz(simdi = Date.now()): Promise<void> {
  await idb.guncelle(PAROLA_DENEMESI, (onceki) => ({ sayi: denemeOku(onceki).sayi + 1, son: simdi }));
}
export async function parolaDenemeleriniTemizle(): Promise<void> {
  await idb.guncelle(PAROLA_DENEMESI, () => idb.KAYDI_SIL);
}
