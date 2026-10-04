import type { MusteriCiktisi } from '../cekirdek/musteriTakip/turler';
import { musteriResimleri } from './musteriResmi';

/** Çoklu indirme iznine bağlı kalmadan bütün PNG sayfalarını tek ZIP ile verir. */
export async function musteriResimCiktisi(cikti: MusteriCiktisi, signal: AbortSignal) {
  const resimler = await musteriResimleri(cikti, signal);
  signal.throwIfAborted();
  const ilk = resimler[0];
  if (resimler.length === 1 && ilk) return { bayt: ilk, ad: `${cikti.ad}.png`, tur: 'image/png' };
  const { default: JSZip } = await import('jszip');
  signal.throwIfAborted();
  const zip = new JSZip();
  resimler.forEach((bayt, i) => zip.file(`${cikti.ad}_${i + 1}.png`, bayt));
  const bayt = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  signal.throwIfAborted();
  return { bayt, ad: `${cikti.ad}_resimler.zip`, tur: 'application/zip' };
}
