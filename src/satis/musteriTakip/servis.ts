import { musterileriKarsilastir } from '../../cekirdek/musteriTakip/karsilastir';
import type { MusteriSonucu, Plasiyerler } from '../../cekirdek/musteriTakip/turler';
import type { MusteriBelgesi, MusteriDosyasi, MusteriMotoru } from './portlar';

export interface MusteriOturumu {
  readonly eski: MusteriBelgesi;
  readonly yeni: MusteriBelgesi;
  readonly sonuc: MusteriSonucu;
}

/** İki okuma da bitmeden sonuç yayımlanmaz. Servis somut dosya/Excel adaptörü bilmez. */
export async function musteriKarsilastirmasi(
  motor: MusteriMotoru,
  eski: MusteriDosyasi,
  yeni: MusteriDosyasi,
  harfDuyarli: boolean,
  plasiyerler: Plasiyerler,
  signal: AbortSignal,
): Promise<MusteriOturumu> {
  signal.throwIfAborted();
  const eskiListe = await motor.listeOku(eski, signal);
  signal.throwIfAborted();
  const yeniListe = await motor.listeOku(yeni, signal);
  signal.throwIfAborted();
  const sonuc = musterileriKarsilastir(eskiListe, yeniListe, harfDuyarli, plasiyerler);
  signal.throwIfAborted();
  return { eski: { ad: eski.ad, liste: eskiListe }, yeni: { ad: yeni.ad, liste: yeniListe }, sonuc };
}
