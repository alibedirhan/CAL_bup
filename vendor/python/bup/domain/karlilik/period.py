# -*- coding: utf-8 -*-
"""Pure period-comparison analytics for the profitability module.

A ``PeriodSnapshot`` is an immutable capture of one completed analysis (headline
metrics + per-product net profit). ``compare_periods`` computes REAL deltas
between two snapshots — replacing the legacy ``Dönem Karşılaştırma`` stub, which
never computed anything. Pure: no pandas, UI, or I/O.
"""

from __future__ import annotations

from dataclasses import dataclass

from .dashboard import ProductEntry  # noqa: F401  (re-exported for callers)


@dataclass(frozen=True)
class PeriodSnapshot:
    """Immutable capture of one analysis for later comparison."""

    id: str
    name: str
    saved_at: str
    total_count: int
    matched_count: int
    fill_rate: float
    total_net_profit: float
    average_unit_profit: float
    product_profits: tuple[tuple[str, float], ...]


@dataclass(frozen=True)
class MetricDelta:
    """One headline metric across two periods."""

    key: str
    label: str
    first: float
    second: float
    is_money: bool = False

    @property
    def delta(self) -> float:
        return self.second - self.first

    @property
    def pct_change(self) -> float | None:
        if self.first == 0:
            return None
        return (self.second - self.first) / abs(self.first) * 100.0


@dataclass(frozen=True)
class ProductMovement:
    """Net-profit change of a single product across two periods."""

    stock_name: str
    first: float
    second: float

    @property
    def delta(self) -> float:
        return self.second - self.first


@dataclass(frozen=True)
class PeriodComparison:
    """Full comparison result between two named periods."""

    first: PeriodSnapshot
    second: PeriodSnapshot
    metrics: tuple[MetricDelta, ...]
    top_gainers: tuple[ProductMovement, ...]
    top_losers: tuple[ProductMovement, ...]


_METRICS = (
    ("total_net_profit", "Toplam Net Kâr", True),
    ("total_count", "Toplam Ürün", False),
    ("matched_count", "Eşleşen Ürün", False),
    ("fill_rate", "Doluluk (%)", False),
    ("average_unit_profit", "Ort. Birim Kâr", True),
)


def compare_periods(
    first: PeriodSnapshot,
    second: PeriodSnapshot,
    *,
    movers: int = 5,
) -> PeriodComparison:
    """Compute headline metric deltas and the biggest product movers."""
    metrics = tuple(
        MetricDelta(
            key=key,
            label=label,
            first=float(getattr(first, key)),
            second=float(getattr(second, key)),
            is_money=is_money,
        )
        for key, label, is_money in _METRICS
    )

    first_map = dict(first.product_profits)
    second_map = dict(second.product_profits)
    movements = [
        ProductMovement(name, first_map.get(name, 0.0), second_map.get(name, 0.0))
        for name in sorted(set(first_map) | set(second_map))
    ]
    by_delta = sorted(movements, key=lambda m: m.delta, reverse=True)
    gainers = tuple(m for m in by_delta if m.delta > 0)[:movers]
    losers = tuple(m for m in reversed(by_delta) if m.delta < 0)[:movers]
    return PeriodComparison(
        first=first,
        second=second,
        metrics=metrics,
        top_gainers=gainers,
        top_losers=losers,
    )
