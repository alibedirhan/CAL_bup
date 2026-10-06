# -*- coding: utf-8 -*-
"""Use cases for vehicle-to-personnel assignments."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from core.versioned_json_store import StoreRecoveryError
from domain.yaslandirma import VehicleAssignment

from .ports import VehicleAssignmentRepository

Clock = Callable[[], datetime]
_REPOSITORY_ERRORS = (OSError, ValueError, StoreRecoveryError)


class VehicleAssignmentServiceError(RuntimeError):
    """Base error exposed by vehicle-assignment use cases."""


class InvalidVehicleAssignmentError(VehicleAssignmentServiceError):
    """Raised when the required assignment fields are empty."""


class VehicleAssignmentService:
    """Coordinate assignment persistence behind an application boundary."""

    def __init__(
        self,
        repository: VehicleAssignmentRepository,
        *,
        clock: Clock = datetime.now,
    ) -> None:
        self._repository = repository
        self._clock = clock

    def list_assignments(self) -> tuple[VehicleAssignment, ...]:
        try:
            assignments = self._repository.assignments().values()
        except _REPOSITORY_ERRORS as exc:
            raise VehicleAssignmentServiceError("Atamalar yüklenemedi.") from exc
        return tuple(sorted(assignments, key=lambda item: item.arac_no))

    def assign(
        self,
        *,
        arac_no: str,
        sorumlu: str,
        email: str = "",
        telefon: str = "",
        departman: str = "",
        notlar: str = "",
    ) -> VehicleAssignment:
        normalized_vehicle = arac_no.strip()
        normalized_owner = sorumlu.strip()
        if not normalized_vehicle or not normalized_owner:
            raise InvalidVehicleAssignmentError(
                "Araç no ve sorumlu zorunludur."
            )
        assignment = VehicleAssignment(
            arac_no=normalized_vehicle,
            sorumlu=normalized_owner,
            email=email.strip(),
            telefon=telefon.strip(),
            departman=departman.strip(),
            notlar=notlar.strip(),
            atama_tarihi=self._clock().strftime("%d.%m.%Y %H:%M"),
        )
        try:
            self._repository.assign(assignment)
        except _REPOSITORY_ERRORS as exc:
            raise VehicleAssignmentServiceError("Atama kaydedilemedi.") from exc
        return assignment

    def remove(self, arac_no: str) -> None:
        try:
            self._repository.remove(arac_no)
        except _REPOSITORY_ERRORS as exc:
            raise VehicleAssignmentServiceError("Atama kaldırılamadı.") from exc

    def workload(self) -> dict[str, int]:
        distribution: dict[str, int] = {}
        for assignment in self.list_assignments():
            distribution[assignment.sorumlu] = (
                distribution.get(assignment.sorumlu, 0) + 1
            )
        return distribution

    def can_restore_last_change(self) -> bool:
        try:
            return self._repository.has_backup()
        except _REPOSITORY_ERRORS as exc:
            raise VehicleAssignmentServiceError(
                "Atama yedeği denetlenemedi."
            ) from exc

    def restore_last_change(self) -> bool:
        try:
            return self._repository.restore_from_backup()
        except _REPOSITORY_ERRORS as exc:
            raise VehicleAssignmentServiceError(
                "Son atama değişikliği geri alınamadı."
            ) from exc
