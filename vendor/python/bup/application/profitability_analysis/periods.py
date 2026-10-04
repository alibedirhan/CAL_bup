# -*- coding: utf-8 -*-
"""Use cases for saving and comparing profitability analysis periods."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from core.versioned_json_store import StoreRecoveryError
from domain.karlilik.period import (
    PeriodComparison,
    PeriodSnapshot,
    compare_periods,
)

from .dto import ProfitabilitySummary
from .ports import PeriodRepository

Clock = Callable[[], datetime]
_REPOSITORY_ERRORS = (OSError, ValueError, StoreRecoveryError)


class ProfitabilityPeriodServiceError(RuntimeError):
    """Base error exposed by profitability period use cases."""


class InvalidPeriodNameError(ProfitabilityPeriodServiceError):
    """Raised when a period name is empty after normalization."""


class PeriodSelectionError(ProfitabilityPeriodServiceError):
    """Raised when a requested comparison pair is unavailable or invalid."""


class ProfitabilityPeriodService:
    """Orchestrate period persistence and pure comparison behind one boundary."""

    def __init__(
        self,
        repository: PeriodRepository,
        *,
        clock: Clock = datetime.now,
    ) -> None:
        self._repository = repository
        self._clock = clock

    def list_periods(self) -> tuple[PeriodSnapshot, ...]:
        try:
            return tuple(self._repository.list())
        except _REPOSITORY_ERRORS as exc:
            raise ProfitabilityPeriodServiceError(
                "Kayıtlı dönemler yüklenemedi."
            ) from exc

    def save_summary(
        self,
        name: str,
        summary: ProfitabilitySummary,
    ) -> PeriodSnapshot:
        normalized_name = name.strip()
        if not normalized_name:
            raise InvalidPeriodNameError("Dönem adı boş olamaz.")
        now = self._clock()
        snapshot = PeriodSnapshot(
            id=now.strftime("%Y%m%d%H%M%S%f"),
            name=normalized_name,
            saved_at=now.isoformat(timespec="seconds"),
            total_count=summary.total_count,
            matched_count=summary.matched_count,
            fill_rate=summary.fill_rate,
            total_net_profit=summary.total_net_profit,
            average_unit_profit=summary.average_unit_profit,
            product_profits=tuple(
                (row.stock_name, row.net_profit) for row in summary.rows
            ),
        )
        try:
            self._repository.save(snapshot)
        except _REPOSITORY_ERRORS as exc:
            raise ProfitabilityPeriodServiceError("Dönem kaydedilemedi.") from exc
        return snapshot

    def delete_period(self, snapshot_id: str) -> None:
        try:
            self._repository.delete(snapshot_id)
        except _REPOSITORY_ERRORS as exc:
            raise ProfitabilityPeriodServiceError("Dönem silinemedi.") from exc

    def can_restore_last_change(self) -> bool:
        try:
            return self._repository.has_backup()
        except _REPOSITORY_ERRORS as exc:
            raise ProfitabilityPeriodServiceError(
                "Dönem yedeği denetlenemedi."
            ) from exc

    def restore_last_change(self) -> bool:
        try:
            return self._repository.restore_from_backup()
        except _REPOSITORY_ERRORS as exc:
            raise ProfitabilityPeriodServiceError(
                "Son dönem değişikliği geri alınamadı."
            ) from exc

    def compare(self, first_id: str, second_id: str) -> PeriodComparison:
        if first_id == second_id:
            raise PeriodSelectionError("İki farklı dönem seçilmelidir.")
        periods = {period.id: period for period in self.list_periods()}
        try:
            first = periods[first_id]
            second = periods[second_id]
        except KeyError as exc:
            raise PeriodSelectionError("Seçilen dönem kaydı bulunamadı.") from exc
        return compare_periods(first, second)
