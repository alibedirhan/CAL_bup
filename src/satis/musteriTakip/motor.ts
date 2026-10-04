import ExcelJS from 'exceljs';
import { guvenliHucre } from '../../cekirdek/musteriTakip/cikti';
import type { MusteriCiktisi } from '../../cekirdek/musteriTakip/turler';
import { kitapAc } from '../../kaynaklar/excel';
import { musteriListesiOku } from '../../kaynaklar/musteriListesi';
import type { MusteriMotoru } from './portlar';

const KENAR: Partial<ExcelJS.Border> = { style: 'thin' };

function satirYaz(
  sayfa: ExcelJS.Worksheet,
  r: number,
  degerler: readonly (string | number)[],
  baslik = false,
): void {
  degerler.forEach((deger, i) => {
    const h = sayfa.getCell(r, i + 1);
    h.value = typeof deger === 'string' ? guvenliHucre(deger) : deger;
    h.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' }, bold: baslik };
    h.alignment = { horizontal: baslik || i === 0 ? 'center' : 'left', vertical: 'middle' };
    h.border = { left: KENAR, right: KENAR, top: KENAR, bottom: KENAR };
  });
}

export async function musteriExcelOlustur(cikti: MusteriCiktisi, signal: AbortSignal): Promise<Uint8Array> {
  signal.throwIfAborted();
  const kitap = new ExcelJS.Workbook();
  const sayfa = kitap.addWorksheet(cikti.gorunen ? 'Görünen Satırlar' : 'Sheet1');
  let baslikSatiri = 1;
  if (!cikti.gorunen && cikti.baslik) {
    sayfa.mergeCells('A1:B1');
    satirYaz(sayfa, 1, [cikti.baslik], true);
    sayfa.getCell('A1').font = { ...sayfa.getCell('A1').font, size: 12 };
    baslikSatiri = 3;
  }
  satirYaz(sayfa, baslikSatiri, ['#', 'Cari Ünvan'], true);
  cikti.satirlar.forEach((ad, i) => {
    signal.throwIfAborted();
    satirYaz(sayfa, baslikSatiri + i + 1, [i + 1, ad]);
  });
  sayfa.getColumn(1).width = 8;
  sayfa.getColumn(2).width = 60;
  if (cikti.gorunen) {
    const yon = cikti.yon === 'eksik' ? 'Eksik Müşteriler' : 'Yeni Müşteriler';
    const bilgi = kitap.addWorksheet('Kapsam');
    [
      ['Bilgi', 'Değer'],
      ['Rapor', `Müşteri Takip — ${yon}`],
      ['Kapsam', 'Ekranda görünen satırlar'],
      ['Liste', yon],
      ['Sıralama', 'Ekrandaki sıra'],
      ['Satır Sayısı', cikti.satirlar.length],
    ].forEach((r, i) => satirYaz(bilgi, i + 1, r, i === 0));
    bilgi.getColumn(1).width = 20;
    bilgi.getColumn(2).width = 48;
  }
  signal.throwIfAborted();
  const bayt = new Uint8Array(await kitap.xlsx.writeBuffer());
  signal.throwIfAborted();
  return bayt;
}

export const musteriMotoru: MusteriMotoru = {
  async listeOku(dosya, signal) {
    signal.throwIfAborted();
    const acik = await kitapAc(dosya.bayt, dosya.ad);
    signal.throwIfAborted();
    return musteriListesiOku(acik.kitap);
  },
  excelOlustur: musteriExcelOlustur,
};
