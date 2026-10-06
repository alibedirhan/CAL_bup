# -*- coding: utf-8 -*-
"""Pure aging (yaşlandırma) domain: models, analysis and parsing helpers."""

from __future__ import annotations

from .analysis import analyze_aging
from .assignments import VehicleAssignment
from .buckets import bucket_sort_key, categorize_bucket, is_open_account_column
from .models import (
    AgingAnalysis,
    AgingColumnNotFoundError,
    AgingDataError,
    AgingExportError,
    AgingExportExistsError,
    AgingExportWriteError,
    AgingHeaderNotFoundError,
    AgingReport,
    AgingSourceRow,
    AgingWorkbookEmptyError,
    AgingWorkbookLimitError,
    CustomerAging,
    InvalidAgingExportPathError,
    InvalidAgingWorkbookError,
    VehicleAging,
)
from .numbers import parse_turkish_number
from .reports import (
    CustomerBalance,
    VehicleDetail,
    balance_ranking,
    bucket_totals,
    vehicle_detail,
    vehicle_details,
)
from .vehicles import extract_vehicle_numbers, row_matches_vehicle

__all__ = [
    "analyze_aging",
    "CustomerBalance",
    "VehicleDetail",
    "balance_ranking",
    "bucket_totals",
    "vehicle_detail",
    "vehicle_details",
    "AgingAnalysis",
    "AgingColumnNotFoundError",
    "AgingDataError",
    "AgingExportError",
    "AgingExportExistsError",
    "AgingExportWriteError",
    "AgingHeaderNotFoundError",
    "AgingReport",
    "AgingSourceRow",
    "AgingWorkbookEmptyError",
    "AgingWorkbookLimitError",
    "CustomerAging",
    "InvalidAgingExportPathError",
    "InvalidAgingWorkbookError",
    "VehicleAging",
    "VehicleAssignment",
    "bucket_sort_key",
    "categorize_bucket",
    "is_open_account_column",
    "parse_turkish_number",
    "extract_vehicle_numbers",
    "row_matches_vehicle",
]
