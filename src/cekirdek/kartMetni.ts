import { KullaniciHatasi } from './hata';
import { kartNumarasi } from './posKart';
import type { KartOkumaSonucu } from './posKartFotografi';
/** Tarih PAN dizisinden önce ayrılır. Rakam tahmin edilmez; Luhn onarımı yapılmaz. */
export function kartMetniniCoz(metin: string): KartOkumaSonucu {
  if (metin.length > 100_000)
    throw new KullaniciHatasi('Fotoğrafta çok fazla metin var. Daha yakın bir kart fotoğrafı seçin.');
  const tarihler = new Map<string, { ay: string; yil: string }>();
  const ekle = (ay: string, yil: string) => {
    ay = ay.padStart(2, '0');
    yil = yil.length === 2 ? '20' + yil : yil;
    tarihler.set(ay + yil, { ay, yil });
  };
  const temiz = metin
    .replace(
      /(?<![0-9])(0?[1-9]|1[0-2])\s*[/.-]\s*(20[0-9]{2}|[0-9]{2})(?![0-9])/g,
      (_, a: string, y: string) => {
        ekle(a, y);
        return '|';
      },
    )
    .replace(
      /(?:VALID\s*THRU|EXP(?:IRY)?|SON\s*KULLANMA)\s*:?[ \t]*(0[1-9]|1[0-2])([0-9]{2})(?![0-9])/gi,
      (_, a: string, y: string) => {
        ekle(a, y);
        return '|';
      },
    );
  const numaralar = new Set<string>();
  const dene = (s: string) => {
    const n = s.replace(/[\s-]/g, '');
    // Rakam kısıtlı OCR, PAN yanındaki CVV etiketini kaybedebilir.
    // Geçerli PAN + 3/4 ek rakamdan oluşabilen uzun aday belirsizdir; parça çıkarılmaz.
    if (n.length > 16) {
      for (const son of [3, 4]) {
        try {
          kartNumarasi(n.slice(0, -son));
          return;
        } catch {
          /* Geçerli kısa PAN yok; tam aday ayrıca doğrulanır. */
        }
      }
    }
    try {
      numaralar.add(kartNumarasi(n));
    } catch {
      /* Geçersiz aday tahminle düzeltilmez. */
    }
  };
  const satirlar = temiz.split(/[\r\n]+/);
  for (let i = 0; i < satirlar.length; i++) {
    const satir = satirlar[i] ?? '';
    for (const m of satir.matchAll(/[0-9](?:[0-9 \t-]*[0-9])?/g)) dene(m[0]);
    // Yalnızca iki ayrı, kısa rakam satırı: CVV/telefon satırları birleştirilmez.
    const sonraki = satirlar[i + 1] ?? '';
    if (/^[ \t]*[0-9][0-9 \t-]*[ \t]*$/.test(satir) && /^[ \t]*[0-9][0-9 \t-]*[ \t]*$/.test(sonraki)) {
      const a = satir.replace(/\D/g, '');
      const b = sonraki.replace(/\D/g, '');
      if (a.length >= 6 && a.length <= 11 && b.length >= 6 && b.length <= 11) dene(a + b);
    }
  }
  return { numaralar: [...numaralar], tarihler: [...tarihler.values()] };
}
