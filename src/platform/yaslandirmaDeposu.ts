import { KullaniciHatasi } from '../cekirdek/hata';
import { atamaKaydiniDogrula } from '../cekirdek/yaslandirma/dogrulama';
import type { AtamaKaydi } from '../cekirdek/yaslandirma/turler';
import { guncelle, okuKesin } from './idb';

/** Araç atamaları yalnız bu tarayıcıdadır; masaüstü kaydı taşınmaz. */
export const ATAMA_ANAHTARI = 'satis:yaslandirma:atamalar:v1';
export async function atamaKaydiniOku() {
  return atamaKaydiniDogrula(await okuKesin(ATAMA_ANAHTARI));
}
/** Birincil ve yedek metin tek CAS aktarımıdır. İptal edilen veya eski sekme kaydı ezemez. */
export async function atamaKaydiniYaz(
  eski: AtamaKaydi,
  yeni: { guncel: string | null; yedek: string | null },
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const sonuc = atamaKaydiniDogrula({ surum: 1, nesil: eski.nesil + 1, ...yeni });
  let hata: unknown;
  const ok = await guncelle(ATAMA_ANAHTARI, (onceki) => {
    try {
      signal.throwIfAborted();
      const guncel = atamaKaydiniDogrula(onceki);
      if (JSON.stringify(guncel) !== JSON.stringify(eski))
        throw new KullaniciHatasi(
          'Araç atamaları başka sekmede değişti. Atamaları yenileyip yeniden deneyin.',
        );
      return sonuc;
    } catch (e) {
      hata = e;
      throw e;
    }
  });
  if (hata) throw hata;
  if (!ok) throw new KullaniciHatasi('Araç ataması saklanamadı. Önceki kayıt korundu.');
  return sonuc;
}
