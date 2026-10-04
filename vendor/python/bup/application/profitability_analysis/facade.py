# -*- coding: utf-8 -*-
"""Profitability analysis orchestration independent from UI and Excel."""

from __future__ import annotations

from pathlib import Path
from collections.abc import Iterable

from core.cancellation import Checkpoint, run_checkpoint
from ..visible_export import (
    VisibleExportNotConfiguredError,
    VisibleTableExporter,
    validate_visible_selection,
)
from domain.karlilik import (
    ProfitabilityAnalysis,
    ProfitabilityResultRow,
    ProfitabilityScenarioAnalysis,
    MatchQualityError,
    ScenarioAssumptions,
    ScenarioValidationError,
    analyze_profitability,
    analyze_profitability_scenario,
    create_price_map,
    normalize_stock_name,
)

from .dto import (
    ProfitabilityNotAnalyzedError,
    ProfitabilitySummary,
    build_profitability_visible_snapshot,
)
from .ports import (
    MatchQualityRepository,
    PathInput,
    ProfitabilityExporter,
    ProfitabilityScenarioExporter,
    ProfitabilityWorkbookReader,
)
from .match_quality import (
    MatchQualitySnapshot,
    MatchQualityUpdate,
    ProfitabilityMatchQualityNotConfiguredError,
    ProfitabilityMatchQualityService,
    ProfitabilityMatchSelectionError,
)
from .scenario import (
    InvalidProfitabilityScenarioError,
    ProfitabilityScenarioExportNotConfiguredError,
    ProfitabilityScenarioNotCalculatedError,
    ProfitabilityScenarioSummary,
)


