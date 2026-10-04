import { KullaniciHatasi } from '../cekirdek/hata';
import {
  plasiyerKaydiniDogrula,
  plasiyerleriDogrula,
  type PlasiyerKaydi,
} from '../cekirdek/musteriTakip/plasiyer';
import type { Plasiyerler } from '../cekirdek/musteriTakip/turler';
import { guncelle, okuKesin } from './idb';

export const PLASIYER_ANAHTARI = 'satis:musteri-plasiyer:v1';

export async function plasiyerleriOku(): Promise<PlasiyerKaydi> {
  return plasiyerKaydiniDogrula(await okuKesin(PLASIYER_ANAHTARI));
}

/** Yedek ve güncel kayıt tek IndexedDB aktarımıdır. Eski sekme yeni kaydı ezemez. */
export async function plasiyerleriKaydet(
  beklenenNesil: number,
  degerler: Plasiyerler | 'geri-al',
  signal: AbortSignal,
): Promise<PlasiyerKaydi> {
  signal.throwIfAborted();
  const dogrulanan = degerler === 'geri-al' ? null : plasiyerleriDogrula(degerler);
  let sonuc: PlasiyerKaydi | null = null;
  let hata: unknown;
  const kayit = await guncelle(PLASIYER_ANAHTARI, (onceki) => {
    try {
      signal.throwIfAborted();
      const eski = plasiyerKaydiniDogrula(onceki);
      if (eski.nesil !== beklenenNesil)
        throw new KullaniciHatasi('Araç/plasiyer ayarları başka sekmede değişti. Ayarları yeniden açın.');
      if (degerler === 'geri-al' && !eski.yedek)
        throw new KullaniciHatasi('Geri alınacak araç/plasiyer kaydı yok.');
      sonuc = {
        surum: 1,
        nesil: eski.nesil + 1,
        plasiyerler: dogrulanan ?? eski.yedek ?? {},
        yedek: eski.plasiyerler,
      };
      return sonuc;
    } catch (e) {
      hata = e;
      throw e;
    }
  });
  if (hata) throw hata;
  if (!kayit || !sonuc)
    throw new KullaniciHatasi('Araç/plasiyer ayarları kaydedilemedi. Önceki kayıt korundu.');
  return sonuc;
}
