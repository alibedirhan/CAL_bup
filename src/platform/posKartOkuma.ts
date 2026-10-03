import { KullaniciHatasi } from '../cekirdek/hata';
import {
  EN_BUYUK_KART_FOTOGRAFI,
  EN_FAZLA_KART_PIKSELI,
  kartGoruntuBoyutu,
  kartMetnindenAlanlar,
  type KartOkumaSonucu,
} from '../cekirdek/posKartFotografi';
import type { Worker as OcrWorker } from 'tesseract.js';

export async function kartFotografiniOku(
  dosya: File,
  signal: AbortSignal,
  ilerleme: (yuzde: number) => void,
): Promise<KartOkumaSonucu> {
  if (!dosya.size || dosya.size > EN_BUYUK_KART_FOTOGRAFI)
    throw new KullaniciHatasi('Kart fotoğrafı en fazla 10 MB olabilir.');
  let worker: OcrWorker | undefined;
  let bitmap: ImageBitmap | undefined;
  let ham: Uint8Array | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let durdu = false;
  let sure: ReturnType<typeof setTimeout> | undefined;
  let iptalEt!: () => void;
  const iptal = new Promise<never>((_, reddet) => {
    iptalEt = () => {
      durdu = true;
      void worker?.terminate().catch(() => undefined);
      reddet(new KullaniciHatasi('Fotoğraf okuma durduruldu. Elle devam edebilirsiniz.'));
    };
    signal.addEventListener('abort', iptalEt, { once: true });
    sure = setTimeout(iptalEt, 90_000);
  });
  const denetle = () => {
    if (signal.aborted || durdu) throw new KullaniciHatasi('Fotoğraf okuma durduruldu.');
  };
  const is = async (): Promise<KartOkumaSonucu> => {
    try {
      denetle();
      ham = new Uint8Array(await dosya.arrayBuffer());
      denetle();
      kartGoruntuBoyutu(ham);
      bitmap = await createImageBitmap(dosya);
      denetle();
      if (bitmap.width * bitmap.height > EN_FAZLA_KART_PIKSELI)
        throw new KullaniciHatasi('Fotoğraf en fazla 20 megapiksel olabilir.');
      canvas = document.createElement('canvas');
      const oran = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * oran);
      canvas.height = Math.round(bitmap.height * oran);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new KullaniciHatasi('Tarayıcı fotoğrafı açamadı. Elle ekleyebilirsiniz.');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      bitmap = undefined;
      const { createWorker } = await import('tesseract.js');
      denetle();
      const yerel = new URL(import.meta.env.BASE_URL + 'ocr/', location.origin).href;
      worker = await createWorker('eng', 1, {
        workerPath: yerel + 'worker.min.js',
        corePath: yerel,
        langPath: yerel,
        workerBlobURL: false,
        cacheMethod: 'none',
        logger: (m) => {
          if (!signal.aborted && m.status === 'recognizing text') ilerleme(Math.round(m.progress * 100));
        },
        errorHandler: () => undefined,
      });
      denetle();
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789 /.-',
        preserve_interword_spaces: '1',
      });
      const { data } = await worker.recognize(canvas);
      denetle();
      const sonuc = kartMetnindenAlanlar(data.text);
      data.text = '';
      return sonuc;
    } finally {
      bitmap?.close();
      ham?.fill(0);
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      if (worker) await worker.terminate().catch(() => undefined);
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
    durdu = true;
    bitmap?.close();
    ham?.fill(0);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (worker) await worker.terminate().catch(() => undefined);
    // Worker kurulması iptalden sonra biterse de eski okuma yeniden etkinleşemez.
  }
}
