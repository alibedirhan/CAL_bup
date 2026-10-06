# -*- coding: utf-8 -*-
"""Atomic openpyxl exporter for aging (yaşlandırma) analysis results."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, Side

from core.cancellation import Checkpoint, run_checkpoint
from domain.yaslandirma import (
    AgingAnalysis,
    AgingExportExistsError,
    AgingExportWriteError,
    InvalidAgingExportPathError,
    bucket_sort_key,
)
from infrastructure.export.atomic_publish import publish_staged_file

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
_VEHICLE_HEADERS = ("Araç No", "Müşteri Sayısı", "Toplam Bakiye", "Açık Hesap")
_BUCKET_HEADERS = ("Vade Kovası", "Toplam Bakiye")


def neutralize_formula(value: object) -> object:
    """Keep exported text inert in Excel and LibreOffice."""
    if not isinstance(value, str):
        return value
    if value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def _reject_symlink_chain(path: Path) -> None:
    current = path
    while True:
        if current.is_symlink():
            raise InvalidAgingExportPathError(
                "Sembolik bağlantı üzerinden dışa aktarma desteklenmiyor."
            )
        if current == current.parent:
            return
        current = current.parent


def _validated_destination(destination: str | Path, *, overwrite: bool) -> Path:
    requested = Path(destination).expanduser()
    if ".." in requested.parts:
        raise InvalidAgingExportPathError(
            "Üst klasöre geçiş içeren dışa aktarma yolu kullanılamaz."
        )
    if requested.suffix.lower() != ".xlsx":
        requested = requested.with_suffix(".xlsx")

    absolute = Path(os.path.abspath(requested))
    _reject_symlink_chain(absolute)
    parent = absolute.parent
    if not parent.exists() or not parent.is_dir():
        raise InvalidAgingExportPathError("Dışa aktarma klasörü bulunamadı.")
    if absolute.exists():
        if absolute.is_symlink():
            raise InvalidAgingExportPathError("Sembolik bağlantı hedefi kullanılamaz.")
        if not absolute.is_file():
            raise InvalidAgingExportPathError(
                "Dışa aktarma hedefi normal bir dosya olmalıdır."
            )
        if not overwrite:
            raise AgingExportExistsError(
                "Hedef dosya zaten var; üzerine yazma onayı olmadan işlem reddedildi."
            )

    resolved_parent = parent.resolve(strict=True)
    resolved_destination = (resolved_parent / absolute.name).resolve(strict=False)
    if resolved_destination.parent != resolved_parent:
        raise InvalidAgingExportPathError(
            "Dışa aktarma hedefi seçilen klasörün dışında kalıyor."
        )
    return resolved_destination


def _bucket_totals(
    analysis: AgingAnalysis,
    *,
    checkpoint: Checkpoint | None = None,
) -> tuple[tuple[str, float], ...]:
    totals: dict[str, float] = {}
    for vehicle in analysis.vehicles:
        run_checkpoint(checkpoint)
        for category, amount in vehicle.yaslanding_analizi.items():
            run_checkpoint(checkpoint)
            totals[category] = totals.get(category, 0.0) + amount
    return tuple(sorted(totals.items(), key=lambda pair: bucket_sort_key(pair[0])))


def _style_header(worksheet, column_count: int) -> None:
    thin = Side(style="thin", color="000000")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    for cell in worksheet[1][:column_count]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border


def _build_workbook(
    analysis: AgingAnalysis,
    *,
    checkpoint: Checkpoint | None = None,
) -> Workbook:
    workbook = Workbook()
    try:
        vehicle_sheet = workbook.active
        vehicle_sheet.title = "Araç Özeti"
        vehicle_sheet.append(_VEHICLE_HEADERS)
        for vehicle in analysis.vehicles:
            run_checkpoint(checkpoint)
            vehicle_sheet.append(
                (
                    neutralize_formula(vehicle.arac_no),
                    vehicle.musteri_sayisi,
                    vehicle.toplam_bakiye,
                    vehicle.acik_hesap,
                )
            )

        bucket_sheet = workbook.create_sheet("Yaşlandırma Kovaları")
        bucket_sheet.append(_BUCKET_HEADERS)
        for category, amount in _bucket_totals(
            analysis,
            checkpoint=checkpoint,
        ):
            run_checkpoint(checkpoint)
            bucket_sheet.append((neutralize_formula(category), amount))

        _style_header(vehicle_sheet, len(_VEHICLE_HEADERS))
        _style_header(bucket_sheet, len(_BUCKET_HEADERS))
        return workbook
    except BaseException:
        workbook.close()
        raise


class OpenpyxlAgingExporter:
    """Write the two-sheet aging summary workbook to an explicit path."""

    def export(
        self,
        analysis: AgingAnalysis,
        destination: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        run_checkpoint(checkpoint)
        path = _validated_destination(destination, overwrite=overwrite)
        descriptor, temporary_name = tempfile.mkstemp(
            dir=path.parent,
            prefix=".aging-",
            suffix=".xlsx",
        )
        os.close(descriptor)
        temporary_path = Path(temporary_name)
        workbook: Workbook | None = None
        try:
            workbook = _build_workbook(analysis, checkpoint=checkpoint)
            workbook.save(temporary_path)
            with temporary_path.open("rb+") as stream:
                os.fsync(stream.fileno())
            try:
                temporary_path.chmod(0o600)
            except OSError:
                pass
            run_checkpoint(checkpoint)
            publish_staged_file(temporary_path, path, overwrite=overwrite)
        except FileExistsError as exc:
            raise AgingExportExistsError(
                "Hedef dosya işlem sırasında oluştu; üzerine yazılmadı."
            ) from exc
        except (OSError, ValueError) as exc:
            raise AgingExportWriteError(
                "Yaşlandırma Excel dosyası atomik olarak yazılamadı."
            ) from exc
        finally:
            if workbook is not None:
                workbook.close()
            temporary_path.unlink(missing_ok=True)
        return path
