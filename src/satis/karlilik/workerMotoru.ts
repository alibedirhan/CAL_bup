import { KullaniciHatasi } from '../../cekirdek/hata';
import type { KarlilikMotoru } from './portlar';
import type { KarlilikCevabi } from '../../cekirdek/karlilik/turler';
export const karlilikMotoru: KarlilikMotoru = {
  calistir(istek, signal) {
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
        reddet(
          new KullaniciHatasi('Excel işlemi süre sınırını aştı. Daha küçük dosyalarla yeniden deneyin.'),
        );
      }, 120_000);
      signal.addEventListener('abort', iptal, { once: true });
      isci.onerror = () => {
        kapat();
        reddet(new KullaniciHatasi('Kârlılık motoru başlatılamadı. Yeniden deneyin.'));
      };
      isci.onmessage = (o: MessageEvent<Record<string, unknown>>) => {
        kapat();
        const s = o.data;
        if (s.tur === 'hata') {
          reddet(new KullaniciHatasi(typeof s.mesaj === 'string' ? s.mesaj : 'İşlem tamamlanamadı.'));
          return;
        }
        if (
          s.tur === 'dosya' &&
          (typeof s.ad !== 'string' ||
            /[/\\\0]/.test(s.ad) ||
            s.ad.length > 200 ||
            !s.ad.endsWith('.xlsx') ||
            !(s.bayt instanceof Uint8Array) ||
            !s.bayt.length ||
            s.bayt.length > 100 * 1024 * 1024)
        ) {
          reddet(new KullaniciHatasi('Kârlılık çıktısı doğrulanamadı.'));
          return;
        }
        if (!['analiz', 'dosya', 'kayit', 'karsilastirma'].includes(String(s.tur))) {
          reddet(new KullaniciHatasi('Kârlılık yanıtı doğrulanamadı.'));
          return;
        }
        coz(s as unknown as KarlilikCevabi);
      };
      try {
        isci.postMessage(istek);
      } catch (e) {
        kapat();
        reddet(e);
      }
    });
  },
};
