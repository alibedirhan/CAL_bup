# -*- coding: utf-8 -*-
"""Atomic openpyxl exporter for profitability analysis results."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, Side

from core.cancellation import Checkpoint, run_checkpoint
from domain.karlilik import (
    InvalidProfitabilityExportPathError,
    ProfitabilityAnalysis,
    ProfitabilityExportExistsError,
    ProfitabilityExportWriteError,
)
from infrastructure.export.atomic_publish import publish_staged_file

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
_ANALYSIS_HEADERS = (
    "Stok İsmi",
    "Satış Miktar",
    "Ort.Satış Fiyat",
    "Satış Tutar",
    "Birim Maliyet",
    "Birim Kar",
    "Net Kar",
)
_SUMMARY_HEADERS = ("Bilgi", "Değer")


def neutralize_formula(value: object) -> object:
    """Keep exported text inert in Excel and LibreOffice."""
    if not isinstance(value, str):
        return value
    if value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def _reject_symlink_chain(path: Path) -> None:
    current = path
    while True:
        if current.is_symlink():
            raise InvalidProfitabilityExportPathError(
                "Sembolik bağlantı üzerinden dışa aktarma desteklenmiyor."
            )
        if current == current.parent:
            return
        current = current.parent


def validated_profitability_destination(
    destination: str | Path,
    *,
    overwrite: bool,
) -> Path:
    requested = Path(destination).expanduser()
    if ".." in requested.parts:
        raise InvalidProfitabilityExportPathError(
            "Üst klasöre geçiş içeren dışa aktarma yolu kullanılamaz."
        )
    if requested.suffix.lower() != ".xlsx":
        requested = requested.with_suffix(".xlsx")

    absolute = Path(os.path.abspath(requested))
    _reject_symlink_chain(absolute)
    parent = absolute.parent
    if not parent.exists() or not parent.is_dir():
        raise InvalidProfitabilityExportPathError(
            "Dışa aktarma klasörü bulunamadı."
        )
    if absolute.exists():
        if absolute.is_symlink():
            raise InvalidProfitabilityExportPathError(
                "Sembolik bağlantı hedefi kullanılamaz."
            )
        if not absolute.is_file():
            raise InvalidProfitabilityExportPathError(
                "Dışa aktarma hedefi normal bir dosya olmalıdır."
            )
        if not overwrite:
            raise ProfitabilityExportExistsError(
                "Hedef dosya zaten var; üzerine yazma onayı olmadan işlem reddedildi."
            )

    resolved_parent = parent.resolve(strict=True)
    resolved_destination = (resolved_parent / absolute.name).resolve(strict=False)
    if resolved_destination.parent != resolved_parent:
        raise InvalidProfitabilityExportPathError(
            "Dışa aktarma hedefi seçilen klasörün dışında kalıyor."
        )
    return resolved_destination


def _summary_rows(
    analysis: ProfitabilityAnalysis,
    *,
    checkpoint: Checkpoint | None = None,
) -> tuple[tuple[object, object], ...]:
    total_count = len(analysis.rows)
    matched_costs: list[float] = []
    unit_profits: list[float] = []
    total_net_profit = 0.0
    for row in analysis.rows:
        run_checkpoint(checkpoint)
        if row.unit_cost > 0:
            matched_costs.append(row.unit_cost)
        unit_profits.append(row.unit_profit)
        total_net_profit += row.net_profit
    fill_rate = analysis.matched_count / total_count * 100 if total_count else 0.0
    average_cost = (
        sum(matched_costs) / len(matched_costs) if matched_costs else 0.0
    )
    average_profit = (
        sum(unit_profits) / len(unit_profits) if unit_profits else 0.0
    )
    return (
        ("Toplam Stok Sayısı", total_count),
        ("Eşleşen Stok Sayısı", analysis.matched_count),
        ("Eşleşmeyen Stok Sayısı", total_count - analysis.matched_count),
        ("Doluluk Oranı (%)", f"{fill_rate:.1f}"),
        ("Ortalama Birim Maliyet", f"{average_cost:.2f}"),
        ("Ortalama Birim Kar", f"{average_profit:.2f}"),
        ("Toplam Net Kar", f"{total_net_profit:.2f}"),
    )


def style_profitability_header(worksheet, column_count: int) -> None:
    thin = Side(style="thin", color="000000")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    for cell in worksheet[1][:column_count]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border


def _build_workbook(
    analysis: ProfitabilityAnalysis,
    *,
    checkpoint: Checkpoint | None = None,
) -> Workbook:
    workbook = Workbook()
    try:
        result_sheet = workbook.active
        result_sheet.title = "Karlılık Analizi"
        result_sheet.append(_ANALYSIS_HEADERS)
        for row in analysis.rows:
            run_checkpoint(checkpoint)
            result_sheet.append(
                (
                    neutralize_formula(row.stock_name),
                    row.sales_quantity,
                    row.average_sales_price,
                    row.sales_amount,
                    row.unit_cost,
                    row.unit_profit,
                    row.net_profit,
                )
            )

        summary_sheet = workbook.create_sheet("Özet")
        summary_sheet.append(_SUMMARY_HEADERS)
        for row in _summary_rows(analysis, checkpoint=checkpoint):
            run_checkpoint(checkpoint)
            summary_sheet.append(tuple(neutralize_formula(value) for value in row))

        style_profitability_header(result_sheet, len(_ANALYSIS_HEADERS))
        style_profitability_header(summary_sheet, len(_SUMMARY_HEADERS))
        return workbook
    except BaseException:
        workbook.close()
        raise


class OpenpyxlProfitabilityExporter:
    """Write the legacy-compatible two-sheet workbook to an explicit path."""

    def export(
        self,
        analysis: ProfitabilityAnalysis,
        destination: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        run_checkpoint(checkpoint)
        path = validated_profitability_destination(
            destination,
            overwrite=overwrite,
        )
        descriptor, temporary_name = tempfile.mkstemp(
            dir=path.parent,
            prefix=".profitability-",
            suffix=".xlsx",
        )
        os.close(descriptor)
        temporary_path = Path(temporary_name)
        workbook: Workbook | None = None
        try:
            workbook = _build_workbook(analysis, checkpoint=checkpoint)
            workbook.save(temporary_path)
            with temporary_path.open("rb+") as stream:
                os.fsync(stream.fileno())
            try:
                temporary_path.chmod(0o600)
            except OSError:
                pass
            run_checkpoint(checkpoint)
            publish_staged_file(temporary_path, path, overwrite=overwrite)
        except FileExistsError as exc:
            raise ProfitabilityExportExistsError(
                "Hedef dosya işlem sırasında oluştu; üzerine yazılmadı."
            ) from exc
        except (OSError, ValueError) as exc:
            raise ProfitabilityExportWriteError(
                "Karlılık Excel dosyası atomik olarak yazılamadı."
            ) from exc
        finally:
            if workbook is not None:
                workbook.close()
            temporary_path.unlink(missing_ok=True)
        return path
