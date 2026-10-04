import { KullaniciHatasi } from '../../cekirdek/hata';
import { pythonCalistir, pythonMotoru } from '../../platform/python/motor';
import {
  excelGirdisiniDogrula,
  karlilikKaydiniDogrula,
  senaryoOranlariniDogrula,
} from '../../cekirdek/karlilik/dogrulama';
import { arsiviDenetle } from '../../kaynaklar/xlsxDenetimi';
import type { KarlilikIstegi } from '../../cekirdek/karlilik/turler';
self.onmessage = async (olay: MessageEvent<KarlilikIstegi>) => {
  try {
    const istek = olay.data;
    karlilikKaydiniDogrula(istek.kayit);
    if (istek.oranlar) senaryoOranlariniDogrula(istek.oranlar);
    for (const d of [istek.satis, istek.fiyat])
      if (d) {
        excelGirdisiniDogrula(d.ad, d.bayt.byteLength, d.bayt);
        arsiviDenetle(d.bayt);
      }
    const p = await pythonMotoru('karlilik');
    const veri: Record<string, unknown> = { ...istek };
    for (const tur of ['satis', 'fiyat'] as const)
      if (istek[tur]) {
        const yol = `/cal/girdiler/${tur}.xlsx`;
        p.FS.mkdirTree('/cal/girdiler');
        p.FS.writeFile(yol, istek[tur].bayt);
        veri[tur] = yol;
      }
    const sonuc = pythonCalistir(p, veri) as { tur: string; yol?: string; ad?: string };
    if (sonuc.tur === 'dosya' && sonuc.yol && sonuc.ad) {
      const bayt = new Uint8Array(p.FS.readFile(sonuc.yol));
      if (!bayt.length || bayt.length > 100 * 1024 * 1024)
        throw new KullaniciHatasi('Excel çıktısı 100 MB sınırını aşıyor.');
      self.postMessage({ tur: 'dosya', ad: sonuc.ad, bayt }, { transfer: [bayt.buffer] });
    } else self.postMessage(sonuc);
  } catch (e) {
    self.postMessage({
      tur: 'hata',
      mesaj:
        e instanceof KullaniciHatasi
          ? e.message
          : 'Kârlılık işlemi tamamlanamadı. Dosyaları kontrol edip yeniden deneyin.',
    });
  }
};
