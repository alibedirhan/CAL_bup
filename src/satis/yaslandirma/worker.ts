import { KullaniciHatasi } from '../../cekirdek/hata';
import { pythonCalistir, pythonMotoru } from '../../platform/python/motor';
import { atamaKaydiniDogrula, excelGirdisiniDogrula } from '../../cekirdek/yaslandirma/dogrulama';
import { arsiviDenetle } from '../../kaynaklar/xlsxDenetimi';
import type { YaslandirmaIstegi } from '../../cekirdek/yaslandirma/turler';

/** Tarayıcı saati kaynağın atama saati portudur (yerel zaman, saniye hassasiyeti). */
function yerelTarih(d = new Date()) {
  const s = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString();
  return s.slice(0, 19);
}
self.onmessage = async (olay: MessageEvent<YaslandirmaIstegi>) => {
  try {
    const istek = olay.data;
    if ('dosya' in istek) {
      excelGirdisiniDogrula(istek.dosya.ad, istek.dosya.bayt.byteLength, istek.dosya.bayt);
      arsiviDenetle(istek.dosya.bayt);
    }
    const veri: Record<string, unknown> = { tur: 'yaslandirma', eylem: istek.eylem, tarih: yerelTarih() };
    if ('kayit' in istek) {
      const k = atamaKaydiniDogrula(istek.kayit);
      veri.kayit = { guncel: k.guncel, yedek: k.yedek };
    }
    if (istek.eylem === 'ata') veri.atama = istek.atama;
    if (istek.eylem === 'kaldir') veri.aracNo = istek.aracNo;
    if (istek.eylem === 'gorunen') veri.araclar = istek.araclar;
    const p = await pythonMotoru('yaslandirma');
    if ('dosya' in istek) {
      p.FS.mkdirTree('/cal/girdiler');
      p.FS.writeFile('/cal/girdiler/yaslandirma.xlsx', istek.dosya.bayt);
      veri.yol = '/cal/girdiler/yaslandirma.xlsx';
    }
    const sonuc = pythonCalistir(p, veri) as { tur: string; yol?: string; ad?: string };
    if (sonuc.tur === 'dosya' && sonuc.yol && sonuc.ad) {
      const bayt = new Uint8Array(p.FS.readFile(sonuc.yol));
      p.FS.unlink(sonuc.yol);
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
          : 'Yaşlandırma işlemi tamamlanamadı. Dosyayı kontrol edip yeniden deneyin.',
    });
  }
};
