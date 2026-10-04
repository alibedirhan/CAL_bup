import { KullaniciHatasi } from '../cekirdek/hata';
import { karakterSayisi, metniKisalt } from '../cekirdek/musteriTakip/metin';
import type { MusteriCiktisi } from '../cekirdek/musteriTakip/turler';

const SAYFA_SATIRI = 200;

/** Masaüstü PNG'nin kapsamı aynı; piksel bütçesi için uzun liste ayrı sayfalardır. */
export async function musteriResimleri(cikti: MusteriCiktisi, signal: AbortSignal): Promise<Uint8Array[]> {
  signal.throwIfAborted();
  if (cikti.gorunen || cikti.satirlar.length > 5000)
    throw new KullaniciHatasi(
      'Resim çıktısı yalnız tam eksik listesi içindir; en fazla 5.000 satır olabilir. Daha büyük liste için Excel kullanın.',
    );
  await document.fonts.load('16px Onest Variable');
  signal.throwIfAborted();
  const sonuc: Uint8Array[] = [];
  const sayfalar = Math.max(1, Math.ceil(cikti.satirlar.length / SAYFA_SATIRI));
  for (let sayfa = 0; sayfa < sayfalar; sayfa++) {
    signal.throwIfAborted();
    const satirlar = cikti.satirlar.slice(sayfa * SAYFA_SATIRI, (sayfa + 1) * SAYFA_SATIRI);
    const tuval = document.createElement('canvas');
    tuval.width = 1440;
    tuval.height = 150 + Math.max(1, satirlar.length) * 40;
    try {
      const c = tuval.getContext('2d');
      if (!c) throw new KullaniciHatasi('Resim oluşturulamadı. Excel çıktısını kullanabilirsiniz.');
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, tuval.width, tuval.height);
      c.fillStyle = '#000000';
      c.font = 'bold 24px Onest Variable, sans-serif';
      c.fillText(cikti.baslik || 'Eksik Cari Ünvanlar', 40, 40, 1360);
      if (sayfalar > 1) {
        c.font = '16px Onest Variable, sans-serif';
        c.fillText(`Sayfa ${sayfa + 1} / ${sayfalar}`, 40, 70);
      }
      const ciz = (no: string, ad: string, r: number, baslik = false) => {
        const y = 90 + r * 40;
        c.fillStyle = baslik ? '#e6e6e6' : r % 2 === 0 ? '#f9f9f9' : '#ffffff';
        c.fillRect(40, y, 1360, 40);
        c.strokeStyle = '#777777';
        c.strokeRect(40, y, 1360, 40);
        c.strokeRect(40, y, 120, 40);
        c.fillStyle = '#000000';
        c.font = `${baslik ? 'bold ' : ''}16px Onest Variable, sans-serif`;
        c.fillText(no, 56, y + 26, 100);
        const goster = karakterSayisi(ad) > 80 ? `${metniKisalt(ad, 77)}...` : ad;
        c.fillText(goster, 180, y + 26, 1200);
      };
      ciz('#', 'Cari Ünvan', 0, true);
      if (!satirlar.length) ciz('', 'Tüm cari ünvanlar her iki dosyada da mevcut.', 1);
      satirlar.forEach((ad, i) => ciz(String(sayfa * SAYFA_SATIRI + i + 1), ad, i + 1));
      const blob = await new Promise<Blob>((coz, reddet) =>
        tuval.toBlob(
          (b) =>
            b
              ? coz(b)
              : reddet(new KullaniciHatasi('Resim oluşturulamadı. Excel çıktısını kullanabilirsiniz.')),
          'image/png',
        ),
      );
      signal.throwIfAborted();
      sonuc.push(new Uint8Array(await blob.arrayBuffer()));
      signal.throwIfAborted();
    } finally {
      tuval.width = 0;
      tuval.height = 0;
    }
  }
  return sonuc;
}
