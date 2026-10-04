import { KullaniciHatasi } from '../../cekirdek/hata';
import { pythonCalistir, pythonMotoru } from '../../platform/python/motor';
import {
  belgeleriDogrula,
  iskontoOranlariniDogrula,
  pdfGirdisiniDogrula,
} from '../../cekirdek/iskonto/dogrulama';
import type { IskontoIstegi } from './workerSozlesmesi';

self.onmessage = async (olay: MessageEvent<IskontoIstegi>) => {
  try {
    const istek = olay.data;
    if (istek.tur === 'yukle') {
      if (!istek.dosyalar.length || istek.dosyalar.length > 3)
        throw new KullaniciHatasi('En fazla üç PDF seçin.');
      for (const d of istek.dosyalar) pdfGirdisiniDogrula(d.ad, d.bayt.byteLength, d.bayt);
    } else {
      belgeleriDogrula(istek.belgeler);
      iskontoOranlariniDogrula(istek.oranlar);
    }
    const p = await pythonMotoru('iskonto', istek.tur);
    let veri: unknown = istek;
    if (istek.tur === 'yukle') {
      veri = {
        tur: 'yukle',
        dosyalar: istek.dosyalar.map((d, i) => {
          const yol = `/cal/girdiler/${i}/liste.pdf`;
          p.FS.mkdirTree(`/cal/girdiler/${i}`);
          p.FS.writeFile(yol, d.bayt);
          return { ad: d.ad, yol };
        }),
      };
    }
    const sonuc = pythonCalistir(p, veri) as { tur: string; yol?: string; ad?: string };
    if (sonuc.tur === 'dosya' && sonuc.yol && sonuc.ad) {
      const bayt = new Uint8Array(p.FS.readFile(sonuc.yol));
      if (!bayt.length || bayt.length > 100 * 1024 * 1024)
        throw new KullaniciHatasi('Çıktı 100 MB güvenli sınırını aşıyor.');
      self.postMessage({ tur: 'dosya', ad: sonuc.ad, bayt }, { transfer: [bayt.buffer] });
    } else self.postMessage(sonuc);
  } catch (hata) {
    self.postMessage({
      tur: 'hata',
      mesaj:
        hata instanceof KullaniciHatasi
          ? hata.message
          : 'Fiyat listesi işlemi tamamlanamadı. Dosyayı kontrol edip yeniden deneyin.',
    });
  }
};
