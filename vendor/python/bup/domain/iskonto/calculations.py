# -*- coding: utf-8 -*-
"""Pure iskonto calculations and category mapping.

This module is deliberately UI-free. It protects the current BUP Yönetim
iskonto behaviour while golden tests are being introduced against the
standalone BUP-Iskonto-Hesabi reference.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Mapping, Sequence

CATEGORY_BUTUN = "Bütün Piliç Ürünleri"
CATEGORY_KANAT = "Kanat Ürünleri"
CATEGORY_BUT = "But Ürünleri"
CATEGORY_GOGUS = "Göğüs Ürünleri"
CATEGORY_SAKATAT = "Sakatat Ürünleri"
CATEGORY_YAN = "Yan Ürünler"

CATEGORY_NAMES: tuple[str, ...] = (
    CATEGORY_BUTUN,
    CATEGORY_KANAT,
    CATEGORY_BUT,
    CATEGORY_GOGUS,
    CATEGORY_SAKATAT,
    CATEGORY_YAN,
)

TABLE_CATEGORY_MAP: dict[int, str] = {
    0: CATEGORY_BUTUN,
    1: CATEGORY_BUTUN,
    2: CATEGORY_KANAT,
    3: CATEGORY_KANAT,
    4: CATEGORY_BUT,
    5: CATEGORY_BUT,
    6: CATEGORY_GOGUS,
    7: CATEGORY_GOGUS,
    8: CATEGORY_SAKATAT,
    9: CATEGORY_SAKATAT,
    10: CATEGORY_YAN,
    11: CATEGORY_YAN,
}

CATEGORY_PREFIXES: dict[str, tuple[str, ...]] = {
    CATEGORY_BUTUN: ("DBTN", "BTN", "BPD", "BP", "TPD", "TP"),
    CATEGORY_KANAT: ("DKNT", "KNT", "KND", "DKN", "KN"),
    CATEGORY_BUT: ("DBUT", "BUT", "BTD", "DBT", "BT", "PLK", "PLO"),
    CATEGORY_GOGUS: ("DGGS", "GGS", "GSD", "DGS", "GS", "BFE", "STK"),
    CATEGORY_SAKATAT: ("DSAK", "SAK", "SKD", "SK", "CG", "YRK", "TLK"),
    CATEGORY_YAN: ("DYAN", "YAN", "YN", "SOS", "MRN", "MARN"),
}


@dataclass(frozen=True)
class IskontoProduct:
    name: str
    price_without_vat: float
    price_with_vat: float
    code: str | None = None
    category: str | None = None


def empty_category_bucket() -> dict[str, list[dict]]:
    """Return an empty mutable product bucket with stable category order."""
    return {category: [] for category in CATEGORY_NAMES}


def determine_category_by_code(product_code: str) -> str | None:
    """Map current product-code prefixes to BUP Yönetim categories."""
    code_upper = str(product_code or "").upper().strip()
    if not code_upper:
        return None

    for category, prefixes in CATEGORY_PREFIXES.items():
        if code_upper.startswith(prefixes):
            return category
    return None


def determine_category_by_table(table_number: int) -> str | None:
    """Map PDF table position to category."""
    return TABLE_CATEGORY_MAP.get(table_number)


def calculate_discounted_price(
    price_without_vat: float,
    discount_rate: float,
    vat_rate: float = 1.0,
) -> tuple[float, float]:
    """Apply discount to VAT-excluded price and recalculate VAT-included price."""
    discount_multiplier = 1 - (float(discount_rate) / 100)
    discounted_without_vat = round(float(price_without_vat) * discount_multiplier, 2)
    vat_multiplier = 1 + (float(vat_rate) / 100)
    discounted_with_vat = round(discounted_without_vat * vat_multiplier, 2)
    return discounted_without_vat, discounted_with_vat


def apply_discounts_to_categories(
    categories: Mapping[str, Sequence[Mapping]],
    discount_rates: Mapping[str, float],
    vat_rate: float = 1.0,
    *,
    checkpoint: Callable[[], None] | None = None,
) -> dict[str, list[dict]]:
    """Apply category discounts to product dictionaries.

    Output keys intentionally match the price-list reader's apply_discounts
    schema to avoid breaking UI/export code.
    """
    discounted_data: dict[str, list[dict]] = {}

    for category, products in categories.items():
        if checkpoint is not None:
            checkpoint()
        if not products:
            continue

        discount_rate = float(discount_rates.get(category, 0.0))
        discounted_products: list[dict] = []

        for product in products:
            if checkpoint is not None:
                checkpoint()
            discounted_without_vat, discounted_with_vat = calculate_discounted_price(
                float(product["price_without_vat"]),
                discount_rate,
                vat_rate=vat_rate,
            )
            discounted_products.append(
                {
                    "name": product["name"],
                    "price_without_vat": discounted_without_vat,
                    "price_with_vat": discounted_with_vat,
                    "original_price_without_vat": product["price_without_vat"],
                    "original_price_with_vat": product["price_with_vat"],
                }
            )

        if discounted_products:
            discounted_data[category] = discounted_products

    return discounted_data
