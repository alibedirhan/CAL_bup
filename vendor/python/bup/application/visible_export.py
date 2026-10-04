# -*- coding: utf-8 -*-
"""Shared application port and selection validation for visible-row export."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Protocol, TypeVar

from core.cancellation import Checkpoint, run_checkpoint
from core.visible_export import VisibleTableSnapshot

PathInput = str | Path
T = TypeVar("T")


class VisibleExportSelectionError(Exception):
    """Raised when a UI selection is empty, duplicated, or no longer current."""


class VisibleExportNotConfiguredError(Exception):
    """Raised when a facade has no visible-row exporter adapter."""


class VisibleTableExporter(Protocol):
    def export(
        self,
        snapshot: VisibleTableSnapshot,
        destination: PathInput,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path: ...


def validate_visible_selection(
    selected: Iterable[T],
    available: Sequence[T],
    *,
    checkpoint: Checkpoint | None = None,
) -> tuple[T, ...]:
    """Validate and preserve UI order without trusting formatted cell text."""

    ordered = tuple(selected)
    if not ordered:
        raise VisibleExportSelectionError("Dışa aktarılacak görünür satır yok.")
    try:
        run_checkpoint(checkpoint)
        remaining = Counter(available)
        for item in ordered:
            run_checkpoint(checkpoint)
            if remaining[item] <= 0:
                raise VisibleExportSelectionError(
                    "Görünür satır seçimi güncel analizle eşleşmiyor."
                )
            remaining[item] -= 1
    except TypeError:
        unhashable_remaining = list(available)
        for item in ordered:
            run_checkpoint(checkpoint)
            try:
                unhashable_remaining.remove(item)
            except ValueError as exc:
                raise VisibleExportSelectionError(
                    "Görünür satır seçimi güncel analizle eşleşmiyor."
                ) from exc
    return ordered
