import { KullaniciHatasi } from '../../cekirdek/hata';
import {
  atamaDurumunuDogrula,
  atamaGirdisiniDogrula,
  atamaKaydiniDogrula,
  excelGirdisiniDogrula,
  sonucuDogrula,
} from '../../cekirdek/yaslandirma/dogrulama';
import type { YaslandirmaCevabi, YaslandirmaIstegi } from '../../cekirdek/yaslandirma/turler';
import type { YaslandirmaMotoru } from './portlar';

/** Uygulama servisi: girdiyi ve yanıtı doğrular; hesap motor portundadır. */
export async function yaslandirmaIslemi(
  motor: YaslandirmaMotoru,
  istek: YaslandirmaIstegi,
  signal: AbortSignal,
): Promise<YaslandirmaCevabi> {
  signal.throwIfAborted();
  if ('dosya' in istek) excelGirdisiniDogrula(istek.dosya.ad, istek.dosya.bayt.byteLength, istek.dosya.bayt);
  if ('kayit' in istek) atamaKaydiniDogrula(istek.kayit);
  if (istek.eylem === 'ata') atamaGirdisiniDogrula(istek.atama);
  if (
    istek.eylem === 'gorunen' &&
    (!istek.araclar.length ||
      istek.araclar.length > 1_000 ||
      new Set(istek.araclar).size !== istek.araclar.length)
  )
    throw new KullaniciHatasi('Görünen araç seçimi geçersiz.');
  const sonuc = await motor.calistir(istek, signal);
  signal.throwIfAborted();
  const beklenen =
    istek.eylem === 'analiz'
      ? 'analiz'
      : istek.eylem === 'excel' || istek.eylem === 'gorunen'
        ? 'dosya'
        : 'atama';
  if (sonuc.tur !== beklenen)
    throw new KullaniciHatasi('Yaşlandırma yanıtı beklenen türde değil. Yeniden deneyin.');
  if (sonuc.tur === 'analiz') sonucuDogrula(sonuc.sonuc);
  if (sonuc.tur === 'atama') atamaDurumunuDogrula(sonuc as unknown as Record<string, unknown>);
  return sonuc;
}
