# -*- coding: utf-8 -*-
"""Pure depo / vehicle / output-filename helpers for customer tracking.

These reproduce the legacy ``Musteri_Sayisi_Kontrolu`` behaviour exactly but
without pandas, Tk, filesystem, or config side effects. Excel/dataframe access
stays in infrastructure; the known-vehicle set and driver map are passed in.
"""

from __future__ import annotations

import re
from typing import Iterable, Mapping

DEFAULT_OUTPUT_NAME = "karşılaştırma_sonucu"
MAX_FILENAME_LENGTH = 100

_INVALID_FILENAME_CHARS = re.compile(r'[\\/*?:"<>|]')
_DEPO_NAME_RE = re.compile(r"\[(.*?)\]\s*(.*?)(?:\n|\r\n|$)")

# Vehicle-number patterns, tried in order (first match whose 2-digit number is a
# known vehicle wins). Kept identical to the legacy implementation.
_VEHICLE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"[İI][Zz][Mm][İi][Rr]\s+[Aa][Rr][Aa][ÇçĞğ]\s+(\d{1,2})"),
    re.compile(r"[Aa]ra[çc]\s*(\d{1,2})"),
    re.compile(r"[Vv]ehicle\s*(\d{1,2})"),
    re.compile(r"(\d{1,2})\s*[Nn]o"),
    re.compile(r"\b(\d{1,2})\b"),
)


def extract_depo_name(first_column_cells: Iterable[object]) -> str | None:
    """Return the depo name from the first ten first-column cells.

    Mirrors the legacy scan: find the row containing ``Cari Kategori 3`` and
    pull the text after the ``[...]`` bracket.
    """
    for cell in list(first_column_cells)[:10]:
        row_str = str(cell)
        if "Cari Kategori 3" in row_str:
            match = _DEPO_NAME_RE.search(row_str)
            if match and match.group(2):
                return match.group(2).strip()
    return None


def extract_vehicle_number(
    depo_text: object,
    known_vehicles: Iterable[str],
) -> str | None:
    """Return the first 2-digit vehicle number found that is a known vehicle."""
    if not isinstance(depo_text, str):
        return None
    known = set(known_vehicles)
    for pattern in _VEHICLE_PATTERNS:
        match = pattern.search(depo_text)
        if not match:
            continue
        try:
            vehicle_num = f"{int(match.group(1)):02d}"
        except (ValueError, AttributeError):
            continue
        if vehicle_num in known:
            return vehicle_num
    return None


def sanitize_filename(filename: str) -> str:
    """Strip filesystem-unsafe characters and bound length."""
    safe_name = _INVALID_FILENAME_CHARS.sub("", filename).strip()
    if len(safe_name) > MAX_FILENAME_LENGTH:
        safe_name = safe_name[:MAX_FILENAME_LENGTH]
    return safe_name or DEFAULT_OUTPUT_NAME


def create_filename_with_driver(
    depo_text: str | None,
    vehicle_drivers: Mapping[str, str],
) -> str:
    """Build an output filename, embedding the driver when the vehicle is known."""
    if depo_text:
        vehicle_num = extract_vehicle_number(depo_text, vehicle_drivers.keys())
        if vehicle_num and vehicle_num in vehicle_drivers:
            return sanitize_filename(f"Arac_{vehicle_num}_{vehicle_drivers[vehicle_num]}")
        return sanitize_filename(depo_text)
    return DEFAULT_OUTPUT_NAME


def resolve_export_header(
    depo_name: str | None,
    vehicle_drivers: Mapping[str, str],
) -> str | None:
    """Title shown on exported Excel/image: ``Araç NN - Driver`` or depo name.

    Returns ``None`` when there is no depo name, matching the legacy behaviour
    where the export carries no header section.
    """
    if not depo_name:
        return None
    vehicle_num = extract_vehicle_number(depo_name, vehicle_drivers.keys())
    if vehicle_num and vehicle_num in vehicle_drivers:
        return f"Araç {vehicle_num} - {vehicle_drivers[vehicle_num]}"
    return depo_name
