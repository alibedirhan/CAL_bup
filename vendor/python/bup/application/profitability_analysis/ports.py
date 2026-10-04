# -*- coding: utf-8 -*-
"""Dependency ports for profitability analysis."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from core.cancellation import Checkpoint
from domain.karlilik import (
    PriceSourceRow,
    MatchQualityState,
    ProfitabilityAnalysis,
    ProfitabilityScenarioAnalysis,
    ProfitabilitySourceRow,
)
from domain.karlilik.period import PeriodSnapshot

PathInput = str | Path


class ProfitabilityWorkbookReader(Protocol):
    def read_price_report(
        self,
        path: PathInput,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> tuple[PriceSourceRow, ...]: ...

    def read_profitability_report(
        self,
        path: PathInput,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> tuple[ProfitabilitySourceRow, ...]: ...


class ProfitabilityExporter(Protocol):
    def export(
        self,
        analysis: ProfitabilityAnalysis,
        destination: PathInput,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path: ...


class ProfitabilityScenarioExporter(Protocol):
    def export(
        self,
        scenario: ProfitabilityScenarioAnalysis,
        destination: PathInput,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path: ...


class MatchQualityRepository(Protocol):
    """Persistence boundary for approved and pending stock aliases."""

    def load(self) -> MatchQualityState: ...

    def save(self, state: MatchQualityState) -> None: ...

    def restore_from_backup(self) -> bool: ...

    def has_backup(self) -> bool: ...


class PeriodRepository(Protocol):
    """Persistence boundary for named profitability analysis snapshots."""

    def list(self) -> list[PeriodSnapshot]: ...

    def save(self, snapshot: PeriodSnapshot) -> None: ...

    def delete(self, snapshot_id: str) -> None: ...

    def restore_from_backup(self) -> bool: ...

    def has_backup(self) -> bool: ...
