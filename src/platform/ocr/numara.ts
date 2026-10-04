/** Numara şeridi: aynı fotoğraf/yönden türetilir, rakamları onarmaz.
 * Dört sınırlı deneme: renkli, koyu, açık ve kabartma. Tuval motor sonunda sıfırlanır. */
export function numaraSeridi(
  kaynak: HTMLCanvasElement,
  kip: 'renk' | 'koyu' | 'acik' | 'kabartma',
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = kaynak.width;
  c.height = Math.ceil(kaynak.height * 0.45);
  const x = c.getContext('2d');
  if (!x) throw new Error('Canvas yok');
  x.drawImage(kaynak, 0, kaynak.height * 0.2, kaynak.width, kaynak.height * 0.45, 0, 0, c.width, c.height);
  if (kip !== 'renk') {
    const d = x.getImageData(0, 0, c.width, c.height),
      p = d.data;
    const histogram = new Uint32Array(256);
    for (let i = 0; i < p.length; i += 4) {
      const y = Math.round(0.299 * (p[i] ?? 0) + 0.587 * (p[i + 1] ?? 0) + 0.114 * (p[i + 2] ?? 0));
      p[i] = y;
      histogram[y] = (histogram[y] ?? 0) + 1;
    }
    const n = p.length / 4;
    let toplam = 0;
    for (let i = 0; i < 256; i++) toplam += i * (histogram[i] ?? 0);
    let adet = 0,
      sum = 0,
      en = 0,
      esik = 128;
    for (let i = 0; i < 255; i++) {
      adet += histogram[i] ?? 0;
      sum += i * (histogram[i] ?? 0);
      if (!adet || adet === n) continue;
      const fark = sum / adet - (toplam - sum) / (n - adet),
        puan = adet * (n - adet) * fark * fark;
      if (puan > en) {
        en = puan;
        esik = i;
      }
    }
    if (kip === 'kabartma') {
      let enCok = 0;
      for (let i = 0; i < 256; i++)
        if ((histogram[i] ?? 0) > enCok) {
          enCok = histogram[i] ?? 0;
          esik = i - 5;
        }
    }
    for (let i = 0; i < p.length; i += 4) {
      const koyu = (p[i] ?? 0) <= esik;
      p[i] = p[i + 1] = p[i + 2] = (kip !== 'acik' ? koyu : !koyu) ? 0 : 255;
    }
    x.putImageData(d, 0, 0);
    p.fill(0);
  }
  return c;
}
