# -*- coding: utf-8 -*-
"""Pure what-if, margin, break-even and Pareto calculations."""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass

from .models import ProfitabilityAnalysis

_MIN_CHANGE_PCT = -100.0
_MAX_CHANGE_PCT = 500.0


class ScenarioValidationError(ValueError):
    """A scenario assumption is non-finite or outside the supported range."""


@dataclass(frozen=True)
class ScenarioAssumptions:
    cost_change_pct: float = 0.0
    price_change_pct: float = 0.0
    quantity_change_pct: float = 0.0

    def __post_init__(self) -> None:
        for field_name, value in (
            ("cost_change_pct", self.cost_change_pct),
            ("price_change_pct", self.price_change_pct),
            ("quantity_change_pct", self.quantity_change_pct),
        ):
            try:
                numeric = float(value)
            except (TypeError, ValueError) as exc:
                raise ScenarioValidationError(
                    f"{field_name} sayısal bir değer olmalıdır."
                ) from exc
            if not math.isfinite(numeric):
                raise ScenarioValidationError(
                    f"{field_name} sonlu bir sayı olmalıdır."
                )
            if not _MIN_CHANGE_PCT <= numeric <= _MAX_CHANGE_PCT:
                raise ScenarioValidationError(
                    f"{field_name} {_MIN_CHANGE_PCT:g} ile "
                    f"{_MAX_CHANGE_PCT:g} arasında olmalıdır."
                )
            object.__setattr__(self, field_name, numeric)


@dataclass(frozen=True)
class ProfitabilityScenarioRow:
    stock_name: str
    cost_matched: bool
    current_quantity: float
    scenario_quantity: float
    current_price: float
    scenario_price: float
    current_cost: float
    scenario_cost: float
    current_net_profit: float
    scenario_net_profit: float
    net_profit_delta: float
    current_margin_pct: float
    scenario_margin_pct: float
    break_even_price: float
    contribution_pct: float | None
    cumulative_contribution_pct: float | None
    pareto_class: str


@dataclass(frozen=True)
class ProfitabilityScenarioAnalysis:
    assumptions: ScenarioAssumptions
    rows: tuple[ProfitabilityScenarioRow, ...]
    baseline_net_profit: float
    scenario_net_profit: float
    net_profit_delta: float
    baseline_matched_margin_pct: float
    scenario_matched_margin_pct: float
    matched_count: int
    unmatched_count: int
    positive_matched_profit: float


@dataclass(frozen=True)
class _ScenarioValues:
    stock_name: str
    cost_matched: bool
    current_quantity: float
    scenario_quantity: float
    current_price: float
    scenario_price: float
    current_cost: float
    scenario_cost: float
    current_net_profit: float
    scenario_net_profit: float
    net_profit_delta: float
    current_margin_pct: float
    scenario_margin_pct: float
    break_even_price: float


def _margin_pct(unit_profit: float, price: float) -> float:
    return unit_profit / price * 100.0 if price > 0 else 0.0


def _aggregate_margin(net_profit: float, revenue: float) -> float:
    return net_profit / revenue * 100.0 if revenue > 0 else 0.0


def _pareto_assignments(
    rows: list[_ScenarioValues],
) -> dict[int, tuple[float, float, str]]:
    positive = [
        (index, row)
        for index, row in enumerate(rows)
        if row.cost_matched and row.scenario_net_profit > 0
    ]
    total = sum(row.scenario_net_profit for _, row in positive)
    assignments: dict[int, tuple[float, float, str]] = {}
    cumulative = 0.0
    for index, row in sorted(
        positive,
        key=lambda pair: pair[1].scenario_net_profit,
        reverse=True,
    ):
        contribution = row.scenario_net_profit / total * 100.0
        previous = cumulative
        cumulative += contribution
        pareto_class = "A" if previous < 80 else "B" if previous < 95 else "C"
        assignments[index] = (contribution, cumulative, pareto_class)
    return assignments


