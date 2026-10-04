# -*- coding: utf-8 -*-
"""Discount calculator use cases shared by desktop UI implementations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, Mapping

from core.cancellation import Checkpoint, run_checkpoint
from ..visible_export import (
    VisibleExportNotConfiguredError,
    VisibleTableExporter,
    validate_visible_selection,
)

from .dto import (
    CategoryData,
    DiscountPreview,
    DiscountStatistics,
    DiscountVisibleRowRef,
    ExportData,
    LoadPriceListsResult,
    LoadedPriceList,
    build_discount_visible_snapshot,
    discount_visible_row_refs,
)
from .ports import DiscountExporter, PriceListReader, PriceListReaderFactory


class DiscountApplicationError(Exception):
    """Base error that can be translated into UI feedback."""


class NoPriceListsLoadedError(DiscountApplicationError):
    """Raised when preview is requested before loading a price list."""


class DiscountRateValidationError(DiscountApplicationError):
    """Raised when a category discount is outside the supported range."""


class NoPreviewDataError(DiscountApplicationError):
    """Raised when preview or export data is unavailable."""


@dataclass
class _PriceListRecord:
    document: LoadedPriceList
    reader: PriceListReader


class DiscountCalculatorFacade:
    """Own PDF, preview and export orchestration without UI toolkit state."""

    def __init__(
        self,
        reader_factory: PriceListReaderFactory,
        exporter: DiscountExporter,
        visible_exporter: VisibleTableExporter | None = None,
    ) -> None:
        self._reader_factory = reader_factory
        self._exporter = exporter
        self._visible_exporter = visible_exporter
        self._records: list[_PriceListRecord] = []
        self._preview: DiscountPreview | None = None

    @property
    def loaded_documents(self) -> tuple[LoadedPriceList, ...]:
        return tuple(record.document for record in self._records)

    @property
    def preview(self) -> DiscountPreview | None:
        return self._preview

    @property
    def default_excel_dir(self) -> Path:
        return self._exporter.exports_dir / "excel"

    @property
    def default_pdf_dir(self) -> Path:
        return self._exporter.exports_dir / "pdf"

    def determine_pdf_type(
        self,
        file_path: str | Path,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> str:
        reader = self._reader_factory()
        if checkpoint is None:
            return reader.determine_pdf_type(str(file_path))
        return reader.determine_pdf_type(
            str(file_path),
            checkpoint=checkpoint,
        )

    def load_price_lists(
        self,
        file_paths: Iterable[str | Path],
        *,
        checkpoint: Checkpoint | None = None,
    ) -> LoadPriceListsResult:
        paths = tuple(Path(file_path) for file_path in file_paths)
        loaded: list[LoadedPriceList] = []
        failed: list[Path] = []
        pending_records: list[_PriceListRecord] = []

        for path in paths:
            run_checkpoint(checkpoint)
            reader = self._reader_factory()
            if checkpoint is None:
                pdf_type = reader.determine_pdf_type(str(path))
                extracted = reader.extract_data_from_pdf(str(path), pdf_type)
            else:
                pdf_type = reader.determine_pdf_type(
                    str(path),
                    checkpoint=checkpoint,
                )
                run_checkpoint(checkpoint)
                extracted = reader.extract_data_from_pdf(
                    str(path),
                    pdf_type,
                    checkpoint=checkpoint,
                )
            if not extracted:
                failed.append(path)
                continue

            run_checkpoint(checkpoint)
            document = LoadedPriceList(
                path=path,
                name=path.name,
                pdf_type=pdf_type,
                product_count=reader.get_product_count(),
            )
            pending_records.append(_PriceListRecord(document=document, reader=reader))
            loaded.append(document)

        run_checkpoint(checkpoint)
        self._records.extend(pending_records)
        self._preview = None
        return LoadPriceListsResult(
            loaded=tuple(loaded),
            failed_paths=tuple(failed),
            total_count=len(paths),
        )

    def clear(self) -> None:
        self._records.clear()
        self._preview = None

    def category_counts(
        self,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> dict[str, int]:
        counts: dict[str, int] = {}
        for record in self._records:
            run_checkpoint(checkpoint)
            for category, products in record.reader.categories.items():
                run_checkpoint(checkpoint)
                counts[category] = counts.get(category, 0) + len(products)
        return counts

    def create_preview(
        self,
        discount_rates: Mapping[str, float],
        *,
        generated_at: datetime | None = None,
        checkpoint: Checkpoint | None = None,
    ) -> DiscountPreview:
        if not self._records:
            raise NoPriceListsLoadedError("Önce PDF dosyaları yükleyin!")

        rates = self._validate_rates(discount_rates, checkpoint=checkpoint)
        all_data: ExportData = {}
        for record in self._records:
            run_checkpoint(checkpoint)
            if checkpoint is None:
                discounted = record.reader.apply_discounts(rates)
            else:
                discounted = record.reader.apply_discounts(
                    rates,
                    checkpoint=checkpoint,
                )
            if discounted:
                all_data[record.document.name] = {
                    "data": discounted,
                    "type": record.document.pdf_type,
                    "path": str(record.document.path),
                }

        if not all_data:
            raise NoPreviewDataError("İşlenecek veri bulunamadı!")

        statistics = self._calculate_statistics(
            all_data,
            rates,
            checkpoint=checkpoint,
        )
        preview = DiscountPreview(
            data=all_data,
            discount_rates=rates,
            statistics=statistics,
            text=self._build_preview_text(
                all_data,
                rates,
                generated_at or datetime.now(),
                checkpoint=checkpoint,
            ),
        )
        run_checkpoint(checkpoint)
        self._preview = preview
        return preview

    def export_excel(
        self,
        file_path: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        preview = self._require_preview()
        run_checkpoint(checkpoint)
        if checkpoint is None:
            return self._exporter.export_to_excel_multi(
                preview.data,
                preview.discount_rates,
                file_path,
                overwrite=overwrite,
            )
        return self._exporter.export_to_excel_multi(
            preview.data,
            preview.discount_rates,
            file_path,
            overwrite=overwrite,
            checkpoint=checkpoint,
        )

    def pdf_export_collisions(self, save_dir: str | Path) -> tuple[Path, ...]:
        preview = self._require_preview()
        return self._exporter.existing_pdf_outputs(preview.data, save_dir)

    def export_pdfs(
        self,
        save_dir: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> list[Path]:
        preview = self._require_preview()
        run_checkpoint(checkpoint)
        if checkpoint is None:
            return self._exporter.export_to_pdf_multi(
                preview.data,
                preview.discount_rates,
                save_dir,
                overwrite=overwrite,
            )
        return self._exporter.export_to_pdf_multi(
            preview.data,
            preview.discount_rates,
            save_dir,
            overwrite=overwrite,
            checkpoint=checkpoint,
        )

    def export_bundle(
        self,
        excel_path: str | Path,
        pdf_dir: str | Path,
        *,
        excel_overwrite: bool = False,
        pdf_overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> list[Path]:
        """Export the full Excel+PDF set behind one staged commit boundary."""

        preview = self._require_preview()
        run_checkpoint(checkpoint)
        if checkpoint is None:
            return self._exporter.export_bundle(
                preview.data,
                preview.discount_rates,
                excel_path,
                pdf_dir,
                excel_overwrite=excel_overwrite,
                pdf_overwrite=pdf_overwrite,
            )
        return self._exporter.export_bundle(
            preview.data,
            preview.discount_rates,
            excel_path,
            pdf_dir,
            excel_overwrite=excel_overwrite,
            pdf_overwrite=pdf_overwrite,
            checkpoint=checkpoint,
        )

    def export_visible(
        self,
        row_refs: Iterable[DiscountVisibleRowRef],
        destination: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        preview = self._require_preview()
        if self._visible_exporter is None:
            raise VisibleExportNotConfiguredError(
                "Görünür satır dışa aktarma yapılandırılmadı."
            )
        selected = validate_visible_selection(
            row_refs,
            discount_visible_row_refs(preview, checkpoint=checkpoint),
            checkpoint=checkpoint,
        )
        snapshot = build_discount_visible_snapshot(
            preview,
            selected,
            checkpoint=checkpoint,
        )
        if checkpoint is None:
            return self._visible_exporter.export(
                snapshot,
                destination,
                overwrite=overwrite,
            )
        return self._visible_exporter.export(
            snapshot,
            destination,
            overwrite=overwrite,
            checkpoint=checkpoint,
        )

    def _require_preview(self) -> DiscountPreview:
        if self._preview is None:
            raise NoPreviewDataError("Önce önizleme yapın!")
        return self._preview

    @staticmethod
    def _validate_rates(
        discount_rates: Mapping[str, float],
        *,
        checkpoint: Checkpoint | None = None,
    ) -> dict[str, float]:
        rates: dict[str, float] = {}
        for category, value in discount_rates.items():
            run_checkpoint(checkpoint)
            rate = float(value)
            if rate < 0 or rate > 100:
                raise DiscountRateValidationError(
                    f"{category} için iskonto 0-100 arasında olmalı!"
                )
            rates[category] = rate
        return rates

    @staticmethod
    def _calculate_statistics(
        all_data: ExportData,
        discount_rates: Mapping[str, float],
        *,
        checkpoint: Checkpoint | None = None,
    ) -> DiscountStatistics:
        product_count = 0
        categories: set[str] = set()
        rates: list[float] = []
        total_discount = 0.0

        for pdf_data in all_data.values():
            run_checkpoint(checkpoint)
            category_data = pdf_data["data"]
            for category, products in category_data.items():
                run_checkpoint(checkpoint)
                if not products:
                    continue
                categories.add(category)
                product_count += len(products)
                rate = discount_rates.get(category, 0.0)
                if rate not in rates:
                    rates.append(rate)
                for product in products:
                    run_checkpoint(checkpoint)
                    total_discount += (
                        float(product.get("original_price_with_vat", 0))
                        - float(product["price_with_vat"])
                    )

        return DiscountStatistics(
            pdf_count=len(all_data),
            product_count=product_count,
            category_count=len(categories),
            average_discount=sum(rates) / len(rates) if rates else 0.0,
            total_discount=total_discount,
        )

    @staticmethod
    def _build_preview_text(
        all_data: ExportData,
        discount_rates: Mapping[str, float],
        generated_at: datetime,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> str:
        lines = [
            "BUPİLİÇ İSKONTOLU FİYAT LİSTELERİ",
            "=" * 100,
            f"Tarih: {generated_at.strftime('%d.%m.%Y %H:%M')}",
            f"PDF Sayısı: {len(all_data)}",
            "",
        ]
        grand_total_products = 0
        grand_total_discount = 0.0

        for pdf_index, (pdf_name, pdf_data) in enumerate(all_data.items(), 1):
            run_checkpoint(checkpoint)
            lines.extend(["", "#" * 100, f"PDF {pdf_index}: {pdf_name}", "#" * 100, ""])
            pdf_total = 0
            pdf_discount = 0.0
            category_data: CategoryData = pdf_data["data"]

            for category, products in category_data.items():
                run_checkpoint(checkpoint)
                if not products:
                    continue
                rate = discount_rates.get(category, 0.0)
                lines.extend(
                    [
                        "=" * 100,
                        f"{category.upper()} - %{rate:.1f} İSKONTO ({len(products)} ÜRÜN)",
                        "=" * 100,
                        f"{'ÜRÜN ADI':<50} {'ORJ.':>12} {'İSK.':>12} {'FARK':>12}",
                        "-" * 100,
                    ]
                )
                category_discount = 0.0
                for product in products[:10]:
                    run_checkpoint(checkpoint)
                    product_name = str(product["name"])
                    name = product_name[:47] + "..." if len(product_name) > 47 else product_name
                    original = float(product.get("original_price_with_vat", 0))
                    discounted = float(product["price_with_vat"])
                    difference = original - discounted
                    category_discount += difference
                    lines.append(
                        f"{name:<50} {original:>12.2f} "
                        f"{discounted:>12.2f} {difference:>12.2f}"
                    )
                if len(products) > 10:
                    lines.append(f"... ve {len(products) - 10} ürün daha")
                lines.extend(["", f"Kategori İskonto: {category_discount:.2f} TL", ""])
                pdf_total += len(products)
                pdf_discount += category_discount

            lines.extend(
                [
                    "─" * 100,
                    f"PDF ÖZET: Ürün: {pdf_total} | İskonto: {pdf_discount:.2f} TL",
                ]
            )
            grand_total_products += pdf_total
            grand_total_discount += pdf_discount

        lines.extend(
            [
                "",
                "=" * 100,
                "GENEL ÖZET",
                "=" * 100,
                f"Toplam PDF: {len(all_data)}",
                f"Toplam Ürün: {grand_total_products}",
                f"Toplam İskonto: {grand_total_discount:.2f} TL",
            ]
        )
        return "\n".join(lines) + "\n"
