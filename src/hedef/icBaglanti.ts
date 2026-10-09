// ExcelJS 4.4.0 iç bağlantıya ("Sayfa!A1", location) da dış ilişki (r:id, TargetMode="External")
// yazıyor; Excel bu durumda bağlantıyı dosya sanabilir. Excel'in kendi yazdığı gibi yalnız location
// bırakılır ve kullanılmayan ilişki silinir. İç bağlantı yoksa baytlar olduğu gibi döner.

import JSZip from 'jszip';

const SAYFA = /^xl\/worksheets\/sheet\d+\.xml$/;

export async function icBaglantilariDuzelt(bayt: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bayt);
  let degisti = false;
  for (const ad of Object.keys(zip.files).filter((a) => SAYFA.test(a))) {
    const dosya = zip.file(ad);
    if (!dosya) continue;
    const idler: string[] = [];
    const xml = (await dosya.async('string')).replace(/<hyperlink\b[^>]*>/g, (etiket) => {
      const id = /\sr:id="([^"]+)"/.exec(etiket);
      if (!id?.[1] || !/\slocation="/.test(etiket)) return etiket;
      idler.push(id[1]);
      return etiket.replace(id[0], '');
    });
    if (!idler.length) continue;
    zip.file(ad, xml);
    const iliskiAdi = ad.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels';
    const iliski = zip.file(iliskiAdi);
    if (iliski) {
      let r = await iliski.async('string');
      for (const id of idler) r = r.replace(new RegExp(`<Relationship\\b[^>]*\\bId="${id}"[^>]*/>`), '');
      zip.file(iliskiAdi, r);
    }
    degisti = true;
  }
  return degisti ? zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }) : bayt;
}
