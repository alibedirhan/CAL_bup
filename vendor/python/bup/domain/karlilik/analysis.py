# -*- coding: utf-8 -*-
"""Pure profitability analysis independent from pandas, files, and UI."""

from __future__ import annotations

import math
from collections.abc import Callable
from collections.abc import Mapping

from .models import (
    NumericValue,
    PriceSourceRow,
    ProfitabilityAnalysis,
    ProfitabilityResultRow,
    ProfitabilitySourceRow,
)

_PRICE_HEADER_TERMS = ("BÖLGE", "MERKEZ", "DEPO", "ŞUBE")


def clean_numeric_value(value: NumericValue) -> float:
    """Convert the locale-formatted numeric values accepted by the legacy flow."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return 0.0

    cleaned = value.replace("₺", "").replace("TL", "").strip()
    if not cleaned or cleaned.lower() == "nan":
        return 0.0
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def create_price_map(
    rows: tuple[PriceSourceRow, ...],
    *,
    checkpoint: Callable[[], None] | None = None,
) -> dict[str, float]:
    """Preserve the legacy report rule: blank stock/date rows use depot as stock."""
    prices: dict[str, float] = {}
    for row in rows:
        if checkpoint is not None:
            checkpoint()
        stock_blank = not row.stock_name or row.stock_name.strip().lower() == "nan"
        date_blank = not row.date or row.date.strip().lower() == "nan"
        depot = (row.depot or "").strip()
        price = clean_numeric_value(row.price)
        if (
            stock_blank
            and date_blank
            and depot
            and depot.lower() != "nan"
            and not any(term in depot.upper() for term in _PRICE_HEADER_TERMS)
            and price > 0
        ):
            prices.setdefault(depot, round(price, 2))
    return prices


def analyze_profitability(
    price_rows: tuple[PriceSourceRow, ...],
    profitability_rows: tuple[ProfitabilitySourceRow, ...],
    *,
    approved_aliases: Mapping[str, str] | None = None,
    checkpoint: Callable[[], None] | None = None,
) -> ProfitabilityAnalysis:
    """Match unit costs and calculate the stable BUP profitability result."""
    prices = create_price_map(price_rows, checkpoint=checkpoint)
    aliases = {
        str(alias).strip().upper(): str(target).strip().upper()
        for alias, target in (approved_aliases or {}).items()
        if str(alias).strip() and str(target).strip()
    }
    results: list[ProfitabilityResultRow] = []
    unmatched: list[str] = []
    applied_aliases: list[tuple[str, str]] = []
    matched_count = 0

    for source in profitability_rows:
        if checkpoint is not None:
            checkpoint()
        stock_name = source.stock_name.strip().upper()
        matched_name = stock_name
        if stock_name not in prices:
            candidate = aliases.get(stock_name)
            if candidate in prices:
                matched_name = candidate
                applied_aliases.append((stock_name, candidate))
        unit_cost = prices.get(matched_name, 0.0)
        if matched_name in prices:
            matched_count += 1
        else:
            unmatched.append(stock_name)

        quantity = clean_numeric_value(source.sales_quantity)
        average_price = clean_numeric_value(source.average_sales_price)
        sales_amount = clean_numeric_value(source.sales_amount)
        unit_profit = average_price - unit_cost
        results.append(
            ProfitabilityResultRow(
                stock_name=stock_name,
                sales_quantity=quantity,
                average_sales_price=average_price,
                sales_amount=sales_amount,
                unit_cost=unit_cost,
                unit_profit=unit_profit,
                net_profit=unit_profit * quantity,
            )
        )

    if checkpoint is not None:
        checkpoint()
    results.sort(key=lambda row: (row.net_profit, row.unit_profit), reverse=True)
    if checkpoint is not None:
        checkpoint()
    return ProfitabilityAnalysis(
        rows=tuple(results),
        matched_count=matched_count,
        unmatched=tuple(unmatched),
        applied_aliases=tuple(applied_aliases),
    )
