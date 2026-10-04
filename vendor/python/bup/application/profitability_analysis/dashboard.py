# -*- coding: utf-8 -*-
"""Application-facing profitability dashboard queries.

Qt panels consume this module instead of reaching into the domain package.
The calculations remain pure domain behavior; this module is the stable
application boundary for presentation consumers.
"""

from domain.karlilik import (
    CATEGORY_ALL,
    CATEGORY_COK_KARLI,
    CATEGORY_DUSUK_KARLI,
    CATEGORY_LABELS,
    CATEGORY_ORTA_KARLI,
    CATEGORY_ZARARDA,
    DashboardStatistics,
    ProductEntry,
    ProfitDistribution,
    dashboard_statistics,
    products_in_category,
    profit_distribution,
    profit_loss_split,
    top_products_by_profit,
)

__all__ = [
    "CATEGORY_ALL",
    "CATEGORY_COK_KARLI",
    "CATEGORY_DUSUK_KARLI",
    "CATEGORY_LABELS",
    "CATEGORY_ORTA_KARLI",
    "CATEGORY_ZARARDA",
    "DashboardStatistics",
    "ProductEntry",
    "ProfitDistribution",
    "dashboard_statistics",
    "products_in_category",
    "profit_distribution",
    "profit_loss_split",
    "top_products_by_profit",
]
