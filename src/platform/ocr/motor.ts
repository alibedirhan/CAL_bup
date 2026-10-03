import { KullaniciHatasi } from '../../cekirdek/hata';
import type { Page } from 'tesseract.js';
export type OkumaAsamasi = 'denetim' | 'hazirlama' | 'model' | 'okuma';
/** Tesseract.js 7.0.0 worker protokolü. Native handle yüklemeden ÖNCE bizimdir.
 * createWorker'ın başarısız model yüklemesinde çözülemeyen sözüne bağımlı değildir.
 * Sürüm yükselirse gerçek worker hata/iptal ve OCR sözleşme testleri zorunludur. */
export class KartOkumaMotoru {
  private worker: Worker;
  private bekleyen = new Map<string, { coz: (d: Page) => void; reddet: (e: Error) => void }>();
  private no = 0;
  private kapali = false;
  constructor(private ilerleme: (p: number) => void) {
    const yerel = new URL(import.meta.env.BASE_URL + 'ocr/', location.origin).href;
    this.worker = new Worker(yerel + 'worker.min.js');
    this.worker.onmessage = ({ data: m }) => {
      if (this.kapali) return;
      if (m.status === 'progress') {
        if (m.data?.status === 'recognizing text') this.ilerleme(Math.round(m.data.progress * 100));
        return;
      }
      const b = this.bekleyen.get(m.jobId);
      if (!b) return;
      this.bekleyen.delete(m.jobId);
      if (m.status === 'resolve') b.coz(m.data);
      else
        b.reddet(
          new KullaniciHatasi(
            'Fotoğraf okuma bileşeni yüklenemedi veya çalışamadı. Yeniden deneyebilir veya elle ekleyebilirsiniz.',
          ),
        );
    };
    this.worker.onerror = (e) => {
      e.preventDefault();
      this.kapat(
        new KullaniciHatasi('Fotoğraf okuma bileşeni açılamadı. Bağlantıyı kontrol edip yeniden deneyin.'),
      );
    };
    this.worker.onmessageerror = () => this.kapat(new KullaniciHatasi('Fotoğraf okuma yanıtı alınamadı.'));
  }
  private is(action: string, payload: unknown, aktar: Transferable[] = []): Promise<Page> {
    if (this.kapali) return Promise.reject(new KullaniciHatasi('Fotoğraf okuma durduruldu.'));
    const jobId = String(++this.no);
    return new Promise((coz, reddet) => {
      this.bekleyen.set(jobId, { coz, reddet });
      this.worker.postMessage({ workerId: 'kart', jobId, action, payload }, aktar);
    });
  }
  async hazirla(): Promise<void> {
    const yerel = new URL(import.meta.env.BASE_URL + 'ocr/', location.origin).href;
    await this.is('load', { options: { lstmOnly: true, corePath: yerel, logging: false } });
    await this.is('loadLanguage', {
      langs: 'eng',
      options: { langPath: yerel, cacheMethod: 'none', gzip: true, lstmOnly: true },
    });
    await this.is('initialize', {
      langs: 'eng',
      oem: 1,
      config: { load_system_dawg: '0', load_freq_dawg: '0' },
    });
    await this.is('setParameters', {
      params: {
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz /.-',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      },
    });
  }
  async oku(canvas: HTMLCanvasElement, options: Record<string, unknown> = {}): Promise<Page> {
    const blob = await new Promise<Blob>((coz, reddet) =>
      canvas.toBlob((b) => (b ? coz(b) : reddet(new KullaniciHatasi('Fotoğraf hazırlanamadı.')))),
    );
    const image = new Uint8Array(await blob.arrayBuffer());
    return this.is('recognize', { image, options, output: { text: true, blocks: true } }, [image.buffer]);
  }
  kapat(hata = new KullaniciHatasi('Fotoğraf okuma durduruldu. Elle devam edebilirsiniz.')): void {
    if (this.kapali) return;
    this.kapali = true;
    this.worker.terminate();
    this.worker.onmessage = null;
    this.worker.onerror = null;
    for (const b of this.bekleyen.values()) b.reddet(hata);
    this.bekleyen.clear();
  }
}
