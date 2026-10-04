"""Tarayıcı portu. İş kuralları bup/ içindeki değişmemiş masaüstü kaynaklarındadır."""
import json
import math
import shutil
import sys
import zipfile
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

ROOT = Path('/cal')
ROOT.mkdir(exist_ok=True)


def dosya_adi(name, extension):
    if (not isinstance(name, str) or not name or len(name) > 200
            or '/' in name or '\\' in name or '\x00' in name
            or name in {'.', '..'} or not name.lower().endswith(extension)):
        raise ValueError('Dosya adı veya uzantısı uygun değil.')
    return name


def saat(now):
    # Yerel saat bir ortam portudur; kaynağın tarih/hesap kodu değiştirilmez.
    fixed = datetime.fromisoformat(now)

    class LocalClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed

    import core.runtime_support as runtime
    runtime.datetime = LocalClock
    if 'infrastructure.export.discount_exporter' in sys.modules:
        sys.modules['infrastructure.export.discount_exporter'].datetime = LocalClock
    return fixed


def facade_olustur(documents):
    from application.discount_calculator.facade import DiscountCalculatorFacade
    from domain.iskonto.calculations import apply_discounts_to_categories
    from infrastructure.export.visible_table_exporter import OpenpyxlVisibleTableExporter

    if not isinstance(documents, list) or not 0 < len(documents) <= 3:
        raise ValueError('En fazla üç PDF yüklenebilir.')
    total = 0
    for document in documents:
        dosya_adi(document['ad'], '.pdf')
        for products in document['kategoriler'].values():
            total += len(products)
    if total > 100_000:
        raise ValueError('Toplam ürün sayısı 100.000 sınırını aşıyor.')

    class LoadedReader:
        def __init__(self, document):
            self.categories = document['kategoriler']
            self.pdf_type = document['tip']

        def determine_pdf_type(self, _):
            return self.pdf_type

        def extract_data_from_pdf(self, *_):
            return True

        def get_product_count(self):
            return sum(len(p) for p in self.categories.values())

        def apply_discounts(self, rates):
            return apply_discounts_to_categories(self.categories, rates)

    class BrowserExporter:
        # Somut çıktı adaptörü yalnız çıktı isteğinde açılır. Hesap facade'ı aynı kalır.
        exports_dir = ROOT / 'exports'

        def __getattr__(self, name):
            from infrastructure.export.discount_exporter import DiscountExporter
            import infrastructure.export.discount_exporter as exporter
            import core.runtime_support as runtime
            exporter.datetime = runtime.datetime
            self.adapter = DiscountExporter()
            return getattr(self.adapter, name)

    (ROOT / 'exports' / 'pdf').mkdir(parents=True, exist_ok=True)
    pending = iter(documents)
    facade = DiscountCalculatorFacade(lambda: LoadedReader(next(pending)), BrowserExporter(), OpenpyxlVisibleTableExporter())
    facade.load_price_lists([ROOT / 'girdiler' / str(i) / d['ad'] for i, d in enumerate(documents)])
    return facade


