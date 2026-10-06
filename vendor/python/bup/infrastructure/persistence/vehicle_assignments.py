# -*- coding: utf-8 -*-
"""Validated vehicle-assignment JSON persistence adapter."""

from __future__ import annotations

import logging
from pathlib import Path

from core.settings import get_config_dir
from core.versioned_json_store import VersionedJsonStore
from domain.yaslandirma import VehicleAssignment

logger = logging.getLogger("BUP_VEHICLE_ASSIGNMENTS")

MAX_STORE_BYTES = 512 * 1024
MAX_ASSIGNMENTS = 500
MAX_FIELD_LENGTH = 200
SCHEMA_VERSION = 1


def _clean(value: object) -> str:
    return str(value).strip()[:MAX_FIELD_LENGTH]


def _from_dict(raw: object) -> VehicleAssignment:
    if not isinstance(raw, dict):
        raise ValueError("Atama kaydı bir nesne olmalıdır")
    arac_no = _clean(raw.get("arac_no", ""))
    sorumlu = _clean(raw.get("sorumlu", ""))
    if not arac_no or not sorumlu:
        raise ValueError("Araç no ve sorumlu zorunludur")
    return VehicleAssignment(
        arac_no=arac_no,
        sorumlu=sorumlu,
        email=_clean(raw.get("email", "")),
        telefon=_clean(raw.get("telefon", "")),
        departman=_clean(raw.get("departman", "")),
        notlar=_clean(raw.get("notlar", "")),
        atama_tarihi=_clean(raw.get("atama_tarihi", "")),
    )


def _to_dict(assignment: VehicleAssignment) -> dict[str, str]:
    return {
        "arac_no": assignment.arac_no,
        "sorumlu": assignment.sorumlu,
        "email": assignment.email,
        "telefon": assignment.telefon,
        "departman": assignment.departman,
        "notlar": assignment.notlar,
        "atama_tarihi": assignment.atama_tarihi,
    }


def _parse_payload(payload: object) -> dict[str, VehicleAssignment]:
    if not isinstance(payload, dict):
        raise ValueError("Atama dosyası bir JSON nesnesi olmalıdır")
    schema_version = payload.get("schema_version")
    if schema_version not in (None, SCHEMA_VERSION):
        raise ValueError("Desteklenmeyen atama dosyası şeması")
    if "assignments" not in payload:
        raise ValueError("Atama dosyasında zorunlu atama listesi eksik")
    raw_list = payload["assignments"]
    if not isinstance(raw_list, list) or len(raw_list) > MAX_ASSIGNMENTS:
        raise ValueError("Atama listesi geçersiz")
    result: dict[str, VehicleAssignment] = {}
    for item in raw_list:
        assignment = _from_dict(item)
        result[assignment.arac_no] = assignment
    return result


class VehicleAssignmentStore:
    """Atomically persist validated vehicle assignments."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or get_config_dir() / "vehicle_assignments.json"
        self._storage = VersionedJsonStore(
            self.path,
            max_bytes=MAX_STORE_BYTES,
            label="Atama dosyası",
            logger=logger,
        )
        self.backup_path = self._storage.backup_path

    def assignments(self) -> dict[str, VehicleAssignment]:
        return self._storage.load(_parse_payload, dict)

    def assign(self, assignment: VehicleAssignment) -> None:
        current = self._storage.load(_parse_payload, dict, for_update=True)
        current[assignment.arac_no] = assignment
        self._write(current)

    def remove(self, arac_no: str) -> None:
        current = self._storage.load(_parse_payload, dict, for_update=True)
        current.pop(arac_no, None)
        self._write(current)

    def restore_from_backup(self) -> bool:
        return self._storage.restore_from_backup(_parse_payload)

    def has_backup(self) -> bool:
        return self.backup_path.is_file() and not self.backup_path.is_symlink()

    def _write(self, assignments: dict[str, VehicleAssignment]) -> None:
        ordered = sorted(assignments.values(), key=lambda item: item.arac_no)
        payload = {
            "schema_version": SCHEMA_VERSION,
            "assignments": [_to_dict(assignment) for assignment in ordered],
        }
        self._storage.write(payload, _parse_payload)
