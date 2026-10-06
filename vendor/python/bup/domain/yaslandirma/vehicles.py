# -*- coding: utf-8 -*-
"""Pure vehicle-number extraction and matching for aging analysis.

Faithful port of the two legacy phases in
``YASLANDIRMA.modules.analysis_extract``:

* :func:`extract_vehicle_numbers` mirrors ``_extract_arac_numbers`` (scan all
  category values, skip depot/branch categories, collect 0<n<100).
* :func:`row_matches_vehicle` mirrors ``_get_arac_data`` (strict per-vehicle
  membership test with padded/normal patterns and word boundaries).
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable

# Categories that are not real vehicles (depot/branch/centre/etc.).
_SKIP_KEYWORDS = ("İZMİR ŞUBE DEPO", "DEPO", "MERKEZ", "GENEL", "KESİMHANE")

# Extraction patterns (phase 1), applied to the upper-cased category value.
_EXTRACT_PATTERNS = (
    r"\[İZMİR ARAÇ (\d+)\]",
    r"İZMİR ARAÇ (\d+)",
    r"ARAÇ (\d+)",
    r"(\d+)\s*ARAÇ",
    r"^(\d+)$",
    r"(\d+)(?:\s|$)",
)


def _is_vehicle_number(number: int) -> bool:
    return 0 < number < 100


def extract_vehicle_numbers(
    categories: Iterable[str],
    *,
    checkpoint: Callable[[], None] | None = None,
) -> list[int]:
    """Return the sorted, unique vehicle numbers present in the categories."""
    numbers: set[int] = set()
    for raw in categories:
        if checkpoint is not None:
            checkpoint()
        if raw is None:
            continue
        value = str(raw).strip().upper()
        if not value:
            continue
        if any(keyword in value for keyword in _SKIP_KEYWORDS):
            continue

        try:
            direct = int(value)
        except ValueError:
            direct = None
        if direct is not None and _is_vehicle_number(direct):
            numbers.add(direct)
            continue

        for pattern in _EXTRACT_PATTERNS:
            matched = False
            for match in re.findall(pattern, value):
                try:
                    candidate = int(match)
                except ValueError:
                    continue
                if _is_vehicle_number(candidate):
                    numbers.add(candidate)
                    matched = True
                    break
            if matched:
                break
    return sorted(numbers)


def row_matches_vehicle(category: str | None, vehicle_no: int) -> bool:
    """Strict membership test: does this category belong to ``vehicle_no``?"""
    if category is None:
        return False
    value = str(category).strip()
    if not value:
        return False

    padded = f"{vehicle_no:02d}"
    normal = str(vehicle_no)
    if value == padded or value == normal:
        return True

    patterns = (
        rf"\[İZMİR ARAÇ {padded}\]",
        rf"\[İZMİR ARAÇ {normal}\]",
        rf"\bİZMİR ARAÇ {padded}\b",
        rf"\bİZMİR ARAÇ {normal}\b",
        rf"\bARAÇ {padded}\b",
        rf"\bARAÇ {normal}\b",
        rf"^{padded}$",
        rf"^{normal}$",
    )
    value_upper = value.upper()
    return any(re.search(pattern, value_upper) for pattern in patterns)
