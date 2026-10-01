import JSZip from 'jszip';

/** .xlsx içindeki bir XML parçası (ör. "xl/workbook.xml"). ExcelJS'in geri okumadığı ayarlar için. */
export async function xlsxParcasi(bayt: Uint8Array, yol: string): Promise<string> {
  const zip = await JSZip.loadAsync(bayt);
  const dosya = zip.file(yol);
  if (!dosya) throw new Error(`${yol} yok`);
  return dosya.async('string');
}

/** Adı desene uyan bütün XML parçaları (ör. bütün sayfalar). */
export async function xlsxParcalari(bayt: Uint8Array, desen: RegExp): Promise<string[]> {
  const zip = await JSZip.loadAsync(bayt);
  const dosyalar = Object.values(zip.files).filter((f) => desen.test(f.name));
  return Promise.all(dosyalar.map((f) => f.async('string')));
}
