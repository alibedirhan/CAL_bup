import {
  iskontoOranlariniDogrula,
  pdfGirdisiniDogrula,
  belgeleriDogrula,
  onizlemeyiDogrula,
} from '../../cekirdek/iskonto/dogrulama';
import { KullaniciHatasi } from '../../cekirdek/hata';
import type { IskontoMotoru } from './portlar';
import type { IskontoDosyasi, IskontoBelgesi, IskontoOranlari } from '../../cekirdek/iskonto/turler';

export async function fiyatListeleriniYukle(
  motor: IskontoMotoru,
  dosyalar: readonly IskontoDosyasi[],
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (!dosyalar.length || dosyalar.length > 3) throw new KullaniciHatasi('En fazla üç PDF seçin.');
  const gecerli: IskontoDosyasi[] = [],
    hatalar: { ad: string; mesaj: string }[] = [];
  for (const d of dosyalar) {
    try {
      pdfGirdisiniDogrula(d.ad, d.bayt.byteLength, d.bayt);
      gecerli.push(d);
    } catch (hata) {
      if (!(hata instanceof KullaniciHatasi)) throw hata;
      hatalar.push({ ad: d.ad, mesaj: hata.message });
    }
  }
  const sonuc = gecerli.length ? await motor.yukle(gecerli, signal) : { belgeler: [], hatalar: [] };
  signal.throwIfAborted();
  return { belgeler: belgeleriDogrula(sonuc.belgeler), hatalar: [...hatalar, ...sonuc.hatalar] };
}

export async function iskontoOnizle(
  motor: IskontoMotoru,
  belgeler: IskontoBelgesi[],
  oranlar: IskontoOranlari,
  tarih: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  iskontoOranlariniDogrula(oranlar);
  belgeleriDogrula(belgeler);
  if (!belgeler.length) throw new KullaniciHatasi('Önce PDF dosyaları yükleyin!');
  const sonuc = await motor.onizle(belgeler, oranlar, tarih, signal);
  signal.throwIfAborted();
  return onizlemeyiDogrula(sonuc);
}
