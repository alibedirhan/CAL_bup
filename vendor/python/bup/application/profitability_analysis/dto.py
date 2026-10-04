# -*- coding: utf-8 -*-
"""Application DTOs and typed errors for profitability analysis."""

from __future__ import annotations

from dataclasses import dataclass

from core.cancellation import Checkpoint, run_checkpoint
from core.visible_export import VisibleTableSnapshot
from domain.karlilik import ProfitabilityAnalysis, ProfitabilityResultRow


class ProfitabilityApplicationError(Exception):
    """Base error translated into user-facing feedback by the UI."""


class ProfitabilityNotAnalyzedError(ProfitabilityApplicationError):
    """Raised when export is requested before an analysis exists."""


@dataclass(frozen=True)
class ProfitabilitySummary:
    rows: tuple[ProfitabilityResultRow, ...]
    matched_count: int
    total_count: int
    unmatched: tuple[str, ...]
    fill_rate: float
    average_unit_cost: float
    average_unit_profit: float
    total_net_profit: float

    @classmethod
    def from_analysis(
        cls,
        analysis: ProfitabilityAnalysis,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> "ProfitabilitySummary":
        matched_costs: list[float] = []
        unit_profits: list[float] = []
        total_net_profit = 0.0
        for row in analysis.rows:
            run_checkpoint(checkpoint)
            if row.unit_cost > 0:
                matched_costs.append(row.unit_cost)
            unit_profits.append(row.unit_profit)
            total_net_profit += row.net_profit
        total_count = len(analysis.rows)
        return cls(
            rows=analysis.rows,
            matched_count=analysis.matched_count,
            total_count=total_count,
            unmatched=analysis.unmatched,
            fill_rate=(analysis.matched_count / total_count * 100) if total_count else 0.0,
            average_unit_cost=(
                sum(matched_costs) / len(matched_costs) if matched_costs else 0.0
            ),
            average_unit_profit=(
                sum(unit_profits) / len(unit_profits) if unit_profits else 0.0
            ),
            total_net_profit=total_net_profit,
        )


def build_profitability_visible_snapshot(
    rows: tuple[ProfitabilityResultRow, ...],
    *,
    checkpoint: Checkpoint | None = None,
) -> VisibleTableSnapshot:
    matched = 0
    total_net_profit = 0.0
    snapshot_rows: list[tuple[object, ...]] = []
    for row in rows:
        run_checkpoint(checkpoint)
        matched += row.unit_cost > 0
        total_net_profit += row.net_profit
        snapshot_rows.append(
            (
                row.stock_name,
                row.sales_quantity,
                row.average_sales_price,
                row.sales_amount,
                row.unit_cost,
                row.unit_profit,
                row.net_profit,
            )
        )
    return VisibleTableSnapshot(
        title="Karlılık Analizi — Görünen Satırlar",
        headers=(
            "Stok İsmi",
            "Satış Miktarı",
            "Ort. Satış Fiyatı",
            "Satış Tutarı",
            "Birim Maliyet",
            "Birim Kâr",
            "Net Kâr",
        ),
        rows=tuple(snapshot_rows),
        metadata=(
            ("Kapsam", "Ekranda görünen satırlar"),
            ("Sıralama", "Ekrandaki sıra"),
            ("Satır Sayısı", len(rows)),
            ("Eşleşen Stok", matched),
            ("Eşleşmeyen Stok", len(rows) - matched),
            ("Doluluk Oranı (%)", matched / len(rows) * 100 if rows else 0.0),
            ("Toplam Net Kâr", total_net_profit),
        ),
    )
