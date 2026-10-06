# -*- coding: utf-8 -*-
"""Pure Turkish-number parsing for aging analysis (no pandas/numpy/IO).

Faithful port of ``YASLANDIRMA.utils_numbers.parse_turkish_number`` so the pure
domain reproduces the locked legacy aging math byte-for-byte.
"""

from __future__ import annotations

import math
import re
from typing import Any

_CURRENCY_SYMBOLS = ("₺", "TL", "$", "€", "£", "¥", "₽")
_EMPTY_TOKENS = frozenset({"nan", "none", "null", "-", ""})


def parse_turkish_number(value: Any) -> float:
    """Convert a Turkish-locale numeric value to float; 0.0 on any failure."""
    if value is None or value == "":
        return 0.0
    if isinstance(value, float) and math.isnan(value):
        return 0.0
    if isinstance(value, (int, float)) and not (
        isinstance(value, float) and math.isnan(value)
    ):
        return float(value)

    try:
        value_str = str(value).strip()
    except Exception:
        return 0.0

    if not value_str or value_str.lower() in _EMPTY_TOKENS:
        return 0.0

    try:
        is_negative = False
        if value_str.startswith("(") and value_str.endswith(")"):
            is_negative = True
            value_str = value_str[1:-1].strip()
        elif value_str.startswith("-"):
            is_negative = True
            value_str = value_str[1:].strip()

        for symbol in _CURRENCY_SYMBOLS:
            value_str = value_str.replace(symbol, "")
        value_str = value_str.strip()

        if "," in value_str and "." in value_str:
            parts = value_str.split(",")
            if len(parts) == 2 and len(parts[1]) <= 2 and parts[1].isdigit():
                value_str = f"{parts[0].replace('.', '')}.{parts[1]}"
            else:
                value_str = re.sub(r"[,.]", "", value_str)
        elif "," in value_str:
            parts = value_str.split(",")
            if len(parts) == 2 and len(parts[1]) <= 2 and parts[1].isdigit():
                value_str = value_str.replace(",", ".")
            else:
                value_str = value_str.replace(",", "")
        elif "." in value_str:
            parts = value_str.split(".")
            if len(parts) == 2 and len(parts[1]) <= 2 and parts[1].isdigit():
                pass
            elif len(parts) > 2:
                value_str = value_str.replace(".", "")

        cleaned = re.sub(r"[^\d.-]", "", value_str)
        if not cleaned or cleaned in ("-", ".", "-."):
            return 0.0

        result = float(cleaned)
        if is_negative:
            result = -result
        if abs(result) > 1e15:
            return 0.0
        return result
    except (ValueError, TypeError, OverflowError):
        return 0.0
