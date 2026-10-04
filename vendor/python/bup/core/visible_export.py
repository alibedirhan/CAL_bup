# -*- coding: utf-8 -*-
"""Toolkit-independent contracts and typed failures for visible-row exports."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias

VisibleCell: TypeAlias = str | int | float | None


@dataclass(frozen=True)
class VisibleTableSnapshot:
    """Exact ordered rows selected from a result table, before file I/O."""

    title: str
    headers: tuple[str, ...]
    rows: tuple[tuple[VisibleCell, ...], ...]
    metadata: tuple[tuple[str, VisibleCell], ...] = ()


class VisibleExportError(Exception):
    """Base error for a refused or failed visible-row export."""


class InvalidVisibleExportDataError(VisibleExportError):
    """The snapshot is empty, malformed, or exceeds bounded output limits."""


class InvalidVisibleExportPathError(VisibleExportError):
    """The selected destination is unsafe or unsupported."""


class VisibleExportExistsError(VisibleExportError):
    """The destination exists and overwrite was not explicitly approved."""


class VisibleExportWriteError(VisibleExportError):
    """The workbook could not be written atomically."""
