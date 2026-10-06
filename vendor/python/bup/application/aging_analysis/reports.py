# -*- coding: utf-8 -*-
"""Application-facing aging report queries.

Presentation code consumes these query contracts while the pure calculations
remain owned by the aging domain.
"""

from domain.yaslandirma import (
    CustomerBalance,
    VehicleDetail,
    balance_ranking,
    bucket_sort_key,
    bucket_totals,
    vehicle_detail,
    vehicle_details,
)

__all__ = [
    "CustomerBalance",
    "VehicleDetail",
    "balance_ranking",
    "bucket_sort_key",
    "bucket_totals",
    "vehicle_detail",
    "vehicle_details",
]
