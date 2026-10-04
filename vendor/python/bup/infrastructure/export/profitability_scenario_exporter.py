# -*- coding: utf-8 -*-
"""Atomic openpyxl exporter for profitability decision scenarios."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from openpyxl import Workbook

from core.cancellation import Checkpoint, run_checkpoint
from domain.karlilik import (
    ProfitabilityExportExistsError,
    ProfitabilityExportWriteError,
    ProfitabilityScenarioAnalysis,
)
from infrastructure.export.atomic_publish import publish_staged_file

from .profitability_exporter import (
    neutralize_formula,
    style_profitability_header,
    validated_profitability_destination,
)

_SUMMARY_HEADERS = ("Bilgi", "Değer")
_PRODUCT_HEADERS = (
    "Stok İsmi",
    "Maliyet Eşleşti",
    "Mevcut Miktar",
    "Senaryo Miktar",
    "Mevcut Fiyat",
    "Senaryo Fiyat",
    "Mevcut Maliyet",
    "Senaryo Maliyet",
    "Mevcut Net Kâr",
    "Senaryo Net Kâr",
    "Net Kâr Farkı",
    "Mevcut Marj (%)",
    "Senaryo Marj (%)",
    "Başabaş Fiyatı",
    "Kâra Katkı (%)",
    "Kümülatif Katkı (%)",
    "Pareto Sınıfı",
)


def _summary_rows(
    scenario: ProfitabilityScenarioAnalysis,
) -> tuple[tuple[str, float | int], ...]:
    assumptions = scenario.assumptions
    return (
        ("Maliyet Değişimi (%)", assumptions.cost_change_pct),
        ("Fiyat Değişimi (%)", assumptions.price_change_pct),
        ("Miktar Değişimi (%)", assumptions.quantity_change_pct),
        ("Mevcut Toplam Net Kâr", scenario.baseline_net_profit),
        ("Senaryo Toplam Net Kâr", scenario.scenario_net_profit),
        ("Net Kâr Farkı", scenario.net_profit_delta),
        ("Mevcut Eşleşen Marj (%)", scenario.baseline_matched_margin_pct),
        ("Senaryo Eşleşen Marj (%)", scenario.scenario_matched_margin_pct),
        ("Eşleşen Stok", scenario.matched_count),
        ("Eşleşmeyen Stok", scenario.unmatched_count),
        ("Pozitif Eşleşen Kâr", scenario.positive_matched_profit),
    )


def _build_scenario_workbook(
    scenario: ProfitabilityScenarioAnalysis,
    *,
    checkpoint: Checkpoint | None = None,
) -> Workbook:
    workbook = Workbook()
    try:
        summary_sheet = workbook.active
        summary_sheet.title = "Senaryo Özeti"
        summary_sheet.append(_SUMMARY_HEADERS)
        for row in _summary_rows(scenario):
            run_checkpoint(checkpoint)
            summary_sheet.append(row)

        product_sheet = workbook.create_sheet("Ürün Senaryosu")
        product_sheet.append(_PRODUCT_HEADERS)
        for row in scenario.rows:
            run_checkpoint(checkpoint)
            product_sheet.append(
                (
                    neutralize_formula(row.stock_name),
                    "Evet" if row.cost_matched else "Hayır",
                    row.current_quantity,
                    row.scenario_quantity,
                    row.current_price,
                    row.scenario_price,
                    row.current_cost,
                    row.scenario_cost,
                    row.current_net_profit,
                    row.scenario_net_profit,
                    row.net_profit_delta,
                    row.current_margin_pct,
                    row.scenario_margin_pct,
                    row.break_even_price,
                    row.contribution_pct,
                    row.cumulative_contribution_pct,
                    neutralize_formula(row.pareto_class),
                )
            )

        style_profitability_header(summary_sheet, len(_SUMMARY_HEADERS))
        style_profitability_header(product_sheet, len(_PRODUCT_HEADERS))
        summary_sheet.column_dimensions["A"].width = 31
        summary_sheet.column_dimensions["B"].width = 18
        product_sheet.freeze_panes = "A2"
        product_sheet.auto_filter.ref = product_sheet.dimensions
        return workbook
    except BaseException:
        workbook.close()
        raise


class OpenpyxlProfitabilityScenarioExporter:
    """Write a scenario to a separate, explicitly selected workbook."""

    def export(
        self,
        scenario: ProfitabilityScenarioAnalysis,
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
            prefix=".profitability-scenario-",
            suffix=".xlsx",
        )
        os.close(descriptor)
        temporary_path = Path(temporary_name)
        workbook: Workbook | None = None
        try:
            workbook = _build_scenario_workbook(
                scenario,
                checkpoint=checkpoint,
            )
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
                "Karlılık senaryosu Excel dosyası atomik olarak yazılamadı."
            ) from exc
        finally:
            if workbook is not None:
                workbook.close()
            temporary_path.unlink(missing_ok=True)
        return path