def iskonto_calistir(request):
    from application.discount_calculator.dto import DiscountVisibleRowRef, discount_visible_row_refs, build_discount_visible_snapshot

    if request['tur'] == 'yukle':
        from infrastructure.pdf.bup_price_list_reader import BupPriceListReader
        documents = []
        failures = []
        for item in request['dosyalar']:
            name = dosya_adi(item['ad'], '.pdf')
            reader = BupPriceListReader()
            path = item['yol']
            kind = reader.determine_pdf_type(path)
            if not reader.extract_data_from_pdf(path, kind):
                failures.append({'ad': name, 'mesaj': 'PDF okunamadı. Geçerli, şifresiz bir fiyat listesi seçin.'})
                continue
            documents.append({'ad': name, 'tip': kind, 'kategoriler': reader.categories})
        if sum(sum(len(p) for p in d['kategoriler'].values()) for d in documents) > 100_000:
            raise ValueError('Toplam ürün sayısı 100.000 sınırını aşıyor.')
        return {'tur': 'belgeler', 'belgeler': documents, 'hatalar': failures}

    now = saat(request['tarih'])
    rates = request['oranlar']
    if any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v) or not 0 <= v <= 100 for v in rates.values()):
        raise ValueError('İskonto oranları 0–100 arasında sonlu sayılar olmalıdır.')
    facade = facade_olustur(request['belgeler'])
    preview = facade.create_preview(rates, generated_at=now)
    if request['tur'] == 'onizle':
        refs = discount_visible_row_refs(preview)
        snapshot = build_discount_visible_snapshot(preview, refs)
        rows = []
        for ref, values in zip(refs, snapshot.rows):
            def money(value):
                return f'{value:,.2f}'.replace(',', '\x00').replace('.', ',').replace('\x00', '.') + ' TL'
            rows.append({'ref': asdict(ref), 'degerler': values, 'para': tuple(money(v) for v in values[3:])})
        return {'tur': 'onizleme', 'onizleme': {'istatistik': asdict(preview.statistics), 'metin': preview.text, 'satirlar': rows}}

    exports = ROOT / 'exports'
    excel = exports / 'Iskontolu_Fiyat_Listeleri.xlsx'
    if request['tur'] == 'gorunen':
        refs = tuple(DiscountVisibleRowRef(**r) for r in request['satirlar'])
        facade.export_visible(refs, excel, overwrite=True)
        return {'tur': 'dosya', 'ad': 'Iskonto_Gorunen_Satirlar.xlsx', 'yol': str(excel)}
    if request['tur'] == 'excel':
        facade.export_excel(excel, overwrite=True)
        return {'tur': 'dosya', 'ad': excel.name, 'yol': str(excel)}
    if request['tur'] not in {'pdf', 'paket'}:
        raise ValueError('İşlem türü geçersiz.')
    paths = (facade.export_bundle(excel, exports / 'pdf', excel_overwrite=True, pdf_overwrite=True)
             if request['tur'] == 'paket' else facade.export_pdfs(exports / 'pdf', overwrite=True))
    if len(paths) == 1:
        return {'tur': 'dosya', 'ad': paths[0].name, 'yol': str(paths[0])}
    target = exports / ('Iskonto_Excel_ve_PDF.zip' if request['tur'] == 'paket' else 'Iskontolu_PDF_Listeleri.zip')
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_STORED) as archive:
        for path in paths:
            archive.write(path, path.name)
    return {'tur': 'dosya', 'ad': target.name, 'yol': str(target)}


def musteri_oku(request):
    from infrastructure.excel.customer_list_reader import CustomerListReader
    # CAL'nin daha dar kaynak bütçesi korunur; aynı okuyucunun sabitleri ayarlanır.
    import infrastructure.excel.customer_list_reader as reader
    reader.MAX_DATA_ROWS = 100_000
    reader.MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
    reader.MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
    reader.MAX_ARCHIVE_ENTRIES = 5_000
    from openpyxl import load_workbook
    book = load_workbook(request['yol'], read_only=True, data_only=True)
    try:
        if book.worksheets and (book.worksheets[0].max_row or 0) > 100_000:
            raise ValueError('Müşteri dosyası en fazla 100.000 satır içerebilir.')
    finally:
        book.close()
    sheet = CustomerListReader().read(request['yol'])
    return {'tur': 'liste', 'liste': {'depo': sheet.depo_name, 'baslikSatiri': sheet.header_row, 'musteriler': sheet.customers}}


def cal_calistir(text):
    request = json.loads(text)
    try:
        if request['tur'] == 'musteri':
            result = musteri_oku(request)
        else:
            result = iskonto_calistir(request)
        return json.dumps(result, ensure_ascii=False, allow_nan=False)
    except Exception as error:
        # İz/yığın ve veri stdout/stderr/JavaScript konsoluna taşınmaz.
        known = {'ValueError', 'HeaderNotFoundError', 'CariColumnNotFoundError', 'InvalidCustomerFileError', 'NoPriceListsLoadedError', 'DiscountRateValidationError', 'NoPreviewDataError', 'VisibleExportSelectionError', 'InvalidDiscountExportDataError', 'InvalidVisibleExportDataError'}
        message = str(error) if type(error).__name__ in known else 'Dosya işlemi tamamlanamadı. Dosyayı kontrol edip yeniden deneyin.'
        return json.dumps({'tur': 'hata', 'mesaj': message}, ensure_ascii=False)
    finally:
        shutil.rmtree(ROOT / 'girdiler', ignore_errors=True)
