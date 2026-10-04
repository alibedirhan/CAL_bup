# -*- coding: utf-8 -*-
"""Pure state transitions for controlled profitability stock aliases."""

from __future__ import annotations

from dataclasses import dataclass, replace

MAX_MATCH_ALIASES = 2_000
MAX_MATCH_HISTORY = 5_000
MAX_STOCK_NAME_LENGTH = 160
MATCH_STATUS_PENDING = "pending"
MATCH_STATUS_APPROVED = "approved"
MATCH_SOURCE_MANUAL = "manual"
MATCH_ACTION_PROPOSED = "proposed"
MATCH_ACTION_APPROVED = "approved"
MATCH_ACTION_REMOVED = "removed"


class MatchQualityError(ValueError):
    """Base error for invalid stock alias state transitions."""


class InvalidStockAliasError(MatchQualityError):
    """An alias or target name is empty, unsafe, or self-referential."""


class DuplicateStockAliasError(MatchQualityError):
    """An alias already has a pending or approved mapping."""


class StockAliasNotFoundError(MatchQualityError):
    """The requested alias does not exist in the current state."""


class StockAliasStateError(MatchQualityError):
    """The requested transition is not valid for the alias status."""


@dataclass(frozen=True)
class StockAlias:
    alias: str
    target: str
    status: str
    source: str
    created_at: str
    updated_at: str
    revision: int


@dataclass(frozen=True)
class MatchHistoryEvent:
    revision: int
    action: str
    alias: str
    target: str
    source: str
    occurred_at: str


@dataclass(frozen=True)
class MatchQualityState:
    revision: int = 0
    aliases: tuple[StockAlias, ...] = ()
    history: tuple[MatchHistoryEvent, ...] = ()


def normalize_stock_name(value: object, *, label: str) -> str:
    if not isinstance(value, str):
        raise InvalidStockAliasError(f"{label} metin olmalıdır.")
    if not value.isprintable():
        raise InvalidStockAliasError(f"{label} kontrol karakteri içeremez.")
    normalized = " ".join(value.strip().upper().split())
    if not normalized:
        raise InvalidStockAliasError(f"{label} boş olamaz.")
    if len(normalized) > MAX_STOCK_NAME_LENGTH:
        raise InvalidStockAliasError(f"{label} çok uzun.")
    return normalized


def _with_event(
    state: MatchQualityState,
    aliases: tuple[StockAlias, ...],
    *,
    action: str,
    alias: str,
    target: str,
    timestamp: str,
) -> MatchQualityState:
    revision = state.revision + 1
    event = MatchHistoryEvent(
        revision=revision,
        action=action,
        alias=alias,
        target=target,
        source=MATCH_SOURCE_MANUAL,
        occurred_at=timestamp,
    )
    return MatchQualityState(
        revision=revision,
        aliases=aliases,
        history=(*state.history, event)[-MAX_MATCH_HISTORY:],
    )


def propose_stock_alias(
    state: MatchQualityState,
    alias: str,
    target: str,
    *,
    timestamp: str,
) -> MatchQualityState:
    normalized_alias = normalize_stock_name(alias, label="Satış stoğu")
    normalized_target = normalize_stock_name(target, label="Fiyat stoğu")
    if normalized_alias == normalized_target:
        raise InvalidStockAliasError("Satış ve fiyat stoğu aynı olamaz.")
    if any(item.alias == normalized_alias for item in state.aliases):
        raise DuplicateStockAliasError(
            "Bu satış stoğu için zaten bir eşleştirme kaydı var."
        )
    if len(state.aliases) >= MAX_MATCH_ALIASES:
        raise MatchQualityError("Eşleştirme kayıt sınırına ulaşıldı.")
    revision = state.revision + 1
    record = StockAlias(
        alias=normalized_alias,
        target=normalized_target,
        status=MATCH_STATUS_PENDING,
        source=MATCH_SOURCE_MANUAL,
        created_at=timestamp,
        updated_at=timestamp,
        revision=revision,
    )
    return _with_event(
        state,
        (*state.aliases, record),
        action=MATCH_ACTION_PROPOSED,
        alias=normalized_alias,
        target=normalized_target,
        timestamp=timestamp,
    )


def approve_stock_alias(
    state: MatchQualityState,
    alias: str,
    *,
    timestamp: str,
) -> MatchQualityState:
    normalized = normalize_stock_name(alias, label="Satış stoğu")
    current = next((item for item in state.aliases if item.alias == normalized), None)
    if current is None:
        raise StockAliasNotFoundError("Onaylanacak eşleştirme bulunamadı.")
    if current.status != MATCH_STATUS_PENDING:
        raise StockAliasStateError("Yalnız onay bekleyen eşleştirme onaylanabilir.")
    revision = state.revision + 1
    updated = replace(
        current,
        status=MATCH_STATUS_APPROVED,
        updated_at=timestamp,
        revision=revision,
    )
    aliases = tuple(updated if item.alias == normalized else item for item in state.aliases)
    return _with_event(
        state,
        aliases,
        action=MATCH_ACTION_APPROVED,
        alias=current.alias,
        target=current.target,
        timestamp=timestamp,
    )


def remove_stock_alias(
    state: MatchQualityState,
    alias: str,
    *,
    timestamp: str,
) -> MatchQualityState:
    normalized = normalize_stock_name(alias, label="Satış stoğu")
    current = next((item for item in state.aliases if item.alias == normalized), None)
    if current is None:
        raise StockAliasNotFoundError("Kaldırılacak eşleştirme bulunamadı.")
    aliases = tuple(item for item in state.aliases if item.alias != normalized)
    return _with_event(
        state,
        aliases,
        action=MATCH_ACTION_REMOVED,
        alias=current.alias,
        target=current.target,
        timestamp=timestamp,
    )


def approved_alias_map(state: MatchQualityState) -> dict[str, str]:
    return {
        item.alias: item.target
        for item in state.aliases
        if item.status == MATCH_STATUS_APPROVED
    }
