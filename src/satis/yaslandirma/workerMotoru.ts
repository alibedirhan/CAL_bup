import { KullaniciHatasi } from '../../cekirdek/hata';
import type { YaslandirmaCevabi } from '../../cekirdek/yaslandirma/turler';
import type { YaslandirmaMotoru } from './portlar';

const CIKTILAR = new Set(['Yaslandirma_Analizi.xlsx', 'Yaslandirma_Gorunen_Araclar.xlsx']);
/** Her istek ayrı işçide çalışır; iptal, süre sonu ve yanıt sonrası işçi kapatılır. */
export const yaslandirmaMotoru: YaslandirmaMotoru = {
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
          new KullaniciHatasi('Yaşlandırma işlemi süre sınırını aştı. Daha küçük dosyayla yeniden deneyin.'),
        );
      }, 120_000);
      signal.addEventListener('abort', iptal, { once: true });
      isci.onerror = () => {
        kapat();
        reddet(new KullaniciHatasi('Yaşlandırma motoru başlatılamadı. Yeniden deneyin.'));
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
            !CIKTILAR.has(s.ad) ||
            !(s.bayt instanceof Uint8Array) ||
            !s.bayt.length ||
            s.bayt.length > 100 * 1024 * 1024)
        ) {
          reddet(new KullaniciHatasi('Yaşlandırma çıktısı doğrulanamadı.'));
          return;
        }
        if (!['analiz', 'dosya', 'atama'].includes(String(s.tur))) {
          reddet(new KullaniciHatasi('Yaşlandırma yanıtı doğrulanamadı.'));
          return;
        }
        coz(s as unknown as YaslandirmaCevabi);
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
