# -*- coding: utf-8 -*-
"""Pure aging-bucket categorization and ordering.

Faithful port of ``_get_yaslanding_category`` and ``_sort_aging_columns`` from
``YASLANDIRMA.modules.analysis_*``.
"""

from __future__ import annotations

# Ordered (substring -> canonical category) mapping. Order matters: the first
# substring found in the lower-cased column name wins.
_CATEGORY_MAPPING: tuple[tuple[str, str], ...] = (
    ("açık hesap", "Açık Hesap"),
    ("acik hesap", "Açık Hesap"),
    ("0-7", "0-7 Gün"),
    ("8-14", "8-14 Gün"),
    ("15-21", "15-21 Gün"),
    ("22-28", "22-28 Gün"),
    ("29-35", "29-35 Gün"),
    ("36-42", "36-42 Gün"),
    ("43-49", "43-49 Gün"),
    ("50-56", "50-56 Gün"),
    ("57-63", "57-63 Gün"),
    ("64-70", "64-70 Gün"),
    ("71-77", "71-77 Gün"),
    ("77+", "77+ Gün"),
    ("diğer bakiye", "Diğer Bakiye"),
    ("diger bakiye", "Diğer Bakiye"),
    ("toplam", "Toplam"),
    ("genel toplam", "Genel Toplam"),
)

# Sort order for aging columns (index = priority). Same source list as legacy.
_SORT_ORDER: tuple[str, ...] = (
    "açık hesap",
    "acik hesap",
    "0-7",
    "8-14",
    "15-21",
    "22-28",
    "29-35",
    "36-42",
    "43-49",
    "50-56",
    "57-63",
    "64-70",
    "71-77",
    "77+",
    "diğer bakiye",
    "diger bakiye",
    "toplam",
    "genel toplam",
)


def categorize_bucket(column_name: str) -> str:
    """Map a raw aging column name to its canonical category label."""
    lowered = str(column_name).lower()
    for substring, category in _CATEGORY_MAPPING:
        if substring in lowered:
            return category
    return lowered


def bucket_sort_key(column_name: str) -> int:
    """Sort key matching the legacy aging-column ordering."""
    lowered = str(column_name).lower()
    for index, substring in enumerate(_SORT_ORDER):
        if substring in lowered:
            return index
    return 999


def is_open_account_column(column_name: str) -> bool:
    """Whether the raw column contributes to the open-account total."""
    lowered = str(column_name).lower()
    return "açık hesap" in lowered or "acik hesap" in lowered
