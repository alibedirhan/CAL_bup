"""Tarayıcı composition portu; hesap, geçiş ve Excel kaynak dosyalardadır."""
import json
import math
import shutil
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

ROOT = Path('/cal')


def depolari_ac(raw):
    from infrastructure.persistence.profitability_matches import ProfitabilityMatchStore, _parse_payload as parse_matches
    from infrastructure.persistence.profitability_periods import PeriodStore, _parse_payload as parse_periods
    folder = ROOT / 'kayitlar'
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True)
    for kind, parser, cap in [('eslesmeler', parse_matches, 512 * 1024), ('donemler', parse_periods, 4 * 1024 * 1024)]:
        value = raw[kind]
        for field, suffix in [('guncel', ''), ('yedek', '.bak')]:
            text = value[field]
            if text is None:
                continue
            if not isinstance(text, str) or len(text.encode()) > cap:
                raise ValueError('Kayıt boyutu sınırı aşılıyor.')
            payload = json.loads(text, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Sonlu olmayan kayıt.')))
            parser(payload)  # Kaynağın toleranslı load'u bozuk veriyi boş saymadan önce doğrula.
            (folder / (kind + '.json' + suffix)).write_text(text)
    return ProfitabilityMatchStore(folder / 'eslesmeler.json'), PeriodStore(folder / 'donemler.json')


def kaydi_al(raw):
    result = {**raw}
    for kind in ('eslesmeler', 'donemler'):
        result[kind] = {}
        for field, suffix in [('guncel', ''), ('yedek', '.bak')]:
            path = ROOT / 'kayitlar' / (kind + '.json' + suffix)
            result[kind][field] = path.read_text() if path.exists() else None
    return result


def genel_bakis(rows):
    from application.profitability_analysis.dashboard import dashboard_statistics, profit_distribution, top_products_by_profit, products_in_category, CATEGORY_LABELS
    return {'istatistik': asdict(dashboard_statistics(rows)), 'dagilim': asdict(profit_distribution(rows)),
            'ilkUrunler': [asdict(v) for v in top_products_by_profit(rows)],
            'kategoriler': {k: [asdict(v) for v in products_in_category(rows, k)] for k in CATEGORY_LABELS}}


def guvenli_sonuc(result):
    # Kaynak parser 'inf' metnini float'a çevirebilir. Tarayıcı sonuçlarında sonlu olmayan sayı reddedilir.
    try:
        json.dumps(result, allow_nan=False)
    except ValueError as error:
        raise ValueError('Dosyada sonlu olmayan sayılar var. Sayısal alanları kontrol edin.') from error
    return result


def karlilik_calistir(request):
    from application.profitability_analysis.facade import ProfitabilityAnalysisFacade
    from application.profitability_analysis.periods import ProfitabilityPeriodService
    from infrastructure.excel.profitability_workbook_reader import OpenpyxlProfitabilityWorkbookReader
    from infrastructure.export.profitability_exporter import OpenpyxlProfitabilityExporter
    from infrastructure.export.profitability_scenario_exporter import OpenpyxlProfitabilityScenarioExporter
    from infrastructure.export.visible_table_exporter import OpenpyxlVisibleTableExporter
    import infrastructure.excel.profitability_workbook_reader as reader
    reader.MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
    reader.MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
    reader.MAX_ARCHIVE_ENTRIES = 5_000
    reader.MAX_DATA_ROWS = 100_000
    raw, action = request['kayit'], request['eylem']
    matches, periods = depolari_ac(raw)
    clock = datetime.fromisoformat(request['tarih'])
    period_service = ProfitabilityPeriodService(periods, clock=lambda: clock)
    if action == 'kayit':
        return {'tur': 'kayit', 'kayit': raw, 'donemler': [asdict(p) for p in period_service.list_periods()]}
    if action in {'donem-sil', 'donem-geri', 'karsilastir'}:
        if action == 'donem-sil':period_service.delete_period(request['id'])
        elif action == 'donem-geri':period_service.restore_last_change()
        else:
            comparison = period_service.compare(request['ilk'], request['ikinci'])
            result = asdict(comparison)
            result['metrics'] = [{**asdict(m), 'delta': m.delta, 'pct_change': m.pct_change} for m in comparison.metrics]
            for key in ('top_gainers', 'top_losers'):
                result[key] = [{**asdict(m), 'delta': m.delta} for m in getattr(comparison, key)]
            return guvenli_sonuc({'tur': 'karsilastirma', 'karsilastirma': result})
        return {'tur': 'kayit', 'kayit': kaydi_al(raw), 'donemler': [asdict(p) for p in period_service.list_periods()]}
    facade = ProfitabilityAnalysisFacade(OpenpyxlProfitabilityWorkbookReader(), OpenpyxlProfitabilityExporter(),
        OpenpyxlVisibleTableExporter(), OpenpyxlProfitabilityScenarioExporter(), matches)
    facade._match_service._clock = lambda: clock  # Saat bir tarayıcı ortam portudur.
    facade.analyze(request['satis'], request['fiyat'])
    if 'beklenenEslesmeler' in request and request['beklenenEslesmeler'] != raw['eslesmeler']['guncel']:
        raise ValueError('Eşleştirmeler başka sekmede değişti. Yeniden analiz edin.')
    if action == 'oner':facade.propose_match(request['alias'], request['target'])
    elif action == 'onayla':facade.approve_match(request['alias'])
    elif action == 'kaldir':facade.remove_match(request['alias'])
    elif action == 'eslesme-geri':facade.restore_match_change()
    if action == 'donem-kaydet':
        if facade.summary.total_count > 5000:
            raise ValueError('Dönem kaydı en fazla 5.000 ürün içerebilir.')
        name = request['ad']
        if not isinstance(name, str) or not 0 < len(name.strip()) <= 120 or not name.isprintable():
            raise ValueError('Dönem adı 1–120 karakter olmalıdır.')
        # Kaynağın saniye altı kimliği korunur; aynı zaman kimliği sessizce önceki kaydı ezmez.
        if any(p.id == clock.strftime('%Y%m%d%H%M%S%f') for p in periods.list()):
            raise ValueError('Bu anın dönem kaydı zaten var. Yeniden deneyin.')
        period_service.save_summary(name, facade.summary)
    assumptions = request.get('oranlar', {'cost_change_pct': 0, 'price_change_pct': 0, 'quantity_change_pct': 0})
    if set(assumptions) != {'cost_change_pct','price_change_pct','quantity_change_pct'} or any(
        isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not -100 <= v <= 500 for v in assumptions.values()):
        raise ValueError('Senaryo oranları −100 ile 500 arasında sonlu sayılar olmalıdır.')
    scenario = facade.run_scenario(**assumptions)
    # Çıktı hazırlamadan önce bütün iş verisi doğrulanır.
    guvenli_sonuc(asdict(facade.summary));guvenli_sonuc(asdict(scenario))
    if action in {'excel', 'gorunen', 'senaryo-excel'}:
        exports = ROOT / 'exports';exports.mkdir(exist_ok=True)
        name = {'excel':'Karlilik_Analizi.xlsx','gorunen':'Karlilik_Gorunen_Satirlar.xlsx','senaryo-excel':'Karlilik_Senaryosu.xlsx'}[action]
        path = exports / name
        if action == 'excel':facade.export(path, overwrite=True)
        elif action == 'senaryo-excel':facade.export_scenario(path, overwrite=True)
        else:
            indices = request['satirlar']
            if not isinstance(indices, list) or not 0 < len(indices) <= 50_000 or len(indices) != len(set(indices)):
                raise ValueError('Görünen satır seçimi geçersiz veya 50.000 sınırını aşıyor.')
            if any(isinstance(i, bool) or not isinstance(i, int) or not 0 <= i < len(facade.summary.rows) for i in indices):
                raise ValueError('Görünen satır seçimi geçersiz.')
            facade.export_visible(tuple(facade.summary.rows[i] for i in indices), path, overwrite=True)
        return {'tur':'dosya', 'ad':name, 'yol':str(path)}
    if action not in {'analiz','senaryo','oner','onayla','kaldir','eslesme-geri','donem-kaydet'}:
        raise ValueError('Kârlılık işlem türü geçersiz.')
    return guvenli_sonuc({'tur':'analiz', 'sonuc':{'ozet':asdict(facade.summary), 'genelBakis':genel_bakis(facade.summary.rows),
        'senaryo':asdict(scenario), 'eslesme':asdict(facade.match_quality)}, 'kayit':kaydi_al(raw),
        'donemler':[asdict(p) for p in period_service.list_periods()]})