def analyze_profitability_scenario(
    analysis: ProfitabilityAnalysis,
    assumptions: ScenarioAssumptions,
    *,
    checkpoint: Callable[[], None] | None = None,
) -> ProfitabilityScenarioAnalysis:
    """Apply bounded percentage assumptions to an existing analysis."""
    cost_factor = 1.0 + assumptions.cost_change_pct / 100.0
    price_factor = 1.0 + assumptions.price_change_pct / 100.0
    quantity_factor = 1.0 + assumptions.quantity_change_pct / 100.0
    unmatched = set(analysis.unmatched)
    values: list[_ScenarioValues] = []

    baseline_total = 0.0
    scenario_total = 0.0
    baseline_matched_profit = 0.0
    baseline_matched_revenue = 0.0
    scenario_matched_profit = 0.0
    scenario_matched_revenue = 0.0

    for row in analysis.rows:
        if checkpoint is not None:
            checkpoint()
        cost_matched = row.stock_name not in unmatched
        scenario_quantity = row.sales_quantity * quantity_factor
        scenario_price = row.average_sales_price * price_factor
        scenario_cost = row.unit_cost * cost_factor
        scenario_unit_profit = scenario_price - scenario_cost
        scenario_net_profit = scenario_unit_profit * scenario_quantity
        baseline_total += row.net_profit
        scenario_total += scenario_net_profit

        if cost_matched:
            baseline_matched_profit += row.net_profit
            baseline_matched_revenue += row.average_sales_price * row.sales_quantity
            scenario_matched_profit += scenario_net_profit
            scenario_matched_revenue += scenario_price * scenario_quantity

        values.append(
            _ScenarioValues(
                stock_name=row.stock_name,
                cost_matched=cost_matched,
                current_quantity=row.sales_quantity,
                scenario_quantity=scenario_quantity,
                current_price=row.average_sales_price,
                scenario_price=scenario_price,
                current_cost=row.unit_cost,
                scenario_cost=scenario_cost,
                current_net_profit=row.net_profit,
                scenario_net_profit=scenario_net_profit,
                net_profit_delta=scenario_net_profit - row.net_profit,
                current_margin_pct=_margin_pct(row.unit_profit, row.average_sales_price),
                scenario_margin_pct=_margin_pct(
                    scenario_unit_profit,
                    scenario_price,
                ),
                break_even_price=scenario_cost,
            )
        )

    assignments = _pareto_assignments(values)
    rows: list[ProfitabilityScenarioRow] = []
    for index, row in enumerate(values):
        if checkpoint is not None:
            checkpoint()
        assignment = assignments.get(index)
        if not row.cost_matched:
            contribution = cumulative = None
            pareto_class = "Eşleşmedi"
        elif assignment is None:
            contribution = cumulative = None
            pareto_class = "Zarar" if row.scenario_net_profit < 0 else "Nötr"
        else:
            contribution, cumulative, pareto_class = assignment
        rows.append(
            ProfitabilityScenarioRow(
                **row.__dict__,
                contribution_pct=contribution,
                cumulative_contribution_pct=cumulative,
                pareto_class=pareto_class,
            )
        )

    if checkpoint is not None:
        checkpoint()
    positive_matched_profit = sum(
        row.scenario_net_profit
        for row in values
        if row.cost_matched and row.scenario_net_profit > 0
    )
    return ProfitabilityScenarioAnalysis(
        assumptions=assumptions,
        rows=tuple(rows),
        baseline_net_profit=baseline_total,
        scenario_net_profit=scenario_total,
        net_profit_delta=scenario_total - baseline_total,
        baseline_matched_margin_pct=_aggregate_margin(
            baseline_matched_profit,
            baseline_matched_revenue,
        ),
        scenario_matched_margin_pct=_aggregate_margin(
            scenario_matched_profit,
            scenario_matched_revenue,
        ),
        matched_count=analysis.matched_count,
        unmatched_count=len(analysis.unmatched),
        positive_matched_profit=positive_matched_profit,
    )
