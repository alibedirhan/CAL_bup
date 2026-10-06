# -*- coding: utf-8 -*-
"""Vehicle-to-personnel assignment domain values."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class VehicleAssignment:
    """One vehicle's responsible-person assignment."""

    arac_no: str
    sorumlu: str
    email: str = ""
    telefon: str = ""
    departman: str = ""
    notlar: str = ""
    atama_tarihi: str = ""
