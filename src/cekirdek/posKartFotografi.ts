import { KullaniciHatasi } from './hata';
import { kartNumarasi } from './posKart';

export const EN_BUYUK_KART_FOTOGRAFI = 10 * 1024 * 1024;
export const EN_FAZLA_KART_PIKSELI = 20_000_000;
export interface KartOkumaSonucu {
  numaralar: string[];
  tarihler: { ay: string; yil: string }[];
}

/** Ham metin dışarı çıkmaz: yalnızca numara/tarih adayları; CVV, ad ve telefon çıkarılmaz. */
export function kartMetnindenAlanlar(metin: string): KartOkumaSonucu {
  if (metin.length > 100_000)
    throw new KullaniciHatasi('Fotoğrafta çok fazla metin var. Daha yakın bir kart fotoğrafı seçin.');
  const numaralar = new Set<string>();
  const tarihler = new Map<string, { ay: string; yil: string }>();
  for (const satir of metin.split(/[\r\n]/)) {
    for (const eslesme of satir.matchAll(/(?<![0-9])(?:[0-9][ -]?){11,18}[0-9](?![0-9])/g)) {
      try {
        numaralar.add(kartNumarasi(eslesme[0].replace(/-/g, '')));
      } catch {
        /* Aday geçersiz. */
      }
    }
    for (const m of satir.matchAll(/(?<![0-9])(0[1-9]|1[0-2])\s*[/.-]\s*(20[0-9]{2}|[0-9]{2})(?![0-9])/g)) {
      if (!m[1] || !m[2]) continue;
      const ay = m[1];
      const yil = m[2].length === 2 ? '20' + m[2] : m[2];
      tarihler.set(ay + yil, { ay, yil });
    }
  }
  return { numaralar: [...numaralar], tarihler: [...tarihler.values()] };
}
/** Başlıktaki piksel sınırı görüntüyü çözmeden uygulanır. Dosya adı/MIME tek başına güvenilmez. */
export function kartGoruntuBoyutu(b: Uint8Array): { genislik: number; yukseklik: number } {
  const hata = () => new KullaniciHatasi('Geçerli bir JPG, PNG veya WebP kart fotoğrafı seçin.');
  if (b.length < 30 || b.length > EN_BUYUK_KART_FOTOGRAFI) throw hata();
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const g = (i: number) => v.getUint8(i);
  let genislik = 0;
  let yukseklik = 0;
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => b[i] === x) &&
    String.fromCharCode(...b.slice(12, 16)) === 'IHDR'
  ) {
    genislik = v.getUint32(16);
    yukseklik = v.getUint32(20);
  } else if (b[0] === 255 && b[1] === 216) {
    for (let i = 2; i + 8 < b.length;) {
      if (b[i] !== 255) throw hata();
      while (i < b.length && b[i] === 255) i++;
      const marker = b[i++];
      if (marker === undefined) throw hata();
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (i + 2 > b.length) throw hata();
      const uzunluk = v.getUint16(i);
      if (uzunluk < 2 || i + uzunluk > b.length) throw hata();
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (uzunluk < 8) throw hata();
        yukseklik = v.getUint16(i + 3);
        genislik = v.getUint16(i + 5);
        break;
      }
      i += uzunluk;
    }
  } else if (
    String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...b.slice(8, 12)) === 'WEBP'
  ) {
    const tur = String.fromCharCode(...b.slice(12, 16));
    if (tur === 'VP8X') {
      if (g(20) & 2) throw new KullaniciHatasi('Hareketli fotoğraf yerine sabit JPG/PNG seçin.');
      genislik = 1 + g(24) + (g(25) << 8) + (g(26) << 16);
      yukseklik = 1 + g(27) + (g(28) << 8) + (g(29) << 16);
    } else if (tur === 'VP8L' && b[20] === 47) {
      const alan = v.getUint32(21, true);
      genislik = 1 + (alan & 16383);
      yukseklik = 1 + ((alan >>> 14) & 16383);
    } else if (tur === 'VP8 ' && b[23] === 157 && b[24] === 1 && b[25] === 42) {
      genislik = v.getUint16(26, true) & 16383;
      yukseklik = v.getUint16(28, true) & 16383;
    }
  }
  if (!genislik || !yukseklik) throw hata();
  if (genislik * yukseklik > EN_FAZLA_KART_PIKSELI)
    throw new KullaniciHatasi(
      'Kart fotoğrafı en fazla 20 megapiksel olabilir. Daha küçük bir fotoğraf seçin.',
    );
  return { genislik, yukseklik };
}
