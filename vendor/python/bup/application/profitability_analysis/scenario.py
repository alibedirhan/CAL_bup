# -*- coding: utf-8 -*-
"""Application-facing DTOs and errors for profitability scenarios."""

from __future__ import annotations

from dataclasses import dataclass

from domain.karlilik import (
    ProfitabilityScenarioAnalysis,
    ProfitabilityScenarioRow,
    ScenarioAssumptions,
)

from .dto import ProfitabilityApplicationError


class ProfitabilityScenarioNotCalculatedError(ProfitabilityApplicationError):
    """Raised when a scenario result is requested before calculation."""


class ProfitabilityScenarioExportNotConfiguredError(ProfitabilityApplicationError):
    """Raised when the scenario export adapter was not wired."""


class InvalidProfitabilityScenarioError(ProfitabilityApplicationError):
    """Raised when a scenario assumption is outside supported bounds."""


@dataclass(frozen=True)
class ProfitabilityScenarioSummary:
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

    @classmethod
    def from_analysis(
        cls,
        analysis: ProfitabilityScenarioAnalysis,
    ) -> "ProfitabilityScenarioSummary":
        return cls(
            assumptions=analysis.assumptions,
            rows=analysis.rows,
            baseline_net_profit=analysis.baseline_net_profit,
            scenario_net_profit=analysis.scenario_net_profit,
            net_profit_delta=analysis.net_profit_delta,
            baseline_matched_margin_pct=analysis.baseline_matched_margin_pct,
            scenario_matched_margin_pct=analysis.scenario_matched_margin_pct,
            matched_count=analysis.matched_count,
            unmatched_count=analysis.unmatched_count,
            positive_matched_profit=analysis.positive_matched_profit,
        )
