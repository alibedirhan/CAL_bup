# -*- coding: utf-8 -*-
"""Validation and filesystem boundaries for discount full exports."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from math import isfinite
from pathlib import Path

from core.cancellation import Checkpoint, run_checkpoint
from core.runtime_support import get_clean_filename
from infrastructure.filesystem import safe_paths
from domain.iskonto import (
    DiscountExportExistsError,
    InvalidDiscountExportDataError,
    InvalidDiscountExportPathError,
)

FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
MAX_DOCUMENTS = 128
MAX_CATEGORIES_PER_DOCUMENT = 128
MAX_PRODUCTS_PER_CATEGORY = 25_000
MAX_PRODUCTS_TOTAL = 100_000
MAX_TEXT_LENGTH = 4_096
MAX_EXCEL_BYTES = 512 * 1024 * 1024
MAX_PDF_BYTES = 256 * 1024 * 1024


def neutralize_formula(value: object) -> object:
    """Keep exported text inert in Excel and LibreOffice."""
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return "'" + value
    return value


def _invalid_data(message: str) -> InvalidDiscountExportDataError:
    return InvalidDiscountExportDataError(message)


def _validate_text(value: object, *, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise _invalid_data(f"{label} geçerli bir metin olmalıdır.")
    if len(value) > MAX_TEXT_LENGTH:
        raise _invalid_data(f"{label} güvenli metin sınırını aşıyor.")
    return value


def _validate_number(value: object, *, label: str) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise _invalid_data(f"{label} sayısal olmalıdır.")
    if not isfinite(float(value)):
        raise _invalid_data(f"{label} sonlu bir sayı olmalıdır.")


def validate_export_payload(
    all_pdf_data: Mapping[str, Mapping[str, object]],
    discount_rates: Mapping[str, float],
    *,
    checkpoint: Checkpoint | None = None,
) -> None:
    """Fail closed on malformed or unbounded full-export payloads."""
    if not isinstance(all_pdf_data, Mapping) or not all_pdf_data:
        raise _invalid_data("Dışa aktarılacak veri bulunamadı.")
    if len(all_pdf_data) > MAX_DOCUMENTS:
        raise _invalid_data(f"PDF sayısı {MAX_DOCUMENTS} sınırını aşıyor.")
    if not isinstance(discount_rates, Mapping):
        raise _invalid_data("İskonto oranları geçersiz.")

    total_products = 0
    for pdf_name, pdf_data in all_pdf_data.items():
        run_checkpoint(checkpoint)
        _validate_text(pdf_name, label="PDF adı")
        if not isinstance(pdf_data, Mapping):
            raise _invalid_data("PDF çıktı verisi geçersiz.")
        categories = pdf_data.get("data")
        if not isinstance(categories, Mapping):
            raise _invalid_data("PDF kategori verisi geçersiz.")
        if len(categories) > MAX_CATEGORIES_PER_DOCUMENT:
            raise _invalid_data(
                f"PDF kategori sayısı {MAX_CATEGORIES_PER_DOCUMENT} sınırını aşıyor."
            )

        for category, products in categories.items():
            run_checkpoint(checkpoint)
            _validate_text(category, label="Kategori adı")
            if category not in discount_rates:
                raise _invalid_data(f"{category} için iskonto oranı bulunamadı.")
            _validate_number(discount_rates[category], label=f"{category} iskonto oranı")
            rate = float(discount_rates[category])
            if not 0 <= rate <= 100:
                raise _invalid_data(f"{category} iskonto oranı 0-100 arasında olmalıdır.")
            if not isinstance(products, Sequence) or isinstance(
                products, (str, bytes, bytearray)
            ):
                raise _invalid_data("Kategori ürün listesi geçersiz.")
            if len(products) > MAX_PRODUCTS_PER_CATEGORY:
                raise _invalid_data(
                    f"Kategori ürün sayısı {MAX_PRODUCTS_PER_CATEGORY} sınırını aşıyor."
                )
            total_products += len(products)
            if total_products > MAX_PRODUCTS_TOTAL:
                raise _invalid_data(
                    f"Toplam ürün sayısı {MAX_PRODUCTS_TOTAL} sınırını aşıyor."
                )
            for product in products:
                run_checkpoint(checkpoint)
                if not isinstance(product, Mapping):
                    raise _invalid_data("Ürün çıktı satırı geçersiz.")
                _validate_text(product.get("name"), label="Ürün adı")
                for key, label in (
                    ("price_without_vat", "KDV hariç iskonto fiyatı"),
                    ("price_with_vat", "KDV dahil iskonto fiyatı"),
                ):
                    if key not in product:
                        raise _invalid_data(f"{label} bulunamadı.")
                    _validate_number(product[key], label=label)
                for key, label in (
                    ("original_price_without_vat", "Orijinal KDV hariç fiyat"),
                    ("original_price_with_vat", "Orijinal KDV dahil fiyat"),
                ):
                    if key in product:
                        _validate_number(product[key], label=label)


# Discount-specific wording over the shared filesystem boundary rules.
_PATH_MESSAGES = {
    "invalid_message": "Dışa aktarma yolu geçersiz.",
    "missing_message": "Dışa aktarma klasörü bulunamadı.",
    "symlink_message": "Sembolik bağlantı üzerinden dışa aktarma desteklenmiyor.",
    "traversal_message": "Üst klasöre geçiş içeren dışa aktarma yolu kullanılamaz.",
}


def _reject_symlink_chain(path: Path) -> None:
    safe_paths.reject_symlink_chain(
        path,
        error=InvalidDiscountExportPathError,
        message=_PATH_MESSAGES["symlink_message"],
    )


def validated_directory(directory: str | Path) -> Path:
    """Resolve an existing, non-symlink user-selected output directory."""
    return safe_paths.validated_directory(
        directory,
        error=InvalidDiscountExportPathError,
        **_PATH_MESSAGES,
    )


def validated_file_destination(
    destination: str | Path,
    *,
    suffix: str,
    overwrite: bool,
) -> Path:
    return safe_paths.validated_file_destination(
        destination,
        suffix=suffix,
        overwrite=overwrite,
        error=InvalidDiscountExportPathError,
        exists_error=DiscountExportExistsError,
        outside_message="Dışa aktarma hedefi seçilen klasörün dışında kalıyor.",
        not_a_file_message="Dışa aktarma hedefi normal bir dosya olmalıdır.",
        exists_message="Hedef dosya zaten var; açık onay olmadan üzerine yazılmadı.",
        **_PATH_MESSAGES,
    )


def planned_pdf_destinations(
    all_pdf_data: Mapping[str, Mapping[str, object]],
    save_dir: str | Path,
    *,
    date_label: str,
    checkpoint: Checkpoint | None = None,
) -> tuple[Path, ...]:
    directory = validated_directory(save_dir)
    destinations: list[Path] = []
    normalized_names: set[str] = set()
    for pdf_name in all_pdf_data:
        run_checkpoint(checkpoint)
        clean_name = get_clean_filename(pdf_name)
        filename = f"{clean_name}_Iskontolu_{date_label}.pdf"
        folded = filename.casefold()
        if folded in normalized_names:
            raise InvalidDiscountExportDataError(
                "Kaynak PDF adları aynı çıktı dosyasına dönüşüyor."
            )
        normalized_names.add(folded)
        target = directory / filename
        _reject_symlink_chain(target)
        if target.exists() and not target.is_file():
            raise InvalidDiscountExportPathError(
                "PDF dışa aktarma hedefi normal bir dosya olmalıdır."
            )
        destinations.append(target)
    return tuple(destinations)
