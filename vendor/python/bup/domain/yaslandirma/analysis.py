# -*- coding: utf-8 -*-
"""Pure per-vehicle aging analysis independent from pandas, files and UI.

Reproduces the locked legacy ``AnalysisEngine.analyze_all_aracs`` aging math
(per-vehicle balance totals, open-account totals, bucket breakdown and customer
details). Statistics are intentionally out of scope here, matching the legacy
reference golden which excludes ``istatistikler``.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence

from .buckets import bucket_sort_key, categorize_bucket, is_open_account_column
from .models import AgingAnalysis, AgingSourceRow, CustomerAging, VehicleAging
from .numbers import parse_turkish_number
from .vehicles import extract_vehicle_numbers, row_matches_vehicle


def analyze_aging(
    rows: Sequence[AgingSourceRow],
    bucket_columns: Sequence[str],
    *,
    checkpoint: Callable[[], None] | None = None,
) -> AgingAnalysis:
    """Aggregate aging balances per vehicle from pure source rows."""
    sorted_columns = sorted(bucket_columns, key=bucket_sort_key)
    indexed_rows = list(enumerate(rows))
    vehicle_numbers = extract_vehicle_numbers(
        (row.vehicle_category for row in rows),
        checkpoint=checkpoint,
    )

    vehicles: list[VehicleAging] = []
    for vehicle_no in vehicle_numbers:
        if checkpoint is not None:
            checkpoint()
        members: list[tuple[int, AgingSourceRow]] = []
        for index, row in indexed_rows:
            if checkpoint is not None:
                checkpoint()
            if row_matches_vehicle(row.vehicle_category, vehicle_no):
                members.append((index, row))
        if not members:
            continue

        toplam_bakiye = 0.0
        acik_hesap = 0.0
        yaslanding: dict[str, float] = {}
        customers: list[CustomerAging] = []

        for index, row in members:
            if checkpoint is not None:
                checkpoint()
            unvan = row.cari_unvan if row.cari_unvan is not None else f"Müşteri_{index}"
            detay: dict[str, float] = {}
            customer_total = 0.0

            for column in sorted_columns:
                if checkpoint is not None:
                    checkpoint()
                raw_value = row.balances.get(column)
                value = parse_turkish_number(raw_value) if raw_value is not None else 0.0
                category = categorize_bucket(column)
                detay[category] = value
                yaslanding[category] = yaslanding.get(category, 0.0) + value
                if is_open_account_column(column):
                    acik_hesap += value
                customer_total += value

            customers.append(
                CustomerAging(
                    cari_unvan=str(unvan),
                    toplam_bakiye=customer_total,
                    bakiye_detay=detay,
                )
            )
            toplam_bakiye += customer_total

        vehicles.append(
            VehicleAging(
                arac_no=str(vehicle_no),
                musteri_sayisi=len(members),
                toplam_bakiye=toplam_bakiye,
                acik_hesap=acik_hesap,
                yaslanding_analizi=yaslanding,
                musteri_detaylari=tuple(customers),
            )
        )

    if checkpoint is not None:
        checkpoint()
    return AgingAnalysis(vehicles=tuple(vehicles))
