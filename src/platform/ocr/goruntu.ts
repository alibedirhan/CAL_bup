import { KullaniciHatasi } from '../../cekirdek/hata';
import {
  EN_BUYUK_KART_FOTOGRAFI,
  EN_FAZLA_KART_PIKSELI,
  kartGoruntuBoyutu,
  type KartGoruntuDuzeltmesi,
} from '../../cekirdek/posKartFotografi';
export function okumaSuruyor(signal: AbortSignal): void {
  if (signal.aborted) throw new KullaniciHatasi('Fotoğraf okuma durduruldu.');
}
/** Dosya başlığı çözmeden, gerçek boyut çözmeden sonra denetlenir; URL/ham bayt saklanmaz. */
export async function kartGoruntusu(
  dosya: File,
  signal: AbortSignal,
  d: KartGoruntuDuzeltmesi,
): Promise<HTMLCanvasElement> {
  if (!dosya.size || dosya.size > EN_BUYUK_KART_FOTOGRAFI)
    throw new KullaniciHatasi('Kart fotoğrafı en fazla 10 MB olabilir.');
  if (
    ![0, 90, 180, 270].includes(d.donus) ||
    !Object.values(d).every(Number.isFinite) ||
    Math.abs(d.egim) > 20 ||
    d.sol < 0 ||
    d.ust < 0 ||
    d.genislik < 10 ||
    d.yukseklik < 10 ||
    d.sol + d.genislik > 100 ||
    d.ust + d.yukseklik > 100
  )
    throw new KullaniciHatasi('Kırpma ve döndürme alanlarını kontrol edin.');
  let b: Uint8Array | undefined;
  let bitmap: ImageBitmap | undefined;
  const canvas = document.createElement('canvas');
  try {
    okumaSuruyor(signal);
    b = new Uint8Array(await dosya.arrayBuffer());
    kartGoruntuBoyutu(b);
    okumaSuruyor(signal);
    bitmap = await createImageBitmap(dosya);
    okumaSuruyor(signal);
    if (bitmap.width * bitmap.height > EN_FAZLA_KART_PIKSELI)
      throw new KullaniciHatasi('Fotoğraf en fazla 20 megapiksel olabilir.');
    const w = (bitmap.width * d.genislik) / 100;
    const h = (bitmap.height * d.yukseklik) / 100;
    const a = ((d.donus + d.egim) * Math.PI) / 180;
    const bw = Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * h;
    const bh = Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * h;
    const oran = Math.min(2, 2400 / Math.max(bw, bh));
    canvas.width = Math.ceil(bw * oran);
    canvas.height = Math.ceil(bh * oran);
    const x = canvas.getContext('2d');
    if (!x) throw new KullaniciHatasi('Tarayıcı fotoğrafı açamadı.');
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, canvas.width, canvas.height);
    x.translate(canvas.width / 2, canvas.height / 2);
    x.rotate(a);
    x.drawImage(
      bitmap,
      (bitmap.width * d.sol) / 100,
      (bitmap.height * d.ust) / 100,
      w,
      h,
      (-w * oran) / 2,
      (-h * oran) / 2,
      w * oran,
      h * oran,
    );
    return canvas;
  } catch (e) {
    canvas.width = 0;
    canvas.height = 0;
    throw e;
  } finally {
    bitmap?.close();
    b?.fill(0);
  }
}
/** En fazla 2400² piksellik geçici tuval; motor denemeleri bununla sınırlıdır. */
export function goruntuyuDondur(
  kaynak: HTMLCanvasElement,
  donus: number,
  kontrast = false,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const a = (donus * Math.PI) / 180;
  const w = Math.abs(Math.cos(a)) * kaynak.width + Math.abs(Math.sin(a)) * kaynak.height;
  const h = Math.abs(Math.sin(a)) * kaynak.width + Math.abs(Math.cos(a)) * kaynak.height;
  const oran = Math.min(1, 2400 / Math.max(w, h));
  c.width = Math.ceil(w * oran - 1e-7);
  c.height = Math.ceil(h * oran - 1e-7);
  const x = c.getContext('2d');
  if (!x) throw new KullaniciHatasi('Fotoğraf hazırlanamadı.');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, c.width, c.height);
  x.translate(c.width / 2, c.height / 2);
  x.rotate((donus * Math.PI) / 180);
  x.drawImage(
    kaynak,
    (-kaynak.width * oran) / 2,
    (-kaynak.height * oran) / 2,
    kaynak.width * oran,
    kaynak.height * oran,
  );
  if (kontrast) {
    const veri = x.getImageData(0, 0, c.width, c.height);
    const p = veri.data;
    let enAz = 255,
      enCok = 0,
      toplam = 0;
    for (let i = 0; i < p.length; i += 4) {
      const y = Math.round(0.299 * (p[i] ?? 0) + 0.587 * (p[i + 1] ?? 0) + 0.114 * (p[i + 2] ?? 0));
      p[i] = y;
      enAz = Math.min(enAz, y);
      enCok = Math.max(enCok, y);
      toplam += y;
    }
    const ters = toplam / (p.length / 4) < 128;
    for (let i = 0; i < p.length; i += 4) {
      const y = Math.round((((p[i] ?? 0) - enAz) * 255) / Math.max(1, enCok - enAz));
      p[i] = p[i + 1] = p[i + 2] = ters ? 255 - y : y;
    }
    x.putImageData(veri, 0, 0);
    p.fill(0);
  }
  return c;
}

