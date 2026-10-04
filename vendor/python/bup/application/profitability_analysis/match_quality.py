# -*- coding: utf-8 -*-
"""Application use cases and DTOs for controlled stock alias quality."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime

from core.versioned_json_store import StoreRecoveryError
from domain.karlilik import (
    MatchHistoryEvent,
    MatchQualityError,
    MatchQualityState,
    StockAlias,
    approve_stock_alias,
    approved_alias_map,
    propose_stock_alias,
    remove_stock_alias,
)

from .dto import ProfitabilityApplicationError, ProfitabilitySummary
from .ports import MatchQualityRepository

_REPOSITORY_ERRORS = (OSError, ValueError, StoreRecoveryError)


class ProfitabilityMatchQualityError(ProfitabilityApplicationError):
    """A controlled matching operation could not be completed."""


class ProfitabilityMatchQualityNotConfiguredError(ProfitabilityMatchQualityError):
    """The production alias repository was not injected."""


class ProfitabilityMatchSelectionError(ProfitabilityMatchQualityError):
    """The alias or target is not valid in the current analysis context."""


@dataclass(frozen=True)
class MatchQualitySnapshot:
    revision: int
    aliases: tuple[StockAlias, ...]
    history: tuple[MatchHistoryEvent, ...]
    unmatched: tuple[str, ...]
    price_targets: tuple[str, ...]
    applied_aliases: tuple[tuple[str, str], ...]
    can_restore: bool


@dataclass(frozen=True)
class MatchQualityUpdate:
    snapshot: MatchQualitySnapshot
    analysis_summary: ProfitabilitySummary | None


class ProfitabilityMatchQualityService:
    """Persist pure alias transitions behind a repository port."""

    def __init__(
        self,
        repository: MatchQualityRepository,
        *,
        clock=datetime.now,
    ) -> None:
        self._repository = repository
        self._clock = clock

    def state(self) -> MatchQualityState:
        try:
            return self._repository.load()
        except _REPOSITORY_ERRORS as exc:
            raise ProfitabilityMatchQualityError(
                "Eşleştirme kayıtları yüklenemedi."
            ) from exc

    def approved_aliases(self) -> Mapping[str, str]:
        return approved_alias_map(self.state())

    def propose(self, alias: str, target: str) -> MatchQualityState:
        return self._transition(propose_stock_alias, alias, target)

    def approve(self, alias: str) -> MatchQualityState:
        return self._transition(approve_stock_alias, alias)

    def remove(self, alias: str) -> MatchQualityState:
        return self._transition(remove_stock_alias, alias)

    def can_restore(self) -> bool:
        try:
            return self._repository.has_backup()
        except _REPOSITORY_ERRORS as exc:
            raise ProfitabilityMatchQualityError(
                "Eşleştirme yedeği denetlenemedi."
            ) from exc

    def restore(self) -> MatchQualityState:
        try:
            restored = self._repository.restore_from_backup()
        except _REPOSITORY_ERRORS as exc:
            raise ProfitabilityMatchQualityError(
                "Son eşleştirme değişikliği geri alınamadı."
            ) from exc
        if not restored:
            raise ProfitabilityMatchQualityError(
                "Geri alınabilecek eşleştirme değişikliği bulunamadı."
            )
        return self.state()

    def _transition(self, operation, *args: str) -> MatchQualityState:
        state = self.state()
        timestamp = self._clock().isoformat(timespec="seconds")
        try:
            updated = operation(state, *args, timestamp=timestamp)
            self._repository.save(updated)
        except MatchQualityError as exc:
            raise ProfitabilityMatchSelectionError(str(exc)) from exc
        except _REPOSITORY_ERRORS as exc:
            raise ProfitabilityMatchQualityError(
                "Eşleştirme değişikliği kaydedilemedi."
            ) from exc
        return updated
