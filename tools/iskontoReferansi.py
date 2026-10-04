"""Aktif masaüstüyle yalnız yapay PDF üretip okur; config/gerçek belge kullanılmaz."""
import base64
import hashlib
import json
import random
import sys
import tempfile
from dataclasses import asdict
from datetime import datetime
from pathlib import Path


def main():
    root, output = Path(sys.argv[1]).resolve(), Path(sys.argv[2])
    sys.path.insert(0, str(root))
    from fpdf import FPDF
    import pdfplumber
    from openpyxl import load_workbook
    from infrastructure.pdf.bup_price_list_reader import BupPriceListReader
    from infrastructure.export.discount_exporter import DiscountExporter
    from infrastructure.export.visible_table_exporter import OpenpyxlVisibleTableExporter
    from application.discount_calculator.facade import DiscountCalculatorFacade
    from application.discount_calculator.dto import discount_visible_row_refs, build_discount_visible_snapshot
    from domain.iskonto.calculations import CATEGORY_NAMES, calculate_discounted_price

    class TempExporter(DiscountExporter):
        def __init__(self, folder):
            self.exports_dir = folder
            self._setup_directories()

    def pdf(path, pages):
        doc = FPDF()
        doc.add_font('Yapay', fname='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
        for page in pages:
            doc.add_page()
            doc.set_font('Yapay', size=8)
            doc.set_xy(15, 12)
            doc.cell(170, 6, page.get('baslik', 'Yapay fiyat listesi'))
            if 'tablolar' in page:
                for index, rows in enumerate(page['tablolar']):
                    y = 25 + index * 18
                    widths = [28, 78, 25, 25]
                    for r, row in enumerate([['Kod', 'Yapay ürün adı', 'Hariç', 'Dahil'], *rows]):
                        x = 15
                        for c, cell in enumerate(row):
                            doc.set_xy(x, y + r * 6)
                            doc.cell(widths[c], 6, str(cell), border=1)
                            x += widths[c]
            for index, line in enumerate(page.get('metin', [])):
                doc.set_xy(15, 30 + index * 6)
                doc.cell(180, 6, line)
        doc.output(path)

    def cells(path):
        book = load_workbook(path, data_only=False)
        rows = [{'ad': s.title, 'satirlar': [list(r) for r in s.values]} for s in book]
        book.close()
        return rows

    def pdf_texts(paths):
        result = []
        for path in paths:
            with pdfplumber.open(path) as doc:
                result.append({'ad':path.name, 'sayfalar':[p.extract_text() or '' for p in doc.pages]})
        return result

    # Tablonun konumu kod önekinden önce gelir; aynı sayfada tablo varsa serbest metin okunmaz.
    specs = [
        {'ad':'Yapay_Normal.pdf','sayfalar':[{'tablolar':[[['GGS101','Yapay Alfa','100,00','101,00'],['BTN102','Yapay Beta','50,00','50,50']]]}]},
        {'ad':'Yapay_Gramaj.pdf','sayfalar':[{'baslik':'Yapay gramaj ve soslu liste','metin':['BTN101 Yapay Bir 100,00 101,00','KNT201 Yapay İki 125.00 126.25','BUT301 Yapay Üç 80.00 80.80','GGS401 Yapay Dört 150,00 151,50','SAK501 Yapay Beş 20,00 20,20','YAN601 Yapay Altı 60,00 60,60']}]},
        {'ad':'Yapay_Donuk.pdf','sayfalar':[{'baslik':'Yapay DON. fiyatları','tablolar':[[['DBTN101','DON. Yapay İğüşç','70,00','70,70'],['DBTN102','123.- DON. Yapay  Çift','99,95','100,95']]]}]},
        {'ad':'Yapay_Tablo_Konumu.pdf','sayfalar':[{'tablolar':[[['GGS%03d'%i, 'Yapay Konum %02d'%i,'100,00','101,00']] for i in range(12)]}]},
        {'ad':'Yapay_Tekrar_Sayfa.pdf','sayfalar':[{'tablolar':[[['BTN101','Yapay İlk','100,00','101,00']]],'metin':['KNT201 Yapay Okunmaz 100,00 101,00']},{'tablolar':[[['BTN101','Yapay Yinelenen','200,00','202,00']],[['BUT202','Yapay İkinci','120,00','121,20']]]}]},
        {'ad':'Yapay_Metin_Kurallari.pdf','sayfalar':[{'metin':['BTN101 Yapay İyi 100,00 101,00','KNT102 Yapay Ters 101,00 100,00','BUT103 Yapay Düşük 5,00 5,05','GGS104 Yapay YanlışKDV 100,00 120,00','SAK105 Yapay Sonİki 90,00 100,00 101,00','YAN106 123.- Yapay   İsim 99,95 100,95','BTN101 Yapay Tekrar 50,00 50,50']}]},
        {'ad':'Yapay_Tablo_Fiyatlari.pdf','sayfalar':[{'tablolar':[[['BTN101','Yapay Ters','101,00','100,00'],['BTN102','Yapay Sınır Alt','100,00','100,50'],['BTN103','Yapay Sınır Üst','100,00','101,50'],['BTN104','Yapay Geçersiz','100,00','120,00'],['BTN105','=YAPAY()','99,95','100,95']]]}]},
        {'ad':'Yapay_Tip_İlk_İki.pdf','sayfalar':[{'metin':['BTN101 Yapay İlk 100,00 101,00']},{'baslik':'Yapay dondurulmuş','metin':['KNT201 DON. Yapay İkinci 150,00 151,50']},{'baslik':'Yapay gramaj','metin':['YAN301 Yapay Üçüncü 120,00 121,20']}]},
        {'ad':'Yapay_Tip_Üçüncü.pdf','sayfalar':[{'metin':['BTN101 Yapay İlk 100,00 101,00']},{'baslik':'Yapay ikinci boş'},{'baslik':'Yapay DON. yalnız üçüncü','metin':['KNT201 DON. Yapay Üçüncü 150,00 151,50']}]},
        {'ad':'Yapay_11_Ürün.pdf','sayfalar':[{'metin':['BTN%03d Yapay Ürün %03d 100,00 101,00'%(i,i) for i in range(101,113)]}]},
        {'ad':'Yapay_Boş.pdf','sayfalar':[{'metin':['Yalnız yapay açıklama; ürün/fiyat yok.']}]},
    ]
    # Binlerce kuruş sınırı: Python ikili kayan nokta ve çift sayıya yuvarlama başvurusu.
    rng = random.Random(104)
    prices = [2.675, 1.005, 16.055, 99.95, 101.5, 0.005, 100, 1999.99] + [rng.randint(500,200_000)/100 for _ in range(400)]
    rounds = []
    for price in prices:
        for rate in (0, 5, 7.5, 10, 33.3, 50, 99.9, 100):
            rounds.append({'fiyat':price,'oran':rate,'sonuc':calculate_discounted_price(price,rate)})

    cases, docs = [], []
    with tempfile.TemporaryDirectory(prefix='cal-iskonto-reference-') as temp:
        folder = Path(temp)
        for spec in specs:
            path = folder / spec['ad'];pdf(path, spec['sayfalar'])
            reader = BupPriceListReader();kind = reader.determine_pdf_type(path)
            assert reader.extract_data_from_pdf(path, kind)
            docs.append({'ad':path.name,'bayt':base64.b64encode(path.read_bytes()).decode(),'belge':{'ad':path.name,'tip':kind,'kategoriler':reader.categories}})
        for group in ([docs[0]], [docs[1]], [docs[2]], [docs[3]], [docs[4]], [docs[5]], [docs[6]], [docs[7]], [docs[8]], [docs[9]], docs[:3], [docs[0],docs[0]], [docs[-1]]):
            for index, values in enumerate(([0]*6,[7.5,10,10,5,0,20],[100]*6)):
                rates = dict(zip(CATEGORY_NAMES,values))
                facade = DiscountCalculatorFacade(BupPriceListReader,TempExporter(folder/'exports'),OpenpyxlVisibleTableExporter())
                facade.load_price_lists([folder/d['ad'] for d in group])
                try: preview=facade.create_preview(rates,generated_at=datetime(2026,10,4,12,0))
                except Exception as error:
                    cases.append({'ad':[d['ad'] for d in group], 'oranlar':rates, 'hata':type(error).__name__});continue
                refs=discount_visible_row_refs(preview);snapshot=build_discount_visible_snapshot(preview,refs)
                facade.export_excel(folder/'tam.xlsx',overwrite=True)
                selected=tuple(reversed(refs[::2]));facade.export_visible(selected,folder/'gorunen.xlsx',overwrite=True)
                exports=facade.export_pdfs(folder/'exports/pdf',overwrite=True)
                # Değişken saat etiketini normalize et; sayı/ad/kapsam/sayfa metinleri aynen kalır.
                pdfs=pdf_texts(exports)
                for out in pdfs:
                    out['ad']=out['ad'].replace(datetime.now().strftime('%d.%m.%Y'),'04.10.2026')
                    out['sayfalar'][0]=out['sayfalar'][0].replace(datetime.now().strftime('%d.%m.%Y %H:%M'),'04.10.2026 12:00')
                cases.append({'ad':[d['ad'] for d in group], 'oranlar':rates,'onizleme':{'istatistik':asdict(preview.statistics),'metin':preview.text,'satirlar':[{'ref':asdict(r),'degerler':v,'para':tuple(f'{n:,.2f}'.replace(',','\x00').replace('.',',').replace('\x00','.')+' TL' for n in v[3:])} for r,v in zip(refs,snapshot.rows)]}, 'tamExcel':cells(folder/'tam.xlsx'),'gorunenRefs':[asdict(r) for r in selected],'gorunenExcel':cells(folder/'gorunen.xlsx'),'pdfler':pdfs})
    source_files=['domain/iskonto/calculations.py','application/discount_calculator/facade.py','infrastructure/pdf/bup_price_list_reader.py','infrastructure/export/discount_exporter.py','infrastructure/export/discount_pdf_writer.py']
    output.write_text(json.dumps({'kaynak':'BUP_Yonetim — yalnız yapay fiyat listeleri','kaynakSha256':{f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in source_files},'belgeler':docs,'senaryolar':cases,'yuvarlama':rounds},ensure_ascii=False,indent=2)+'\n')
    print(f'{len(docs)} yapay PDF, {len(cases)} facade/çıktı ve {len(rounds)} yuvarlama başvurusu üretildi.')


if __name__=='__main__':main()
