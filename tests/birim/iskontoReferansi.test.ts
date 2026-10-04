import { beforeAll, expect, it } from 'vitest';
import type { PyodideInterface } from 'pyodide';
import ExcelJS from 'exceljs';
import { nodePythonMotoru } from '../yardimci/pythonMotoru';
import referans from '../yardimci/veriler/iskontoReferansi.json';
import { pythonCalistir } from '../../src/platform/python/motor';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import kaynak from '../../vendor/python/kaynak.json';

let p: PyodideInterface;
beforeAll(async () => {
  p = await nodePythonMotoru('iskonto');
}, 60_000);
interface Cevap {
  tur: string;
  onizleme?: unknown;
  belgeler?: unknown;
  yol?: string;
  mesaj?: string;
}
function calistir(istek: unknown) {
  return pythonCalistir(p, istek) as Cevap;
}
async function excel(yol: string) {
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(new Uint8Array(p.FS.readFile(yol)) as unknown as ExcelJS.Buffer);
  return w.worksheets.map((s) => ({
    ad: s.name,
    satirlar: Array.from({ length: s.rowCount }, (_, r) =>
      Array.from({ length: s.columnCount }, (_, c) => s.getCell(r + 1, c + 1).value),
    ),
  }));
}
function istek(s: (typeof referans.senaryolar)[number]) {
  return {
    tur: 'onizle',
    belgeler: s.ad.map((ad) => referans.belgeler.find((d) => d.ad === ad)?.belge),
    oranlar: s.oranlar,
    tarih: '2026-10-04T12:00:00',
  };
}

it('aktarılmış okuyucu/hesap/facade/çıktı kaynakları değiştirilmemiş SHA-256 ile eşleşir', () => {
  for (const [ad, sha] of Object.entries(kaynak.dosyalar))
    if (typeof sha === 'string')
      expect(
        createHash('sha256')
          .update(readFileSync('vendor/python/bup/' + ad))
          .digest('hex'),
      ).toBe(sha);
  for (const [ad, sha] of Object.entries(referans.kaynakSha256))
    expect(
      createHash('sha256')
        .update(readFileSync('vendor/python/bup/' + ad))
        .digest('hex'),
    ).toBe(sha);
});

it('tarayıcı ortam adaptörünün üç saf işlevi de özgün masaüstü kaynağıyla eşleşir', () => {
  const beklenen = kaynak.dosyalar['core/runtime_support.py işlevleri'];
  const gercek = JSON.parse(
    p.runPython(`
import ast, hashlib
runtime_source = Path('/cal/site/core/runtime_support.py').read_text()
runtime_names = {'safe_turkish_text', 'get_clean_filename', 'get_date_display'}
json.dumps({node.name: hashlib.sha256(ast.get_source_segment(runtime_source, node).encode()).hexdigest()
    for node in ast.parse(runtime_source).body if isinstance(node, ast.FunctionDef) and node.name in runtime_names})
`) as string,
  ) as unknown;
  expect(gercek).toEqual(beklenen);
});

it('PDF okuma/çıktı, harici görüntü açma veya sertifika/PKCS7 işlevi gerektirmez', () => {
  const ornek = referans.senaryolar[0];
  if (!ornek) throw new Error('Yapay başvuru yok.');
  p.globals.set('cal_guvenlik_pdfleri', JSON.stringify(referans.belgeler));
  p.globals.set('cal_guvenlik_istek', JSON.stringify(istek(ornek)));
  try {
    const sonuc = JSON.parse(
      p.runPython(`
from unittest.mock import patch
def forbid_unused_api(*args, **kwargs):
    raise AssertionError('Bu akış görüntü veya sertifika işlemi kullanmamalı.')
with patch('PIL.Image.open', forbid_unused_api), patch('fpdf.FPDF.image', forbid_unused_api), \
     patch('cryptography.x509.verification.PolicyBuilder', forbid_unused_api), \
     patch('cryptography.hazmat.primitives.serialization.pkcs7.pkcs7_decrypt_der', forbid_unused_api), \
     patch('cryptography.hazmat.primitives.serialization.pkcs7.pkcs7_decrypt_pem', forbid_unused_api), \
     patch('cryptography.hazmat.primitives.serialization.pkcs7.pkcs7_decrypt_smime', forbid_unused_api):
    checked = []
    import base64
    for document in json.loads(cal_guvenlik_pdfleri):
        ROOT.joinpath('girdiler').mkdir(exist_ok=True)
        ROOT.joinpath('girdiler/liste.pdf').write_bytes(base64.b64decode(document['bayt']))
        checked.append(json.loads(cal_calistir(json.dumps({'tur': 'yukle', 'dosyalar': [{'ad': document['ad'], 'yol': str(ROOT / 'girdiler/liste.pdf')}]})))['tur'])
    request = json.loads(cal_guvenlik_istek)
    request['tur'] = 'pdf'
    checked.append(json.loads(cal_calistir(json.dumps(request)))['tur'])
json.dumps(checked)
`) as string,
    ) as unknown;
    expect(sonuc).toEqual([...referans.belgeler.map(() => 'belgeler'), 'dosya']);
  } finally {
    p.globals.delete('cal_guvenlik_pdfleri');
    p.globals.delete('cal_guvenlik_istek');
  }
});

