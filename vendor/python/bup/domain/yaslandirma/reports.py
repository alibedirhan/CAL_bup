# -*- coding: utf-8 -*-
"""Pure aging report/detail analytics.

Derived analytics over an aging analysis (per-vehicle detail, cross-vehicle
ranking, overall bucket totals) that back the ARAÇ Detay, Raporlar and Grafikler
tabs. Pure — no pandas, UI or I/O — and it does NOT change the golden-locked
aging math in ``analysis.py`` / ``buckets.py``; it only summarizes its output.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from .buckets import bucket_sort_key
from .models import VehicleAging


@dataclass(frozen=True)
class CustomerBalance:
    cari_unvan: str
    toplam_bakiye: float


@dataclass(frozen=True)
class VehicleDetail:
    """Per-vehicle drill-down metrics derived from its customer balances."""

    arac_no: str
    musteri_sayisi: int
    toplam_bakiye: float
    acik_hesap: float
    ortalama_bakiye: float
    max_bakiye: float
    min_bakiye: float
    top_customers: tuple[CustomerBalance, ...]


def vehicle_detail(vehicle: VehicleAging, *, top: int = 10) -> VehicleDetail:
    """Compute min/max/average balance and the top customers for one vehicle."""
    balances = [customer.toplam_bakiye for customer in vehicle.musteri_detaylari]
    count = len(balances)
    average = (sum(balances) / count) if count else 0.0
    ranked = sorted(
        vehicle.musteri_detaylari, key=lambda c: c.toplam_bakiye, reverse=True
    )[:top]
    return VehicleDetail(
        arac_no=vehicle.arac_no,
        musteri_sayisi=vehicle.musteri_sayisi,
        toplam_bakiye=vehicle.toplam_bakiye,
        acik_hesap=vehicle.acik_hesap,
        ortalama_bakiye=average,
        max_bakiye=max(balances) if balances else 0.0,
        min_bakiye=min(balances) if balances else 0.0,
        top_customers=tuple(
            CustomerBalance(c.cari_unvan, c.toplam_bakiye) for c in ranked
        ),
    )


def vehicle_details(vehicles: Sequence[VehicleAging]) -> tuple[VehicleDetail, ...]:
    """Per-vehicle detail for every vehicle, preserving input order."""
    return tuple(vehicle_detail(vehicle) for vehicle in vehicles)


def balance_ranking(vehicles: Sequence[VehicleAging]) -> tuple[VehicleDetail, ...]:
    """Vehicles ranked by total balance, highest first (comparison report)."""
    return tuple(
        sorted(vehicle_details(vehicles), key=lambda d: d.toplam_bakiye, reverse=True)
    )


def bucket_totals(vehicles: Sequence[VehicleAging]) -> tuple[tuple[str, float], ...]:
    """Overall balance per aging bucket across all vehicles, bucket-ordered."""
    totals: dict[str, float] = {}
    for vehicle in vehicles:
        for bucket, amount in vehicle.yaslanding_analizi.items():
            totals[bucket] = totals.get(bucket, 0.0) + amount
    return tuple(sorted(totals.items(), key=lambda pair: bucket_sort_key(pair[0])))
