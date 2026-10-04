# -*- coding: utf-8 -*-
"""Pure value objects for profitability analysis."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias

NumericValue: TypeAlias = str | int | float | None


@dataclass(frozen=True)
class PriceSourceRow:
    """One source row from the discount/price report."""

    stock_name: str | None
    date: str | None
    depot: str | None
    price: NumericValue


@dataclass(frozen=True)
class ProfitabilitySourceRow:
    """One stock row from the profitability workbook."""

    stock_name: str
    sales_quantity: NumericValue
    average_sales_price: NumericValue
    sales_amount: NumericValue


@dataclass(frozen=True)
class ProfitabilityResultRow:
    stock_name: str
    sales_quantity: float
    average_sales_price: float
    sales_amount: float
    unit_cost: float
    unit_profit: float
    net_profit: float


@dataclass(frozen=True)
class ProfitabilityAnalysis:
    rows: tuple[ProfitabilityResultRow, ...]
    matched_count: int
    unmatched: tuple[str, ...]
    applied_aliases: tuple[tuple[str, str], ...] = ()


class ProfitabilityDataError(Exception):
    """Base error for invalid profitability input or output data."""


class InvalidProfitabilityWorkbookError(ProfitabilityDataError):
    """The workbook is missing, unsafe, malformed, or unsupported."""


class ProfitabilityWorkbookLimitError(ProfitabilityDataError):
    """The workbook exceeds a bounded processing limit."""


class ProfitabilityHeaderNotFoundError(ProfitabilityDataError):
    """No supported report header was found."""


class ProfitabilityColumnNotFoundError(ProfitabilityDataError):
    """A required report column was not found."""


class ProfitabilityWorkbookEmptyError(ProfitabilityDataError):
    """The workbook contains no usable data rows."""


class ProfitabilityExportError(ProfitabilityDataError):
    """Base error for a refused or failed profitability export."""


class InvalidProfitabilityExportPathError(ProfitabilityExportError):
    """The requested export path is unsafe or unsupported."""


class ProfitabilityExportExistsError(ProfitabilityExportError):
    """The requested export would silently overwrite an existing file."""


class ProfitabilityExportWriteError(ProfitabilityExportError):
    """The workbook could not be written atomically."""
