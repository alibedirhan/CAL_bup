# -*- coding: utf-8 -*-
"""Application DTOs and typed errors for aging (yaşlandırma) analysis."""

from __future__ import annotations

from dataclasses import dataclass

from core.cancellation import Checkpoint, run_checkpoint
from core.visible_export import VisibleTableSnapshot
from domain.yaslandirma import AgingAnalysis, VehicleAging


class AgingApplicationError(Exception):
    """Base error translated into user-facing feedback by the UI."""


class AgingNotAnalyzedError(AgingApplicationError):
    """Raised when a result is requested before an analysis exists."""


@dataclass(frozen=True)
class AgingSummary:
    """UI-independent aggregate of a per-vehicle aging analysis."""

    vehicles: tuple[VehicleAging, ...]
    vehicle_count: int
    total_customers: int
    total_balance: float
    total_open_account: float

    @classmethod
    def from_analysis(
        cls,
        analysis: AgingAnalysis,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> "AgingSummary":
        vehicles = analysis.vehicles
        total_customers = 0
        total_balance = 0.0
        total_open_account = 0.0
        for vehicle in vehicles:
            run_checkpoint(checkpoint)
            total_customers += vehicle.musteri_sayisi
            total_balance += vehicle.toplam_bakiye
            total_open_account += vehicle.acik_hesap
        return cls(
            vehicles=vehicles,
            vehicle_count=len(vehicles),
            total_customers=total_customers,
            total_balance=total_balance,
            total_open_account=total_open_account,
        )


def build_aging_visible_snapshot(
    vehicles: tuple[VehicleAging, ...],
    *,
    checkpoint: Checkpoint | None = None,
) -> VisibleTableSnapshot:
    rows: list[tuple[object, ...]] = []
    total_customers = 0
    total_balance = 0.0
    total_open_account = 0.0
    for vehicle in vehicles:
        run_checkpoint(checkpoint)
        rows.append(
            (
                vehicle.arac_no,
                vehicle.musteri_sayisi,
                vehicle.toplam_bakiye,
                vehicle.acik_hesap,
            )
        )
        total_customers += vehicle.musteri_sayisi
        total_balance += vehicle.toplam_bakiye
        total_open_account += vehicle.acik_hesap
    return VisibleTableSnapshot(
        title="Yaşlandırma Analizi — Görünen Araçlar",
        headers=("Araç No", "Müşteri Sayısı", "Toplam Bakiye", "Açık Hesap"),
        rows=tuple(rows),
        metadata=(
            ("Kapsam", "Ekranda görünen araçlar"),
            ("Sıralama", "Ekrandaki sıra"),
            ("Araç Sayısı", len(vehicles)),
            ("Müşteri Sayısı", total_customers),
            ("Toplam Bakiye", total_balance),
            ("Açık Hesap", total_open_account),
        ),
    )
