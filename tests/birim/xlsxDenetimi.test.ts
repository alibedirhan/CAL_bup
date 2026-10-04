import JSZip from 'jszip';
import { beforeAll, describe, expect, it } from 'vitest';
import { arsiviDenetle } from '../../src/kaynaklar/xlsxDenetimi';

let ornek: Uint8Array;
let dizin: number[];
beforeAll(async () => {
  const z = new JSZip();
  for (const ad of ['a.xml', 'b.xml', 'c.xml']) z.file(ad, '<yapay/>');
  ornek = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  dizin = [];
  const v = new DataView(ornek.buffer);
  for (let p = 0; p < ornek.length - 4; p++) if (v.getUint32(p, true) === 0x02014b50) dizin.push(p);
});
const degistir = (is: (v: DataView, b: Uint8Array, d: number[]) => void) => {
  const b = ornek.slice();
  is(new DataView(b.buffer), b, dizin);
  return b;
};

describe('ZIP yapısı ve kesin metaveri sınırları', () => {
  it('normal ve tamponun alt görünümündeki arşivi kabul eder', () => {
    expect(() => arsiviDenetle(ornek)).not.toThrow();
    const tampon = new Uint8Array(ornek.length + 8);
    tampon.set(ornek, 4);
    expect(() => arsiviDenetle(tampon.subarray(4, -4))).not.toThrow();
  });
  it('50 MiB parça / 100 MiB toplam tam sınırını kabul eder, bir bayt aşımını reddeder', () => {
    const sinir = degistir((v, _b, d) => {
      d.forEach((p, i) => v.setUint32(p + 24, i < 2 ? 50 * 1024 * 1024 : 0, true));
    });
    expect(() => arsiviDenetle(sinir)).not.toThrow();
    new DataView(sinir.buffer).setUint32((dizin[2] ?? 0) + 24, 1, true);
    expect(() => arsiviDenetle(sinir)).toThrow(/sınır/);
    expect(() =>
      arsiviDenetle(degistir((v, _b, d) => v.setUint32((d[0] ?? 0) + 24, 50 * 1024 * 1024 + 1, true))),
    ).toThrow(/sınır/);
  });
  it.each(['adres', 'yontem', 'sifreleme', 'ad', 'boyut', 'zip64'] as const)(
    'bozuk yerel kayıt: %s',
    (tur) => {
      const b = degistir((v, b, d) => {
        const p = d[0] ?? 0;
        const yerel = v.getUint32(p + 42, true);
        if (tur === 'adres') v.setUint32(p + 42, b.length - 1, true);
        if (tur === 'yontem') {
          v.setUint16(p + 10, 12, true);
          v.setUint16(yerel + 8, 12, true);
        }
        if (tur === 'sifreleme') {
          v.setUint16(p + 8, 0x41, true);
          v.setUint16(yerel + 6, 0x41, true);
        }
        if (tur === 'ad') b[yerel + 30] = 120;
        if (tur === 'boyut') v.setUint32(p + 20, b.length, true);
        if (tur === 'zip64') v.setUint32(p + 42, 0xffffffff, true);
      });
      expect(() => arsiviDenetle(b)).toThrow(/bozuk/);
    },
  );
  it('yinelenen parça adıyla ilk XML sessizce ezilemez', () => {
    const b = degistir((v, b, d) => {
      const ilk = d[0] ?? 0;
      const ikinci = d[1] ?? 0;
      const ad = b.slice(ilk + 46, ilk + 51);
      b.set(ad, ikinci + 46);
      b.set(ad, v.getUint32(ikinci + 42, true) + 30);
    });
    expect(() => arsiviDenetle(b)).toThrow(/bozuk/);
  });
  it('başka parçanın yerel başlığına taşan sıkıştırılmış veri reddedilir', () => {
    const b = degistir((v, _b, d) => {
      const p = d[0] ?? 0;
      const yerel = v.getUint32(p + 42, true);
      const veriBasi = yerel + 30 + v.getUint16(yerel + 26, true) + v.getUint16(yerel + 28, true);
      const ikinciYerel = v.getUint32((d[1] ?? 0) + 42, true);
      v.setUint32(p + 20, ikinciYerel - veriBasi + 1, true);
    });
    expect(() => arsiviDenetle(b)).toThrow(/bozuk/);
  });
});
