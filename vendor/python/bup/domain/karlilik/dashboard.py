# -*- coding: utf-8 -*-
"""Pure profitability-dashboard analytics.

Derived analytics over the immutable profitability result rows: profit-band
distribution, per-band product lists, top products, profit/loss split and
summary statistics. This is presentation analytics — it does NOT change the
golden-locked profitability math in ``analysis.py`` / ``calculations.py``. No
pandas, no UI, no matplotlib here; the Qt dashboard renders these results.

Band semantics reproduce the legacy ``KARLILIK_ANALIZI`` dashboard:
- ``zararda``: ``net_profit < 0``.
- positive rows (``net_profit >= 0``) are split by the 33rd/67th percentiles of
  their net profit into ``dusuk_karli`` / ``orta_karli`` / ``cok_karli``.
The profit/loss pie keeps its own legacy split (``> 0`` vs ``<= 0``).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from .models import ProfitabilityResultRow

CATEGORY_ALL = "all"
CATEGORY_COK_KARLI = "cok_karli"
CATEGORY_ORTA_KARLI = "orta_karli"
CATEGORY_DUSUK_KARLI = "dusuk_karli"
CATEGORY_ZARARDA = "zararda"

CATEGORY_LABELS = {
    CATEGORY_ALL: "Tümü",
    CATEGORY_COK_KARLI: "Çok Karlı Ürünler",
    CATEGORY_ORTA_KARLI: "Orta Karlı Ürünler",
    CATEGORY_DUSUK_KARLI: "Düşük Karlı Ürünler",
    CATEGORY_ZARARDA: "Zararda Olan Ürünler",
}


@dataclass(frozen=True)
class ProductEntry:
    """A single product row reduced to its dashboard-relevant fields."""

    stock_name: str
    net_profit: float


@dataclass(frozen=True)
class ProfitDistribution:
    """Counts of products per profit band."""

    cok_karli: int
    orta_karli: int
    dusuk_karli: int
    zararda: int

    @property
    def total(self) -> int:
        return self.cok_karli + self.orta_karli + self.dusuk_karli + self.zararda

    def count_for(self, category: str) -> int:
        return {
            CATEGORY_COK_KARLI: self.cok_karli,
            CATEGORY_ORTA_KARLI: self.orta_karli,
            CATEGORY_DUSUK_KARLI: self.dusuk_karli,
            CATEGORY_ZARARDA: self.zararda,
            CATEGORY_ALL: self.total,
        }.get(category, 0)


@dataclass(frozen=True)
class DashboardStatistics:
    """Aggregate profitability figures for the statistics panel."""

    product_count: int
    profitable_count: int
    loss_count: int
    total_net_profit: float
    average_net_profit: float
    max_net_profit: float
    min_net_profit: float


def _linear_quantile(sorted_values: Sequence[float], q: float) -> float:
    """Linear-interpolation quantile matching numpy/pandas defaults."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    position = q * (len(sorted_values) - 1)
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    fraction = position - lower
    return float(sorted_values[lower] + fraction * (sorted_values[upper] - sorted_values[lower]))


def _positive_thresholds(rows: Sequence[ProfitabilityResultRow]) -> tuple[float, float]:
    positives = sorted(row.net_profit for row in rows if row.net_profit >= 0)
    return _linear_quantile(positives, 0.33), _linear_quantile(positives, 0.67)


def profit_distribution(rows: Sequence[ProfitabilityResultRow]) -> ProfitDistribution:
    """Split rows into loss / low / mid / high profit bands (legacy semantics)."""
    zararda = sum(1 for row in rows if row.net_profit < 0)
    positives = [row.net_profit for row in rows if row.net_profit >= 0]
    if not positives:
        return ProfitDistribution(0, 0, 0, zararda)
    q33, q67 = _positive_thresholds(rows)
    dusuk = sum(1 for value in positives if value < q33)
    orta = sum(1 for value in positives if q33 <= value < q67)
    cok = sum(1 for value in positives if value >= q67)
    return ProfitDistribution(cok_karli=cok, orta_karli=orta, dusuk_karli=dusuk, zararda=zararda)


def products_in_category(
    rows: Sequence[ProfitabilityResultRow],
    category: str,
    *,
    limit: int = 15,
) -> tuple[ProductEntry, ...]:
    """Return up to ``limit`` products for a profit band, ranked as in legacy."""
    if category == CATEGORY_ZARARDA:
        selected = sorted((r for r in rows if r.net_profit < 0), key=lambda r: r.net_profit)
        selected = selected[:limit]
    elif category in (CATEGORY_COK_KARLI, CATEGORY_ORTA_KARLI, CATEGORY_DUSUK_KARLI):
        positives = [r for r in rows if r.net_profit >= 0]
        if not positives:
            return ()
        q33, q67 = _positive_thresholds(rows)
        if category == CATEGORY_COK_KARLI:
            band = [r for r in positives if r.net_profit >= q67]
        elif category == CATEGORY_ORTA_KARLI:
            band = [r for r in positives if q33 <= r.net_profit < q67]
        else:
            band = [r for r in positives if r.net_profit < q33]
        selected = sorted(band, key=lambda r: r.net_profit, reverse=True)[:limit]
    else:  # CATEGORY_ALL
        selected = sorted(rows, key=lambda r: r.net_profit, reverse=True)[:limit]
    return tuple(ProductEntry(r.stock_name, r.net_profit) for r in selected)


def top_products_by_profit(
    rows: Sequence[ProfitabilityResultRow],
    *,
    limit: int = 10,
) -> tuple[ProductEntry, ...]:
    """Top ``limit`` products by net profit, highest first (bar chart source)."""
    selected = sorted(rows, key=lambda r: r.net_profit, reverse=True)[:limit]
    return tuple(ProductEntry(r.stock_name, r.net_profit) for r in selected)


def profit_loss_split(rows: Sequence[ProfitabilityResultRow]) -> tuple[int, int]:
    """(profitable, loss) counts for the pie chart (legacy ``>0`` vs ``<=0``)."""
    profitable = sum(1 for row in rows if row.net_profit > 0)
    loss = sum(1 for row in rows if row.net_profit <= 0)
    return profitable, loss


def dashboard_statistics(rows: Sequence[ProfitabilityResultRow]) -> DashboardStatistics:
    """Aggregate figures for the statistics panel."""
    count = len(rows)
    if count == 0:
        return DashboardStatistics(0, 0, 0, 0.0, 0.0, 0.0, 0.0)
    profits = [row.net_profit for row in rows]
    total = sum(profits)
    return DashboardStatistics(
        product_count=count,
        profitable_count=sum(1 for value in profits if value > 0),
        loss_count=sum(1 for value in profits if value <= 0),
        total_net_profit=total,
        average_net_profit=total / count,
        max_net_profit=max(profits),
        min_net_profit=min(profits),
    )
