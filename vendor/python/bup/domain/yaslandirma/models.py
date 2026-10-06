# -*- coding: utf-8 -*-
"""Pure value objects for aging (yaşlandırma) analysis."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TypeAlias

NumericValue: TypeAlias = str | int | float | None


@dataclass(frozen=True)
class AgingSourceRow:
    """One source row: a vehicle category, a customer and its bucket balances.

    ``balances`` maps the raw aging column name to its raw (possibly Turkish
    locale string) value, exactly as read from the workbook.
    """

    vehicle_category: str | None
    cari_unvan: str | None
    balances: Mapping[str, NumericValue]


@dataclass(frozen=True)
class AgingReport:
    """Parsed aging workbook content: source rows plus the bucket columns.

    This is the toolkit-neutral output a reader adapter produces and the input
    :func:`domain.yaslandirma.analyze_aging` consumes.
    """

    rows: tuple[AgingSourceRow, ...]
    bucket_columns: tuple[str, ...]


@dataclass(frozen=True)
class CustomerAging:
    cari_unvan: str
    toplam_bakiye: float
    bakiye_detay: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class VehicleAging:
    arac_no: str
    musteri_sayisi: int
    toplam_bakiye: float
    acik_hesap: float
    yaslanding_analizi: dict[str, float]
    musteri_detaylari: tuple[CustomerAging, ...]


@dataclass(frozen=True)
class AgingAnalysis:
    """Immutable per-vehicle aging result, keyed by vehicle number string."""

    vehicles: tuple[VehicleAging, ...]

    def to_reference(self) -> dict[str, dict]:
        """Serialize to the legacy reference shape (for golden equivalence)."""
        return {
            vehicle.arac_no: {
                "arac_no": vehicle.arac_no,
                "musteri_sayisi": vehicle.musteri_sayisi,
                "toplam_bakiye": vehicle.toplam_bakiye,
                "acik_hesap": vehicle.acik_hesap,
                "yaslanding_analizi": dict(vehicle.yaslanding_analizi),
                "musteri_detaylari": [
                    {
                        "cari_unvan": customer.cari_unvan,
                        "toplam_bakiye": customer.toplam_bakiye,
                        "bakiye_detay": dict(customer.bakiye_detay),
                    }
                    for customer in vehicle.musteri_detaylari
                ],
            }
            for vehicle in self.vehicles
        }


class AgingDataError(Exception):
    """Base error for invalid aging input data."""


class InvalidAgingWorkbookError(AgingDataError):
    """The workbook is missing, unsafe, malformed, or unsupported."""


class AgingWorkbookLimitError(AgingDataError):
    """The aging workbook exceeds a bounded processing limit."""


class AgingHeaderNotFoundError(AgingDataError):
    """No supported aging report header was found."""


class AgingColumnNotFoundError(AgingDataError):
    """A required aging column (vehicle/customer/balance) was not found."""


class AgingWorkbookEmptyError(AgingDataError):
    """The workbook contains no usable data rows."""


class AgingExportError(AgingDataError):
    """Base error for a refused or failed aging export."""


class InvalidAgingExportPathError(AgingExportError):
    """The requested export path is unsafe or unsupported."""


class AgingExportExistsError(AgingExportError):
    """The requested export would silently overwrite an existing file."""


class AgingExportWriteError(AgingExportError):
    """The workbook could not be written atomically."""
