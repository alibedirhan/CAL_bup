# -*- coding: utf-8 -*-
"""Aging (yaşlandırma) analysis orchestration independent from UI and Excel."""

from __future__ import annotations

from pathlib import Path
from collections.abc import Iterable

from core.cancellation import Checkpoint, run_checkpoint
from ..visible_export import (
    VisibleExportNotConfiguredError,
    VisibleTableExporter,
    validate_visible_selection,
)
from domain.yaslandirma import AgingAnalysis, analyze_aging
from domain.yaslandirma import VehicleAging

from .dto import AgingNotAnalyzedError, AgingSummary, build_aging_visible_snapshot
from .ports import AgingExporter, AgingWorkbookReader, PathInput


class AgingAnalysisFacade:
    def __init__(
        self,
        reader: AgingWorkbookReader,
        exporter: AgingExporter | None = None,
        visible_exporter: VisibleTableExporter | None = None,
    ) -> None:
        self._reader = reader
        self._exporter = exporter
        self._visible_exporter = visible_exporter
        self._analysis: AgingAnalysis | None = None

    @property
    def analysis(self) -> AgingAnalysis | None:
        return self._analysis

    @property
    def summary(self) -> AgingSummary | None:
        if self._analysis is None:
            return None
        return AgingSummary.from_analysis(self._analysis)

    def analyze(
        self,
        aging_path: PathInput,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> AgingSummary:
        run_checkpoint(checkpoint)
        if checkpoint is None:
            report = self._reader.read_aging_report(aging_path)
        else:
            report = self._reader.read_aging_report(
                aging_path,
                checkpoint=checkpoint,
            )
        run_checkpoint(checkpoint)
        analysis = analyze_aging(
            report.rows,
            report.bucket_columns,
            checkpoint=checkpoint,
        )
        summary = AgingSummary.from_analysis(analysis, checkpoint=checkpoint)
        run_checkpoint(checkpoint)
        self._analysis = analysis
        return summary

    def export(
        self,
        destination: PathInput,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        if self._analysis is None:
            raise AgingNotAnalyzedError(
                "Dışa aktarmadan önce yaşlandırma analizi çalıştırılmalıdır."
            )
        if self._exporter is None:
            raise AgingNotAnalyzedError("Bu facade için dışa aktarma yapılandırılmadı.")
        run_checkpoint(checkpoint)
        if checkpoint is None:
            return self._exporter.export(
                self._analysis,
                destination,
                overwrite=overwrite,
            )
        return self._exporter.export(
            self._analysis,
            destination,
            overwrite=overwrite,
            checkpoint=checkpoint,
        )

    def export_visible(
        self,
        vehicles: Iterable[VehicleAging],
        destination: PathInput,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        if self._analysis is None:
            raise AgingNotAnalyzedError(
                "Dışa aktarmadan önce yaşlandırma analizi çalıştırılmalıdır."
            )
        if self._visible_exporter is None:
            raise VisibleExportNotConfiguredError(
                "Görünür satır dışa aktarma yapılandırılmadı."
            )
        selected = validate_visible_selection(
            vehicles,
            self._analysis.vehicles,
            checkpoint=checkpoint,
        )
        snapshot = build_aging_visible_snapshot(selected, checkpoint=checkpoint)
        if checkpoint is None:
            return self._visible_exporter.export(
                snapshot,
                destination,
                overwrite=overwrite,
            )
        return self._visible_exporter.export(
            snapshot,
            destination,
            overwrite=overwrite,
            checkpoint=checkpoint,
        )

    def clear(self) -> None:
        self._analysis = None
