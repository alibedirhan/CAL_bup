import { KullaniciHatasi } from '../../cekirdek/hata';
import type { MusteriMotoru } from './portlar';
import type { MotorIstegi, MotorYaniti } from './workerSozlesmesi';

/** Her işin işçisi sonunda kapatılır. İptal, ZIP/Excel okumasını da gerçekten durdurur. */
function isciIslemi(istek: MotorIstegi, signal: AbortSignal): Promise<MotorYaniti> {
  signal.throwIfAborted();
  return new Promise((coz, reddet) => {
    const isci = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const kapat = () => {
      signal.removeEventListener('abort', iptal);
      clearTimeout(sure);
      isci.terminate();
    };
    const iptal = () => {
      kapat();
      reddet(new DOMException('İşlem durduruldu.', 'AbortError'));
    };
    const sure = setTimeout(() => {
      kapat();
      reddet(
        new KullaniciHatasi('Excel işlemi zamanında tamamlanamadı. Daha küçük bir dosyayla yeniden deneyin.'),
      );
    }, 110_000);
    signal.addEventListener('abort', iptal, { once: true });
    isci.onmessage = (olay: MessageEvent<MotorYaniti>) => {
      kapat();
      const yanit = olay.data;
      if (yanit.tur === 'hata') reddet(new KullaniciHatasi(yanit.mesaj));
      else coz(yanit);
    };
    isci.onerror = () => {
      kapat();
      reddet(new KullaniciHatasi('Excel motoru başlatılamadı. Sayfayı yenileyip yeniden deneyin.'));
    };
    try {
      isci.postMessage(istek);
    } catch (hata) {
      kapat();
      reddet(hata);
    }
  });
}

export const musteriMotoru: MusteriMotoru = {
  async listeOku(dosya, signal) {
    const yanit = await isciIslemi({ tur: 'oku', dosya }, signal);
    signal.throwIfAborted();
    if (yanit.tur !== 'liste') throw new KullaniciHatasi('Excel okuma sonucu doğrulanamadı.');
    return yanit.liste;
  },
  async excelOlustur(cikti, signal) {
    const yanit = await isciIslemi({ tur: 'excel', cikti }, signal);
    signal.throwIfAborted();
    if (yanit.tur !== 'excel') throw new KullaniciHatasi('Excel çıktısı doğrulanamadı.');
    return yanit.bayt;
  },
};
