import { KullaniciHatasi } from '../../cekirdek/hata';
import { musteriListeOku } from './okuyucu';
import type { MotorIstegi, MotorYaniti } from './workerSozlesmesi';

self.onmessage = async (olay: MessageEvent<MotorIstegi>) => {
  const signal = new AbortController().signal;
  let yanit: MotorYaniti;
  try {
    const istek = olay.data;
    yanit =
      istek.tur === 'oku'
        ? { tur: 'liste', liste: await musteriListeOku(istek.dosya, signal) }
        : { tur: 'excel', bayt: await (await import('./motor')).musteriExcelOlustur(istek.cikti, signal) };
  } catch (hata) {
    yanit = {
      tur: 'hata',
      mesaj:
        hata instanceof KullaniciHatasi
          ? hata.message
          : 'Excel işlemi tamamlanamadı. Dosyayı kontrol edip yeniden deneyin.',
    };
  }
  self.postMessage(yanit);
};
