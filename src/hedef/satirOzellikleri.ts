import type ExcelJS from 'exceljs';
import { KullaniciHatasi } from '../cekirdek/hata';
import { aralikKaydir, formulKaydir } from './formul';

type IcSayfa = ExcelJS.Worksheet & {
  dataValidations: { model: Record<string, ExcelJS.DataValidation> };
  conditionalFormattings: ExcelJS.ConditionalFormattingOptions[];
};

/** Satır eklemenin desteklenmeyen Excel yapısını sessizce bozmasını önler. */
export function satirEklemeyiDogrula(ws: ExcelJS.Worksheet, satir?: number): void {
  const birlesik = ((ws.model as { merges?: string[] }).merges ?? []).filter(
    (m) => satir !== undefined && Number(/(\d+)$/.exec(m)?.[1] ?? 0) >= satir,
  );
  if (birlesik.length)
    throw new KullaniciHatasi(
      `'${ws.name}' sayfasında satır ${satir} ve altında birleşik hücre var (${birlesik.join(', ')}); satır eklenemedi.`,
    );
  if (ws.getTables().length || ws.getImages().length)
    throw new KullaniciHatasi(
      `'${ws.name}' sayfasında Excel tablosu veya resim var. Satır eklerken yerleri korunamayacağı için dosya değiştirilmedi. Önce sade bir kopya hazırlayın.`,
    );
  if (ws.workbook.definedNames.model.length)
    throw new KullaniciHatasi(
      'Dosyada tanımlı hücre adları var. Satır eklerken bu adlar güvenle güncellenemediği için dosya değiştirilmedi. Önce sade bir kopya hazırlayın.',
    );
  const ic = ws as IcSayfa;
  if (
    ic.conditionalFormattings.some((cf) =>
      cf.rules.some((r) => 'cfvo' in r && r.cfvo?.some((v) => v.type === 'formula')),
    )
  )
    throw new KullaniciHatasi(
      'Dosyada formülle hesaplanan renk ölçeği var. Bu Excel özelliği güvenle okunamadığı için satır eklenmedi. Önce sade bir kopya hazırlayın.',
    );
  let diziFormulu = false;
  ws.eachRow((r) =>
    r.eachCell((c) => {
      const v = c.value;
      if (v && typeof v === 'object' && 'shareType' in v && v.shareType === 'array') diziFormulu = true;
    }),
  );
  if (diziFormulu)
    throw new KullaniciHatasi(
      'Sayfada dizi formülü var. Satır eklerken güvenle kaydırılamadığı için dosya değiştirilmedi. Önce sade bir kopya hazırlayın.',
    );
}

function filtreKaydir(f: ExcelJS.AutoFilter, satir: number): ExcelJS.AutoFilter {
  // Son ürünün hemen altına eklenen ürün de filtreye katılır.
  if (typeof f === 'string') {
    const [ilk, son] = f.split(':');
    return ilk && son
      ? aralikKaydir(ilk, satir) + ':' + aralikKaydir(son, satir - 1)
      : aralikKaydir(f, satir);
  }
  const kaydir = (uc: typeof f.from, esik: number) =>
    typeof uc === 'string' ? aralikKaydir(uc, esik) : { ...uc, row: uc.row >= esik ? uc.row + 1 : uc.row };
  return { from: kaydir(f.from, satir), to: kaydir(f.to, satir - 1) };
}

/** Aralıkların adresleri ile içlerindeki formüller birlikte hazırlanır. */
export function satirOzellikleriniHazirla(ws: ExcelJS.Worksheet, satir: number): () => void {
  const ic = ws as IcSayfa;
  const dogrulamalar = Object.fromEntries(
    Object.entries(ic.dataValidations.model).map(([adres, kural]) => [
      aralikKaydir(adres, satir),
      {
        ...structuredClone(kural),
        formulae:
          kural.formulae?.map((f: unknown) => (typeof f === 'string' ? formulKaydir(f, satir) : f)) ?? [],
      },
    ]),
  );
  const bicimler = structuredClone(ic.conditionalFormattings).map((cf) => ({
    ...cf,
    ref: aralikKaydir(cf.ref, satir),
    rules: cf.rules.map((kural) => {
      if ('formulae' in kural && Array.isArray(kural.formulae))
        kural.formulae = kural.formulae.map((f: unknown) =>
          typeof f === 'string' ? formulKaydir(f, satir) : f,
        );
      return kural;
    }),
  }));
  const ayar = structuredClone(ws.pageSetup);
  if (ayar.printArea)
    ayar.printArea = ayar.printArea
      .split('&&')
      .map((a) => aralikKaydir(a, satir))
      .join('&&');
  if (ayar.printTitlesRow) ayar.printTitlesRow = aralikKaydir(ayar.printTitlesRow, satir);
  const filtre = ws.autoFilter ? filtreKaydir(ws.autoFilter, satir) : undefined;
  return () => {
    ic.dataValidations.model = dogrulamalar;
    ic.conditionalFormattings = bicimler;
    ws.pageSetup = ayar;
    if (filtre) ws.autoFilter = filtre;
  };
}
