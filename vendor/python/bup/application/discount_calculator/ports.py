# -*- coding: utf-8 -*-
"""Dependency protocols used by the discount calculator application API."""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Mapping, Protocol, Sequence

from core.cancellation import Checkpoint


class PriceListReader(Protocol):
    categories: Mapping[str, Sequence[Mapping[str, object]]]

    def determine_pdf_type(
        self,
        pdf_path: str,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> str: ...

    def extract_data_from_pdf(
        self,
        pdf_path: str,
        pdf_type: str = "normal",
        *,
        checkpoint: Checkpoint | None = None,
    ) -> bool: ...

    def apply_discounts(
        self,
        discount_rates: Mapping[str, float],
        *,
        checkpoint: Checkpoint | None = None,
    ) -> dict[str, list[dict]]: ...

    def get_product_count(self) -> int: ...


PriceListReaderFactory = Callable[[], PriceListReader]


class DiscountExporter(Protocol):
    exports_dir: Path

    def export_to_excel_multi(
        self,
        all_pdf_data: Mapping[str, Mapping[str, object]],
        discount_rates: Mapping[str, float],
        file_path: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path: ...

    def existing_pdf_outputs(
        self,
        all_pdf_data: Mapping[str, Mapping[str, object]],
        save_dir: str | Path,
    ) -> tuple[Path, ...]: ...

    def export_to_pdf_multi(
        self,
        all_pdf_data: Mapping[str, Mapping[str, object]],
        discount_rates: Mapping[str, float],
        save_dir: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> list[Path]: ...

    def export_bundle(
        self,
        all_pdf_data: Mapping[str, Mapping[str, object]],
        discount_rates: Mapping[str, float],
        excel_path: str | Path,
        pdf_dir: str | Path,
        *,
        excel_overwrite: bool = False,
        pdf_overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> list[Path]: ...
