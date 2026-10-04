# -*- coding: utf-8 -*-
"""Validated, versioned and private persistence for profitability aliases."""

from __future__ import annotations

import logging
from pathlib import Path

from core.settings import get_config_dir
from core.versioned_json_store import VersionedJsonStore
from domain.karlilik import (
    MATCH_STATUS_APPROVED,
    MATCH_STATUS_PENDING,
    MatchHistoryEvent,
    MatchQualityState,
    StockAlias,
    normalize_stock_name,
)
from domain.karlilik.matching import (
    MATCH_ACTION_APPROVED,
    MATCH_ACTION_PROPOSED,
    MATCH_ACTION_REMOVED,
    MATCH_SOURCE_MANUAL,
    MAX_MATCH_ALIASES,
    MAX_MATCH_HISTORY,
)

logger = logging.getLogger("BUP_PROFITABILITY_MATCHES")

SCHEMA_VERSION = 1
MAX_STORE_BYTES = 512 * 1024
MAX_TIMESTAMP_LENGTH = 64
_STATUSES = {MATCH_STATUS_PENDING, MATCH_STATUS_APPROVED}
_ACTIONS = {MATCH_ACTION_PROPOSED, MATCH_ACTION_APPROVED, MATCH_ACTION_REMOVED}


def _timestamp(value: object) -> str:
    if not isinstance(value, str) or not value or len(value) > MAX_TIMESTAMP_LENGTH:
        raise ValueError("Geçersiz eşleştirme zamanı")
    if not value.isprintable():
        raise ValueError("Eşleştirme zamanı kontrol karakteri içeremez")
    return value


def _name(value: object, label: str) -> str:
    normalized = normalize_stock_name(value, label=label)
    if value != normalized:
        raise ValueError(f"{label} normalize edilmemiş")
    return normalized


def _alias_from_dict(raw: object) -> StockAlias:
    if not isinstance(raw, dict):
        raise ValueError("Eşleştirme kaydı bir nesne olmalıdır")
    status = raw.get("status")
    source = raw.get("source")
    if status not in _STATUSES or source != MATCH_SOURCE_MANUAL:
        raise ValueError("Geçersiz eşleştirme durumu veya kaynağı")
    revision_raw = raw.get("revision", -1)
    if isinstance(revision_raw, bool) or not isinstance(revision_raw, int):
        raise ValueError("Geçersiz eşleştirme revizyonu")
    revision = revision_raw
    if revision < 1:
        raise ValueError("Geçersiz eşleştirme revizyonu")
    alias = _name(raw.get("alias"), "Satış stoğu")
    target = _name(raw.get("target"), "Fiyat stoğu")
    if alias == target:
        raise ValueError("Satış ve fiyat stoğu aynı olamaz")
    return StockAlias(
        alias=alias,
        target=target,
        status=status,
        source=source,
        created_at=_timestamp(raw.get("created_at")),
        updated_at=_timestamp(raw.get("updated_at")),
        revision=revision,
    )


def _event_from_dict(raw: object) -> MatchHistoryEvent:
    if not isinstance(raw, dict):
        raise ValueError("Eşleştirme geçmişi bir nesne olmalıdır")
    action = raw.get("action")
    source = raw.get("source")
    if action not in _ACTIONS or source != MATCH_SOURCE_MANUAL:
        raise ValueError("Geçersiz geçmiş eylemi veya kaynağı")
    revision_raw = raw.get("revision", -1)
    if isinstance(revision_raw, bool) or not isinstance(revision_raw, int):
        raise ValueError("Geçersiz geçmiş revizyonu")
    revision = revision_raw
    if revision < 1:
        raise ValueError("Geçersiz geçmiş revizyonu")
    return MatchHistoryEvent(
        revision=revision,
        action=action,
        alias=_name(raw.get("alias"), "Satış stoğu"),
        target=_name(raw.get("target"), "Fiyat stoğu"),
        source=source,
        occurred_at=_timestamp(raw.get("occurred_at")),
    )


def _parse_payload(payload: object) -> MatchQualityState:
    if not isinstance(payload, dict):
        raise ValueError("Eşleştirme dosyası bir JSON nesnesi olmalıdır")
    if payload.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("Desteklenmeyen eşleştirme dosyası şeması")
    revision_raw = payload.get("revision", -1)
    raw_aliases = payload.get("aliases")
    raw_history = payload.get("history")
    if isinstance(revision_raw, bool) or not isinstance(revision_raw, int):
        raise ValueError("Geçersiz eşleştirme dosyası revizyonu")
    revision = revision_raw
    if revision < 0 or revision > 10_000_000:
        raise ValueError("Geçersiz eşleştirme dosyası revizyonu")
    if not isinstance(raw_aliases, list) or len(raw_aliases) > MAX_MATCH_ALIASES:
        raise ValueError("Eşleştirme listesi geçersiz")
    if not isinstance(raw_history, list) or len(raw_history) > MAX_MATCH_HISTORY:
        raise ValueError("Eşleştirme geçmişi geçersiz")
    aliases = tuple(_alias_from_dict(item) for item in raw_aliases)
    history = tuple(_event_from_dict(item) for item in raw_history)
    names = [item.alias for item in aliases]
    if len(names) != len(set(names)):
        raise ValueError("Aynı satış stoğu birden fazla kez kaydedilmiş")
    if any(item.revision > revision for item in (*aliases, *history)):
        raise ValueError("Kayıt revizyonu dosya revizyonunu aşıyor")
    history_revisions = [item.revision for item in history]
    if history_revisions != sorted(set(history_revisions)):
        raise ValueError("Geçmiş revizyonları sıralı ve benzersiz olmalıdır")
    if history and history[-1].revision != revision:
        raise ValueError("Son geçmiş revizyonu dosya revizyonuyla eşleşmiyor")
    if not history and revision != 0:
        raise ValueError("Geçmişsiz eşleştirme dosyası revizyonlu olamaz")
    return MatchQualityState(revision=revision, aliases=aliases, history=history)


def _state_payload(state: MatchQualityState) -> dict[str, object]:
    return {
        "schema_version": SCHEMA_VERSION,
        "revision": state.revision,
        "aliases": [
            {
                "alias": item.alias,
                "target": item.target,
                "status": item.status,
                "source": item.source,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
                "revision": item.revision,
            }
            for item in state.aliases
        ],
        "history": [
            {
                "revision": item.revision,
                "action": item.action,
                "alias": item.alias,
                "target": item.target,
                "source": item.source,
                "occurred_at": item.occurred_at,
            }
            for item in state.history
        ],
    }


class ProfitabilityMatchStore:
    """Load and atomically persist bounded alias state and audit history."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or get_config_dir() / "profitability_matches.json"
        self._storage = VersionedJsonStore(
            self.path,
            max_bytes=MAX_STORE_BYTES,
            label="Karlılık eşleştirme dosyası",
            logger=logger,
        )
        self.backup_path = self._storage.backup_path

    def load(self) -> MatchQualityState:
        return self._storage.load(_parse_payload, MatchQualityState)

    def save(self, state: MatchQualityState) -> None:
        self._storage.write(_state_payload(state), _parse_payload)

    def restore_from_backup(self) -> bool:
        return self._storage.restore_from_backup(_parse_payload)

    def has_backup(self) -> bool:
        return self.backup_path.is_file() and not self.backup_path.is_symlink()
