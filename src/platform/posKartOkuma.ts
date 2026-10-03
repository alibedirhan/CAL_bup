import { KullaniciHatasi } from '../cekirdek/hata';
import {
  DUZ_KART_GORUNTUSU,
  type KartGoruntuDuzeltmesi,
  type KartOkumaSonucu,
} from '../cekirdek/posKartFotografi';
import { KartOkumaMotoru, type OkumaAsamasi } from './ocr/motor';
import { kartGoruntusu, goruntuyuDondur, egimiBul, okumaSuruyor } from './ocr/goruntu';
import { okumaAlanlari } from './ocr/alanlar';

export async function kartFotografiniOku(
  dosya: File,
  signal: AbortSignal,
  ilerleme: (yuzde: number) => void,
  asama: (a: OkumaAsamasi) => void = () => undefined,
  duzeltme: KartGoruntuDuzeltmesi = DUZ_KART_GORUNTUSU,
): Promise<KartOkumaSonucu> {
  let worker: KartOkumaMotoru | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let gecici: HTMLCanvasElement | undefined;
  const c = new AbortController();
  let reddet!: (e: Error) => void;
  const iptal = new Promise<never>((_, r) => {
    reddet = r;
  });
  const durdur = (hata: Error) => {
    c.abort();
    worker?.kapat(hata);
    reddet(hata);
  };
  const iptalEt = () => durdur(new KullaniciHatasi('Fotoğraf okuma durduruldu. Elle devam edebilirsiniz.'));
  signal.addEventListener('abort', iptalEt, { once: true });
  const sure = setTimeout(
    () =>
      durdur(
        new KullaniciHatasi(
          'Fotoğraf okuma süresi doldu. Daha yakın bir fotoğrafla yeniden deneyin veya elle devam edin.',
        ),
      ),
    90_000,
  );
  const is = async (): Promise<KartOkumaSonucu> => {
    try {
      okumaSuruyor(signal);
      asama('denetim');
      canvas = await kartGoruntusu(dosya, c.signal, duzeltme);
      okumaSuruyor(c.signal);
      asama('model');
      worker = new KartOkumaMotoru((p) => {
        if (!c.signal.aborted) ilerleme(p);
      });
      await worker.hazirla();
      const sonuc: KartOkumaSonucu = { numaralar: [], tarihler: [], kanitlar: [], gecersizNumara: false };
      // Dört yön, bir kontrast düzeltmesi: en fazla beş deneme, toplam 90 saniye.
      for (const [donus, kontrast] of [
        [0, false],
        [90, false],
        [180, false],
        [270, false],
        [0, true],
      ] as const) {
        okumaSuruyor(c.signal);
        asama('hazirlama');
        gecici = goruntuyuDondur(canvas, donus, kontrast);
        const egim = egimiBul(gecici);
        if (egim) {
          const duz = goruntuyuDondur(gecici, egim);
          gecici.width = 0;
          gecici.height = 0;
          gecici = duz;
        }
        asama('okuma');
        ilerleme(0);
        const alanlar = okumaAlanlari(await worker.oku(gecici, { rotateAuto: false }), donus);
        okumaSuruyor(c.signal);
        sonuc.gecersizNumara ||= Boolean(alanlar.gecersizNumara);
        // Yönler arası alanlar birleştirilmez: aynı okumanın numarası ve tarihi birlikte sunulur.
        if (
          alanlar.numaralar.length > sonuc.numaralar.length ||
          (alanlar.numaralar.length === sonuc.numaralar.length &&
            alanlar.tarihler.length > sonuc.tarihler.length)
        )
          Object.assign(sonuc, alanlar);
        gecici.width = 0;
        gecici.height = 0;
        gecici = undefined;
        if (sonuc.numaralar.length && sonuc.tarihler.length) break;
      }
      return sonuc;
    } finally {
      worker?.kapat();
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      if (gecici) {
        gecici.width = 0;
        gecici.height = 0;
      }
    }
  };
  try {
    return await Promise.race([is(), iptal]);
  } catch (e) {
    throw e instanceof KullaniciHatasi
      ? e
      : new KullaniciHatasi('Fotoğraf okunamadı. Kart bilgilerini elle ekleyebilirsiniz.');
  } finally {
    clearTimeout(sure);
    signal.removeEventListener('abort', iptalEt);
    c.abort();
    worker?.kapat();
  }
}