class ProfitabilityAnalysisFacade:
    def __init__(
        self,
        reader: ProfitabilityWorkbookReader,
        exporter: ProfitabilityExporter,
        visible_exporter: VisibleTableExporter | None = None,
        scenario_exporter: ProfitabilityScenarioExporter | None = None,
        match_repository: MatchQualityRepository | None = None,
    ) -> None:
        self._reader = reader
        self._exporter = exporter
        self._visible_exporter = visible_exporter
        self._scenario_exporter = scenario_exporter
        self._match_service = (
            ProfitabilityMatchQualityService(match_repository)
            if match_repository is not None
            else None
        )
        self._analysis: ProfitabilityAnalysis | None = None
        self._scenario: ProfitabilityScenarioAnalysis | None = None
        self._price_rows = None
        self._profitability_rows = None
        self._price_names: tuple[str, ...] = ()

    @property
    def analysis(self) -> ProfitabilityAnalysis | None:
        return self._analysis

    @property
    def summary(self) -> ProfitabilitySummary | None:
        if self._analysis is None:
            return None
        return ProfitabilitySummary.from_analysis(self._analysis)

    @property
    def scenario(self) -> ProfitabilityScenarioSummary | None:
        if self._scenario is None:
            return None
        return ProfitabilityScenarioSummary.from_analysis(self._scenario)

    @property
    def match_quality(self) -> MatchQualitySnapshot:
        if self._match_service is None:
            state_aliases = state_history = ()
            revision = 0
            can_restore = False
        else:
            state = self._match_service.state()
            state_aliases = state.aliases
            state_history = state.history
            revision = state.revision
            can_restore = self._match_service.can_restore()
        analysis = self._analysis
        return MatchQualitySnapshot(
            revision=revision,
            aliases=state_aliases,
            history=state_history,
            unmatched=analysis.unmatched if analysis is not None else (),
            price_targets=self._price_names,
            applied_aliases=(
                analysis.applied_aliases if analysis is not None else ()
            ),
            can_restore=can_restore,
        )

    def analyze(
        self,
        profitability_path: PathInput,
        price_report_path: PathInput,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> ProfitabilitySummary:
        run_checkpoint(checkpoint)
        approved_aliases = (
            self._match_service.approved_aliases()
            if self._match_service is not None
            else {}
        )
        if checkpoint is None:
            price_rows = self._reader.read_price_report(price_report_path)
            profitability_rows = self._reader.read_profitability_report(
                profitability_path
            )
        else:
            price_rows = self._reader.read_price_report(
                price_report_path,
                checkpoint=checkpoint,
            )
            run_checkpoint(checkpoint)
            profitability_rows = self._reader.read_profitability_report(
                profitability_path,
                checkpoint=checkpoint,
            )
            run_checkpoint(checkpoint)
        analysis = analyze_profitability(
            price_rows,
            profitability_rows,
            approved_aliases=approved_aliases,
            checkpoint=checkpoint,
        )
        summary = ProfitabilitySummary.from_analysis(
            analysis,
            checkpoint=checkpoint,
        )
        run_checkpoint(checkpoint)
        self._analysis = analysis
        self._scenario = None
        self._price_rows = price_rows
        self._profitability_rows = profitability_rows
        self._price_names = tuple(
            sorted(create_price_map(price_rows, checkpoint=checkpoint))
        )
        return summary

    def propose_match(self, alias: str, target: str) -> MatchQualitySnapshot:
        service = self._required_match_service()
        snapshot = self.match_quality
        normalized_alias = self._normalize_match_name(alias, "Satış stoğu")
        normalized_target = self._normalize_match_name(target, "Fiyat stoğu")
        if normalized_alias not in snapshot.unmatched:
            raise ProfitabilityMatchSelectionError(
                "Yalnız güncel analizde eşleşmeyen bir satış stoğu önerilebilir."
            )
        if normalized_target not in snapshot.price_targets:
            raise ProfitabilityMatchSelectionError(
                "Hedef stok güncel fiyat raporunda bulunamadı."
            )
        service.propose(normalized_alias, normalized_target)
        return self.match_quality

    def approve_match(self, alias: str) -> MatchQualityUpdate:
        service = self._required_match_service()
        normalized = self._normalize_match_name(alias, "Satış stoğu")
        if self._analysis is None or normalized not in self._analysis.unmatched:
            raise ProfitabilityMatchSelectionError(
                "Onay için satış stoğu güncel analizde eşleşmiyor olmalıdır."
            )
        service.approve(normalized)
        summary = self._reanalyze_cached()
        return MatchQualityUpdate(self.match_quality, summary)

    def remove_match(self, alias: str) -> MatchQualityUpdate:
        service = self._required_match_service()
        service.remove(alias)
        summary = self._reanalyze_cached()
        return MatchQualityUpdate(self.match_quality, summary)

    def restore_match_change(self) -> MatchQualityUpdate:
        service = self._required_match_service()
        service.restore()
        summary = self._reanalyze_cached()
        return MatchQualityUpdate(self.match_quality, summary)

    def _required_match_service(self) -> ProfitabilityMatchQualityService:
        if self._match_service is None:
            raise ProfitabilityMatchQualityNotConfiguredError(
                "Eşleştirme kalite merkezi yapılandırılmadı."
            )
        return self._match_service

    @staticmethod
    def _normalize_match_name(value: str, label: str) -> str:
        try:
            return normalize_stock_name(value, label=label)
        except MatchQualityError as exc:
            raise ProfitabilityMatchSelectionError(str(exc)) from exc

    def _reanalyze_cached(self) -> ProfitabilitySummary | None:
        if self._price_rows is None or self._profitability_rows is None:
            return None
        aliases = self._required_match_service().approved_aliases()
        analysis = analyze_profitability(
            self._price_rows,
            self._profitability_rows,
            approved_aliases=aliases,
        )
        self._analysis = analysis
        self._scenario = None
        return ProfitabilitySummary.from_analysis(analysis)

    def run_scenario(
        self,
        *,
        cost_change_pct: float = 0.0,
        price_change_pct: float = 0.0,
        quantity_change_pct: float = 0.0,
        checkpoint: Checkpoint | None = None,
    ) -> ProfitabilityScenarioSummary:
        if self._analysis is None:
            raise ProfitabilityNotAnalyzedError(
                "Senaryo hesaplamadan önce karlılık analizi çalıştırılmalıdır."
            )
        run_checkpoint(checkpoint)
        try:
            assumptions = ScenarioAssumptions(
                cost_change_pct=cost_change_pct,
                price_change_pct=price_change_pct,
                quantity_change_pct=quantity_change_pct,
            )
        except (ScenarioValidationError, TypeError, ValueError) as exc:
            raise InvalidProfitabilityScenarioError(str(exc)) from exc
        scenario = analyze_profitability_scenario(
            self._analysis,
            assumptions,
            checkpoint=checkpoint,
        )
        run_checkpoint(checkpoint)
        self._scenario = scenario
        return ProfitabilityScenarioSummary.from_analysis(scenario)

    def export_scenario(
        self,
        destination: PathInput,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        if self._scenario is None:
            raise ProfitabilityScenarioNotCalculatedError(
                "Dışa aktarmadan önce bir karlılık senaryosu hesaplanmalıdır."
            )
        if self._scenario_exporter is None:
            raise ProfitabilityScenarioExportNotConfiguredError(
                "Karlılık senaryosu dışa aktarma yapılandırılmadı."
            )
        run_checkpoint(checkpoint)
        if checkpoint is None:
            return self._scenario_exporter.export(
                self._scenario,
                destination,
                overwrite=overwrite,
            )
        return self._scenario_exporter.export(
            self._scenario,
            destination,
            overwrite=overwrite,
            checkpoint=checkpoint,
        )

    def export(
        self,
        destination: PathInput,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        if self._analysis is None:
            raise ProfitabilityNotAnalyzedError(
                "Dışa aktarmadan önce karlılık analizi çalıştırılmalıdır."
            )
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
        rows: Iterable[ProfitabilityResultRow],
        destination: PathInput,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        if self._analysis is None:
            raise ProfitabilityNotAnalyzedError(
                "Dışa aktarmadan önce karlılık analizi çalıştırılmalıdır."
            )
        if self._visible_exporter is None:
            raise VisibleExportNotConfiguredError(
                "Görünür satır dışa aktarma yapılandırılmadı."
            )
        selected = validate_visible_selection(
            rows,
            self._analysis.rows,
            checkpoint=checkpoint,
        )
        snapshot = build_profitability_visible_snapshot(
            selected,
            checkpoint=checkpoint,
        )
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
        self._scenario = None
        self._price_rows = None
        self._profitability_rows = None
        self._price_names = ()
