"""Pure discount calculation API and typed boundary failures."""

from .errors import (
    DiscountExportError,
    DiscountExportExistsError,
    DiscountExportWriteError,
    InvalidDiscountExportDataError,
    InvalidDiscountExportPathError,
)

__all__ = [
    "DiscountExportError",
    "DiscountExportExistsError",
    "DiscountExportWriteError",
    "InvalidDiscountExportDataError",
    "InvalidDiscountExportPathError",
]
