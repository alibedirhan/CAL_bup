"""Tarayıcı composition portu; hesap, okuma, Excel ve atama kaynak dosyalardadır."""
import json
import shutil
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

ROOT = Path('/cal')
ATAMA = ROOT / 'kayitlar' / 'atama' / 'atamalar.json'


def guvenli_sonuc(result):
    try:
        json.dumps(result, allow_nan=False)
    except ValueError as error:
        raise ValueError('Dosyada sonlu olmayan sayılar var. Bakiye sütunlarını kontrol edin.') from error
    return result


def atama_deposu(raw):
    from infrastructure.persistence.vehicle_assignments import MAX_STORE_BYTES, VehicleAssignmentStore, _parse_payload
    folder = ATAMA.parent
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True)
    if not isinstance(raw, dict) or set(raw) != {'guncel', 'yedek'}:
        raise ValueError('Atama kaydı biçimi geçersiz.')
    for field, path in [('guncel', ATAMA), ('yedek', ATAMA.with_name(ATAMA.name + '.bak'))]:
        text = raw[field]
        if text is None:
            continue
        if not isinstance(text, str) or len(text.encode()) > MAX_STORE_BYTES:
            raise ValueError('Atama kaydı boyut sınırını aşıyor.')
        payload = json.loads(text, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Sonlu olmayan kayıt.')))
        _parse_payload(payload)  # Kaynağın toleranslı load'u bozuk kaydı boş saymadan önce doğrula.
        path.write_text(text)
    return VehicleAssignmentStore(ATAMA)


def atama_durumu(service, store):
    def oku(path):
        return path.read_text() if path.is_file() else None
    return {'liste': [asdict(a) for a in service.list_assignments()], 'isYuku': service.workload(),
            'geriAlinabilir': service.can_restore_last_change(),
            'kayit': {'guncel': oku(ATAMA), 'yedek': oku(store.backup_path)}}


def yaslandirma_calistir(request):
    eylem = request['eylem']
    if eylem in {'atama', 'ata', 'kaldir', 'geri-al'}:
        from application.aging_analysis import VehicleAssignmentService
        clock = datetime.fromisoformat(request['tarih'])
        store = atama_deposu(request['kayit'])
        service = VehicleAssignmentService(store, clock=lambda: clock)
        geri = None
        if eylem == 'ata':
            alanlar = request['atama']
            anahtarlar = {'arac_no', 'sorumlu', 'email', 'telefon', 'departman', 'notlar'}
            if not isinstance(alanlar, dict) or set(alanlar) != anahtarlar or any(
                    not isinstance(v, str) or len(v) > 200 for v in alanlar.values()):
                raise ValueError('Atama alanları en fazla 200 karakterlik metin olmalıdır.')
            service.assign(**alanlar)
        elif eylem == 'kaldir':
            if not isinstance(request.get('aracNo'), str):
                raise ValueError('Kaldırılacak araç seçilmedi.')
            service.remove(request['aracNo'])
        elif eylem == 'geri-al':
            geri = service.restore_last_change()
        return {'tur': 'atama', 'geriAlindi': geri, **atama_durumu(service, store)}

    from application.aging_analysis import AgingAnalysisFacade
    from application.aging_analysis.reports import balance_ranking, bucket_totals, vehicle_details
    from infrastructure.excel.aging_workbook_reader import OpenpyxlAgingWorkbookReader
    from infrastructure.export.aging_exporter import OpenpyxlAgingExporter
    from infrastructure.export.visible_table_exporter import OpenpyxlVisibleTableExporter
    import infrastructure.excel.aging_workbook_reader as reader
    # CAL'nin tarayıcı bütçesi kaynaktan dardır; aynı okuyucunun sabitleri ayarlanır.
    reader.MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
    reader.MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
    reader.MAX_ARCHIVE_ENTRIES = 5_000
    reader.MAX_DATA_ROWS = 100_000
    facade = AgingAnalysisFacade(OpenpyxlAgingWorkbookReader(), OpenpyxlAgingExporter(), OpenpyxlVisibleTableExporter())
    summary = facade.analyze(request['yol'])
    guvenli_sonuc(asdict(summary))
    if eylem == 'analiz':
        vehicles = summary.vehicles
        return guvenli_sonuc({'tur': 'analiz', 'sonuc': {
            'ozet': asdict(summary),
            'raporlar': {'detaylar': [asdict(d) for d in vehicle_details(vehicles)],
                         'siralama': [asdict(d) for d in balance_ranking(vehicles)],
                         'kovalar': [list(p) for p in bucket_totals(vehicles)]}}})
    exports = ROOT / 'exports'
    exports.mkdir(exist_ok=True)
    if eylem == 'excel':
        path = facade.export(exports / 'Yaslandirma_Analizi.xlsx', overwrite=True)
        return {'tur': 'dosya', 'ad': path.name, 'yol': str(path)}
    if eylem != 'gorunen':
        raise ValueError('Yaşlandırma işlem türü geçersiz.')
    secim = request['araclar']
    if (not isinstance(secim, list) or not 0 < len(secim) <= 1_000 or len(secim) != len(set(secim))
            or any(not isinstance(a, str) for a in secim)):
        raise ValueError('Görünen araç seçimi geçersiz.')
    by_no = {v.arac_no: v for v in summary.vehicles}
    if any(a not in by_no for a in secim):
        raise ValueError('Görünen araç seçimi güncel analizle eşleşmiyor. Yeniden analiz edin.')
    path = facade.export_visible(tuple(by_no[a] for a in secim), exports / 'Yaslandirma_Gorunen_Araclar.xlsx', overwrite=True)
    return {'tur': 'dosya', 'ad': path.name, 'yol': str(path)}
