# -*- coding: utf-8 -*-
"""Pure value objects and errors for customer tracking."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CustomerSheet:
    """A parsed customer list: depo name, detected header row, and customers."""

    depo_name: str | None
    header_row: int
    customers: tuple[str, ...]

    @property
    def customer_count(self) -> int:
        return len(self.customers)


class CustomerDataError(Exception):
    """Base error for unreadable or invalid customer data, mappable to UI copy."""


class InvalidCustomerFileError(CustomerDataError):
    """The file is missing, too large, wrong type, or not a readable workbook."""


class HeaderNotFoundError(CustomerDataError):
    """No ``Cari Ünvan`` header row was found in the sheet."""


class CariColumnNotFoundError(CustomerDataError):
    """No ``Cari Ünvan`` column was found after header detection."""


class CustomerExportError(CustomerDataError):
    """Base error for a refused or failed customer comparison export."""


class InvalidCustomerExportPathError(CustomerExportError):
    """The selected customer export path is unsafe or unsupported."""


class CustomerExportExistsError(CustomerExportError):
    """The customer export would overwrite a file without explicit approval."""


class CustomerExportWriteError(CustomerExportError):
    """The customer comparison output could not be written atomically."""