it('250 sayfa sınırını aşan gerçek PDF, boş veya yarım başarıya dönüşmez', () => {
  p.runPython(`
from fpdf import FPDF
too_many_pages = FPDF()
for _ in range(251):
    too_many_pages.add_page()
ROOT.joinpath('girdiler').mkdir(exist_ok=True)
too_many_pages.output('/cal/girdiler/fazla.pdf')
`);
  expect(
    calistir({ tur: 'yukle', dosyalar: [{ ad: 'Yapay fazla.pdf', yol: '/cal/girdiler/fazla.pdf' }] }),
  ).toEqual({
    tur: 'belgeler',
    belgeler: [],
    hatalar: [{ ad: 'Yapay fazla.pdf', mesaj: 'PDF okunamadı. Geçerli, şifresiz bir fiyat listesi seçin.' }],
  });
});

for (const d of referans.belgeler)
  it(`${d.ad}: gerçek PDF ayrıştırması masaüstüyle aynı`, () => {
    p.FS.mkdirTree('/cal/girdiler');
    p.FS.writeFile('/cal/girdiler/liste.pdf', new Uint8Array(Buffer.from(d.bayt, 'base64')));
    expect(calistir({ tur: 'yukle', dosyalar: [{ ad: d.ad, yol: '/cal/girdiler/liste.pdf' }] })).toEqual({
      tur: 'belgeler',
      belgeler: [d.belge],
      hatalar: [],
    });
  });

it('3.264 kuruş/oran sınırı kaynak Python hesaplamasıyla birebir', () => {
  p.globals.set('cal_ornekler', JSON.stringify(referans.yuvarlama));
  const s = JSON.parse(
    p.runPython(
      "from domain.iskonto.calculations import calculate_discounted_price; json.dumps([calculate_discounted_price(o['fiyat'],o['oran']) for o in json.loads(cal_ornekler)])",
    ) as string,
  ) as unknown;
  p.globals.delete('cal_ornekler');
  expect(s).toEqual(referans.yuvarlama.map((o) => o.sonuc));
});

for (const [index, s] of referans.senaryolar.entries()) {
  it(`facade ${index}: istatistik, sıra, fiyatlar ve metin masaüstüyle birebir`, () => {
    const sonuc = calistir(istek(s));
    if ('hata' in s) {
      expect(sonuc.tur).toBe('hata');
      expect(sonuc.mesaj).toBe('İşlenecek veri bulunamadı!');
    } else expect(sonuc).toEqual({ tur: 'onizleme', onizleme: s.onizleme });
  });
  if (!('hata' in s)) {
    it(`facade ${index}: tam ve görünen Excel hücreleri masaüstüyle birebir`, async () => {
      const tam = calistir({ ...istek(s), tur: 'excel' });
      expect(tam.tur).toBe('dosya');
      expect(await excel(tam.yol ?? '')).toEqual(s.tamExcel);
      const gorunen = calistir({ ...istek(s), tur: 'gorunen', satirlar: s.gorunenRefs });
      expect(gorunen.tur).toBe('dosya');
      expect(await excel(gorunen.yol ?? '')).toEqual(s.gorunenExcel);
    });
    it(`facade ${index}: PDF sayfa/metin ve dosya isimleri masaüstüyle birebir`, () => {
      const dosya = calistir({ ...istek(s), tur: 'pdf' });
      expect(dosya.tur).toBe('dosya');
      p.globals.set('cal_pdf_yol', dosya.yol);
      const pdfs = JSON.parse(
        p.runPython(`
import pdfplumber, io
path=Path(cal_pdf_yol)
pdf_inputs = [(path.name, path.read_bytes())] if path.suffix=='.pdf' else [(n,z.read(n)) for z in [zipfile.ZipFile(path)] for n in z.namelist()]
def read_pdf(data):
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return [page.extract_text() or '' for page in pdf.pages]
json.dumps([{'ad':name, 'sayfalar':read_pdf(data)} for name,data in pdf_inputs])
`) as string,
      ) as unknown;
      p.globals.delete('cal_pdf_yol');
      expect(pdfs).toEqual(s.pdfler);
    });
  }
}
