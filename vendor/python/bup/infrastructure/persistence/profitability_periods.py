# -*- coding: utf-8 -*-
"""Persistence adapter for validated profitability period snapshots.

Replaces the legacy ``donem_analizleri.json`` (written into the package dir with
no real data) with a validated store in the per-user config directory. Each
snapshot captures one completed analysis so two periods can be compared for
real. Atomic, 0600-permission writes; bounded size, count and product list.
"""

from __future__ import annotations

import logging
from math import isfinite
from pathlib import Path

from core.settings import get_config_dir
from core.versioned_json_store import VersionedJsonStore
from domain.karlilik.period import PeriodSnapshot

logger = logging.getLogger("BUP_KARLILIK_PERIODS")

MAX_STORE_BYTES = 4 * 1024 * 1024
MAX_PERIODS = 200
MAX_PRODUCTS = 5000
MAX_NAME_LENGTH = 120
SCHEMA_VERSION = 1


def _finite_float(value: object, label: str) -> float:
    parsed = float(value)
    if not isfinite(parsed):
        raise ValueError(f"{label} sonlu bir sayı olmalıdır")
    return parsed


def _snapshot_to_dict(snapshot: PeriodSnapshot) -> dict:
    return {
        "id": snapshot.id,
        "name": snapshot.name,
        "saved_at": snapshot.saved_at,
        "total_count": snapshot.total_count,
        "matched_count": snapshot.matched_count,
        "fill_rate": snapshot.fill_rate,
        "total_net_profit": snapshot.total_net_profit,
        "average_unit_profit": snapshot.average_unit_profit,
        "product_profits": [[name, value] for name, value in snapshot.product_profits],
    }


def _snapshot_from_dict(raw: object) -> PeriodSnapshot:
    if not isinstance(raw, dict):
        raise ValueError("Dönem kaydı bir nesne olmalıdır")
    name = str(raw.get("name", "")).strip()[:MAX_NAME_LENGTH]
    if not name:
        raise ValueError("Dönem adı boş olamaz")
    products_raw = raw.get("product_profits", [])
    if not isinstance(products_raw, list) or len(products_raw) > MAX_PRODUCTS:
        raise ValueError("Geçersiz ürün listesi")
    products: list[tuple[str, float]] = []
    for entry in products_raw:
        if not isinstance(entry, (list, tuple)) or len(entry) != 2:
            raise ValueError("Geçersiz ürün kaydı")
        products.append(
            (
                str(entry[0])[:MAX_NAME_LENGTH],
                _finite_float(entry[1], "Ürün kârı"),
            )
        )
    return PeriodSnapshot(
        id=str(raw.get("id", "")),
        name=name,
        saved_at=str(raw.get("saved_at", "")),
        total_count=int(raw.get("total_count", 0)),
        matched_count=int(raw.get("matched_count", 0)),
        fill_rate=_finite_float(raw.get("fill_rate", 0.0), "Doluluk oranı"),
        total_net_profit=_finite_float(
            raw.get("total_net_profit", 0.0),
            "Toplam net kâr",
        ),
        average_unit_profit=_finite_float(
            raw.get("average_unit_profit", 0.0),
            "Ortalama birim kâr",
        ),
        product_profits=tuple(products),
    )


def _parse_payload(payload: object) -> list[PeriodSnapshot]:
    if not isinstance(payload, dict):
        raise ValueError("Dönem dosyası bir JSON nesnesi olmalıdır")
    schema_version = payload.get("schema_version")
    if schema_version not in (None, SCHEMA_VERSION):
        raise ValueError("Desteklenmeyen dönem dosyası şeması")
    if "periods" not in payload:
        raise ValueError("Dönem dosyasında zorunlu dönem listesi eksik")
    raw_list = payload["periods"]
    if not isinstance(raw_list, list) or len(raw_list) > MAX_PERIODS:
        raise ValueError("Dönem listesi geçersiz")
    return [_snapshot_from_dict(item) for item in raw_list]


class PeriodStore:
    """Load and atomically persist validated profitability period snapshots."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or get_config_dir() / "profitability_periods.json"
        self._storage = VersionedJsonStore(
            self.path,
            max_bytes=MAX_STORE_BYTES,
            label="Dönem dosyası",
            logger=logger,
        )
        self.backup_path = self._storage.backup_path

    def list(self) -> list[PeriodSnapshot]:
        return self._storage.load(_parse_payload, list)

    def save(self, snapshot: PeriodSnapshot) -> None:
        periods = [
            period
            for period in self._storage.load(_parse_payload, list, for_update=True)
            if period.id != snapshot.id
        ]
        periods.append(snapshot)
        if len(periods) > MAX_PERIODS:
            periods = periods[-MAX_PERIODS:]
        self._write(periods)

    def delete(self, snapshot_id: str) -> None:
        periods = [
            period
            for period in self._storage.load(_parse_payload, list, for_update=True)
            if period.id != snapshot_id
        ]
        self._write(periods)

    def restore_from_backup(self) -> bool:
        return self._storage.restore_from_backup(_parse_payload)

    def has_backup(self) -> bool:
        return self.backup_path.is_file() and not self.backup_path.is_symlink()

    def _write(self, periods: list[PeriodSnapshot]) -> None:
        payload = {
            "schema_version": SCHEMA_VERSION,
            "periods": [_snapshot_to_dict(period) for period in periods],
        }
        self._storage.write(payload, _parse_payload)
