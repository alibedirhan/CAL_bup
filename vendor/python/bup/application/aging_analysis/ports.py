# -*- coding: utf-8 -*-
"""Dependency ports for aging (yaşlandırma) analysis."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from core.cancellation import Checkpoint
from domain.yaslandirma import AgingAnalysis, AgingReport, VehicleAssignment

PathInput = str | Path


class AgingWorkbookReader(Protocol):
    def read_aging_report(
        self,
        path: PathInput,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> AgingReport: ...


class AgingExporter(Protocol):
    def export(
        self,
        analysis: AgingAnalysis,
        destination: PathInput,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path: ...


class VehicleAssignmentRepository(Protocol):
    """Persistence port for vehicle-to-personnel assignments."""

    def assignments(self) -> dict[str, VehicleAssignment]: ...

    def assign(self, assignment: VehicleAssignment) -> None: ...

    def remove(self, arac_no: str) -> None: ...

    def restore_from_backup(self) -> bool: ...

    def has_backup(self) -> bool: ...
