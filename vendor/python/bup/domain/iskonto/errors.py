# -*- coding: utf-8 -*-
"""Typed failures for discount full-export boundaries."""

from __future__ import annotations


class DiscountExportError(Exception):
    """Base error for a refused or failed discount export."""


class InvalidDiscountExportPathError(DiscountExportError):
    """The selected output path is unsafe or unsupported."""


class DiscountExportExistsError(DiscountExportError):
    """An output would be overwritten without explicit approval."""


class InvalidDiscountExportDataError(DiscountExportError):
    """The export payload exceeds its schema or processing limits."""


class DiscountExportWriteError(DiscountExportError):
    """The requested output could not be written atomically."""
