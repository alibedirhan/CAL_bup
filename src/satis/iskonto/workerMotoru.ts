import { KullaniciHatasi } from '../../cekirdek/hata';
import { belgeleriDogrula, onizlemeyiDogrula } from '../../cekirdek/iskonto/dogrulama';
import type { IskontoMotoru } from './portlar';
import type { IskontoIstegi } from './workerSozlesmesi';

function calistir(istek: IskontoIstegi, signal: AbortSignal): Promise<Record<string, unknown>> {
  signal.throwIfAborted();
  return new Promise((coz, reddet) => {
    const isci = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const kapat = () => {
      clearTimeout(zaman);
      signal.removeEventListener('abort', iptal);
      isci.terminate();
    };
    const iptal = () => {
      kapat();
      reddet(new DOMException('İşlem durduruldu.', 'AbortError'));
    };
    const zaman = setTimeout(() => {
      kapat();
      reddet(new KullaniciHatasi('PDF işlemi süre sınırını aştı. Daha küçük dosyalarla yeniden deneyin.'));
    }, 120_000);
    signal.addEventListener('abort', iptal, { once: true });
    isci.onerror = () => {
      kapat();
      reddet(new KullaniciHatasi('Fiyat listesi motoru başlatılamadı. Sayfayı yenileyip yeniden deneyin.'));
    };
    isci.onmessage = (o: MessageEvent<Record<string, unknown>>) => {
      kapat();
      if (o.data.tur === 'hata')
        reddet(new KullaniciHatasi(typeof o.data.mesaj === 'string' ? o.data.mesaj : 'İşlem tamamlanamadı.'));
      else coz(o.data);
    };
    try {
      isci.postMessage(istek);
    } catch (hata) {
      kapat();
      reddet(hata);
    }
  });
}

export const iskontoMotoru: IskontoMotoru = {
  async yukle(dosyalar, signal) {
    const s = await calistir({ tur: 'yukle', dosyalar }, signal);
    if (
      !Array.isArray(s.hatalar) ||
      s.hatalar.length > 3 ||
      s.hatalar.some(
        (h: unknown) =>
          !h ||
          typeof h !== 'object' ||
          !('ad' in h) ||
          typeof h.ad !== 'string' ||
          !('mesaj' in h) ||
          typeof h.mesaj !== 'string',
      )
    )
      throw new KullaniciHatasi('PDF yükleme sonucu doğrulanamadı.');
    return { belgeler: belgeleriDogrula(s.belgeler), hatalar: s.hatalar as { ad: string; mesaj: string }[] };
  },
  async onizle(belgeler, oranlar, tarih, signal) {
    const s = await calistir({ tur: 'onizle', belgeler, oranlar, tarih }, signal);
    return onizlemeyiDogrula(s.onizleme);
  },
  async cikti(tur, belgeler, oranlar, tarih, satirlar, signal) {
    const s = await calistir({ tur, belgeler, oranlar, tarih, satirlar }, signal);
    if (
      s.tur !== 'dosya' ||
      typeof s.ad !== 'string' ||
      /[/\\\0]/.test(s.ad) ||
      s.ad.length > 200 ||
      !/\.(xlsx|pdf|zip)$/i.test(s.ad) ||
      !(s.bayt instanceof Uint8Array) ||
      !s.bayt.length ||
      s.bayt.length > 100 * 1024 * 1024
    )
      throw new KullaniciHatasi('İskonto çıktısı doğrulanamadı.');
    return { ad: s.ad, bayt: s.bayt };
  },
};