/** Satır yoğunluğuyla küçük eğiklik: 41 açı, en fazla 360² örnek piksel.
 * Rakam tahmin edilmez. Çok tekdüze görüntüler değiştirilmez. */
export function egimiBul(kaynak: HTMLCanvasElement): number {
  const c = document.createElement('canvas');
  const oran = Math.min(1, 360 / Math.max(kaynak.width, kaynak.height));
  c.width = Math.round(kaynak.width * oran);
  c.height = Math.round(kaynak.height * oran);
  const x = c.getContext('2d');
  if (!x) return 0;
  x.drawImage(kaynak, 0, 0, c.width, c.height);
  const p = x.getImageData(0, 0, c.width, c.height).data;
  let enAz = 255,
    enCok = 0,
    toplam = 0;
  for (let i = 0; i < p.length; i += 4) {
    const y = Math.round(0.299 * (p[i] ?? 0) + 0.587 * (p[i + 1] ?? 0) + 0.114 * (p[i + 2] ?? 0));
    p[i] = y;
    toplam += y;
    enAz = Math.min(enAz, y);
    enCok = Math.max(enCok, y);
  }
  const ters = toplam / (p.length / 4) < 128;
  const esik = (enAz + enCok) / 2;
  const noktalar: [number, number][] = [];
  if (enCok - enAz > 8)
    for (let i = 0; i < p.length; i += 4) {
      if (ters ? (p[i] ?? 0) > esik : (p[i] ?? 0) < esik)
        noktalar.push([((i / 4) % c.width) - c.width / 2, Math.floor(i / 4 / c.width) - c.height / 2]);
    }
  p.fill(0);
  c.width = 0;
  c.height = 0;
  if (noktalar.length < 100 || noktalar.length > 60_000) return 0;
  let enIyi = 0,
    puan = 0,
    duzPuan = 0;
  for (let derece = -20; derece <= 20; derece++) {
    const a = (derece * Math.PI) / 180,
      sin = Math.sin(a),
      cos = Math.cos(a);
    const satirlar = new Uint32Array(1024);
    for (const [px, py] of noktalar) {
      const i = Math.round(px * sin + py * cos) + 512;
      satirlar[i] = (satirlar[i] ?? 0) + 1;
    }
    let s = 0;
    for (const n of satirlar) s += n * n;
    if (derece === 0) duzPuan = s;
    if (s > puan) {
      puan = s;
      enIyi = derece;
    }
  }
  return puan > duzPuan * 1.15 ? enIyi : 0;
}
