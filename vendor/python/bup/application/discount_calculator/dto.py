# -*- coding: utf-8 -*-
"""UI-independent data contracts for discount calculator use cases."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, cast

from core.cancellation import Checkpoint, run_checkpoint
from core.visible_export import VisibleTableSnapshot

ProductData = dict[str, object]
CategoryData = dict[str, list[ProductData]]
ExportData = dict[str, dict[str, object]]


@dataclass(frozen=True)
class LoadedPriceList:
    path: Path
    name: str
    pdf_type: str
    product_count: int


@dataclass(frozen=True)
class LoadPriceListsResult:
    loaded: tuple[LoadedPriceList, ...]
    failed_paths: tuple[Path, ...]
    total_count: int

    @property
    def success_count(self) -> int:
        return len(self.loaded)


@dataclass(frozen=True)
class DiscountStatistics:
    pdf_count: int
    product_count: int
    category_count: int
    average_discount: float
    total_discount: float


@dataclass(frozen=True)
class DiscountPreview:
    data: ExportData
    discount_rates: Mapping[str, float]
    statistics: DiscountStatistics
    text: str


@dataclass(frozen=True)
class DiscountVisibleRowRef:
    source: str
    category: str
    product_index: int


def discount_visible_row_refs(
    preview: DiscountPreview,
    *,
    checkpoint: Checkpoint | None = None,
) -> tuple[DiscountVisibleRowRef, ...]:
    refs: list[DiscountVisibleRowRef] = []
    for source, pdf_data in preview.data.items():
        run_checkpoint(checkpoint)
        category_data = cast("CategoryData", pdf_data["data"])
        for category, products in category_data.items():
            run_checkpoint(checkpoint)
            for index in range(len(products)):
                run_checkpoint(checkpoint)
                refs.append(DiscountVisibleRowRef(source, category, index))
    return tuple(refs)


def build_discount_visible_snapshot(
    preview: DiscountPreview,
    refs: tuple[DiscountVisibleRowRef, ...],
    *,
    checkpoint: Checkpoint | None = None,
) -> VisibleTableSnapshot:
    rows: list[tuple[str | float, ...]] = []
    sources: set[str] = set()
    categories: set[str] = set()
    total_difference = 0.0
    for ref in refs:
        run_checkpoint(checkpoint)
        pdf_data = preview.data[ref.source]
        category_data = cast("CategoryData", pdf_data["data"])
        product = category_data[ref.category][ref.product_index]
        original = float(product.get("original_price_with_vat", 0))
        discounted = float(product["price_with_vat"])
        difference = original - discounted
        rows.append(
            (
                ref.source,
                ref.category,
                str(product["name"]),
                original,
                discounted,
                difference,
            )
        )
        sources.add(ref.source)
        categories.add(ref.category)
        total_difference += difference
    return VisibleTableSnapshot(
        title="İskonto Hesaplama — Görünen Satırlar",
        headers=("Kaynak", "Kategori", "Ürün", "Orijinal", "İskontolu", "Fark"),
        rows=tuple(rows),
        metadata=(
            ("Kapsam", "Ekranda görünen satırlar"),
            ("Sıralama", "Ekrandaki sıra"),
            ("Satır Sayısı", len(rows)),
            ("Kaynak Sayısı", len(sources)),
            ("Kategori Sayısı", len(categories)),
            ("Toplam Fark", total_difference),
        ),
    )
