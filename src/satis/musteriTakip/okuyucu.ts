import { KullaniciHatasi } from '../../cekirdek/hata';
import type { MusteriListesi } from '../../cekirdek/musteriTakip/turler';
import { arsiviDenetle } from '../../kaynaklar/xlsxDenetimi';
import { pythonCalistir, pythonMotoru } from '../../platform/python/motor';
import type { MusteriMotoru } from './portlar';

/** Özgün openpyxl okuyucusu: hücre türünü JS dönüşümünde kaybetmeden okur. */
export const musteriListeOku: MusteriMotoru['listeOku'] = async (dosya, signal) => {
  signal.throwIfAborted();
  if (!/\.xlsx$/i.test(dosya.ad)) throw new KullaniciHatasi('Yalnızca .xlsx dosyaları kullanılabilir.');
  if (dosya.bayt.byteLength > 25 * 1024 * 1024) throw new KullaniciHatasi('Dosya en fazla 25 MB olabilir.');
  arsiviDenetle(dosya.bayt);
  const p = await pythonMotoru('musteri');
  signal.throwIfAborted();
  const yol = '/cal/girdiler/Yapay.xlsx';
  p.FS.mkdirTree('/cal/girdiler');
  p.FS.writeFile(yol, dosya.bayt);
  const sonuc = pythonCalistir(p, { tur: 'musteri', yol }) as {
    tur: string;
    liste?: MusteriListesi;
    mesaj?: string;
  };
  signal.throwIfAborted();
  if (sonuc.tur === 'hata') throw new KullaniciHatasi(sonuc.mesaj ?? 'Müşteri dosyası okunamadı.');
  if (sonuc.tur !== 'liste' || !sonuc.liste) throw new KullaniciHatasi('Müşteri listesi doğrulanamadı.');
  return sonuc.liste;
};
