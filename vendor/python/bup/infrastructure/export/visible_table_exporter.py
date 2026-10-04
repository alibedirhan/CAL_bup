# -*- coding: utf-8 -*-
"""Hardened atomic Excel adapter for exact visible table snapshots."""

from __future__ import annotations

import os
import tempfile
from math import isfinite
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, Side

from core.cancellation import Checkpoint, OperationCancelled, run_checkpoint
from core.visible_export import (
    InvalidVisibleExportDataError,
    InvalidVisibleExportPathError,
    VisibleExportError,
    VisibleExportExistsError,
    VisibleExportWriteError,
    VisibleTableSnapshot,
)

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
_MAX_ROWS = 50_000
_MAX_COLUMNS = 32
_MAX_TEXT_LENGTH = 4_096


def neutralize_formula(value: object) -> object:
    """Keep exported text inert in Excel and LibreOffice."""

    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def _reject_symlink_chain(path: Path) -> None:
    current = path
    while True:
        if current.is_symlink():
            raise InvalidVisibleExportPathError(
                "Sembolik bağlantı üzerinden dışa aktarma desteklenmiyor."
            )
        if current == current.parent:
            return
        current = current.parent


def _validated_destination(destination: str | Path, *, overwrite: bool) -> Path:
    try:
        requested = Path(destination).expanduser()
    except (OSError, TypeError, ValueError) as exc:
        raise InvalidVisibleExportPathError(
            "Dışa aktarma yolu geçersiz."
        ) from exc
    if ".." in requested.parts:
        raise InvalidVisibleExportPathError(
            "Üst klasöre geçiş içeren dışa aktarma yolu kullanılamaz."
        )
    if requested.suffix.lower() != ".xlsx":
        requested = requested.with_suffix(".xlsx")

    try:
        absolute = Path(os.path.abspath(requested))
        _reject_symlink_chain(absolute)
        parent = absolute.parent
        if not parent.exists() or not parent.is_dir():
            raise InvalidVisibleExportPathError(
                "Dışa aktarma klasörü bulunamadı."
            )
        if absolute.exists():
            if absolute.is_symlink() or not absolute.is_file():
                raise InvalidVisibleExportPathError(
                    "Dışa aktarma hedefi normal bir dosya olmalıdır."
                )
            if not overwrite:
                raise VisibleExportExistsError(
                    "Hedef dosya zaten var; açık onay olmadan üzerine yazılmadı."
                )
        resolved_parent = parent.resolve(strict=True)
        resolved = (resolved_parent / absolute.name).resolve(strict=False)
    except VisibleExportError:
        raise
    except (OSError, RuntimeError, ValueError) as exc:
        raise InvalidVisibleExportPathError(
            "Dışa aktarma yolu güvenli biçimde doğrulanamadı."
        ) from exc
    if resolved.parent != resolved_parent:
        raise InvalidVisibleExportPathError(
            "Dışa aktarma hedefi seçilen klasörün dışında kalıyor."
        )
    return resolved


def _validate_text(value: str) -> None:
    if len(value) > _MAX_TEXT_LENGTH:
        raise InvalidVisibleExportDataError(
            "Görünür Excel verisindeki bir metin izin verilen sınırı aşıyor."
        )


def _validate_snapshot(
    snapshot: VisibleTableSnapshot,
    *,
    checkpoint: Checkpoint | None = None,
) -> None:
    run_checkpoint(checkpoint)
    if not isinstance(snapshot, VisibleTableSnapshot):
        raise InvalidVisibleExportDataError("Görünür Excel verisi geçersiz.")
    if not isinstance(snapshot.title, str) or not snapshot.title.strip():
        raise InvalidVisibleExportDataError("Görünür Excel rapor başlığı geçersiz.")
    if not isinstance(snapshot.headers, tuple) or not isinstance(snapshot.rows, tuple):
        raise InvalidVisibleExportDataError("Görünür Excel tablo yapısı geçersiz.")
    if not isinstance(snapshot.metadata, tuple):
        raise InvalidVisibleExportDataError("Görünür Excel kapsam yapısı geçersiz.")
    if not snapshot.rows:
        raise InvalidVisibleExportDataError("Dışa aktarılacak görünür satır yok.")
    if not 0 < len(snapshot.headers) <= _MAX_COLUMNS:
        raise InvalidVisibleExportDataError("Görünür Excel sütun sayısı geçersiz.")
    if len(snapshot.rows) > _MAX_ROWS:
        raise InvalidVisibleExportDataError("Görünür Excel satır sınırı aşıldı.")
    if any(not isinstance(header, str) or not header.strip() for header in snapshot.headers):
        raise InvalidVisibleExportDataError("Görünür Excel sütun başlığı geçersiz.")
    for value in (snapshot.title, *snapshot.headers):
        run_checkpoint(checkpoint)
        _validate_text(value)
    for entry in snapshot.metadata:
        run_checkpoint(checkpoint)
        if not isinstance(entry, tuple) or len(entry) != 2:
            raise InvalidVisibleExportDataError(
                "Görünür Excel kapsam satırı geçersiz."
            )
        key, value = entry
        if not isinstance(key, str) or not key.strip():
            raise InvalidVisibleExportDataError("Görünür Excel kapsam bilgisi geçersiz.")
        _validate_text(key)
        if isinstance(value, str):
            _validate_text(value)
        elif value is not None and (
            isinstance(value, bool) or not isinstance(value, (int, float))
        ):
            raise InvalidVisibleExportDataError(
                "Görünür Excel kapsam bilgisi yalnız metin ve sayısal değerleri destekler."
            )
        elif isinstance(value, float) and not isfinite(value):
            raise InvalidVisibleExportDataError(
                "Görünür Excel sonlu olmayan sayısal değer içeriyor."
            )
    for row in snapshot.rows:
        run_checkpoint(checkpoint)
        if not isinstance(row, tuple):
            raise InvalidVisibleExportDataError(
                "Görünür Excel satır yapısı geçersiz."
            )
        if len(row) != len(snapshot.headers):
            raise InvalidVisibleExportDataError(
                "Görünür Excel satırı başlıklarla aynı sütun sayısında değil."
            )
        for value in row:
            run_checkpoint(checkpoint)
            if isinstance(value, str):
                _validate_text(value)
            elif value is not None and (
                isinstance(value, bool) or not isinstance(value, (int, float))
            ):
                raise InvalidVisibleExportDataError(
                    "Görünür Excel yalnız metin ve sayısal hücreleri destekler."
                )
            elif isinstance(value, float) and not isfinite(value):
                raise InvalidVisibleExportDataError(
                    "Görünür Excel sonlu olmayan sayısal değer içeriyor."
                )


def _style_header(worksheet, column_count: int) -> None:
    thin = Side(style="thin")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    for cell in worksheet[1][:column_count]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border


def _build_workbook(
    snapshot: VisibleTableSnapshot,
    *,
    checkpoint: Checkpoint | None = None,
) -> Workbook:
    workbook = Workbook()
    try:
        data_sheet = workbook.active
        data_sheet.title = "Görünen Satırlar"
        data_sheet.append(tuple(neutralize_formula(value) for value in snapshot.headers))
        for row in snapshot.rows:
            run_checkpoint(checkpoint)
            data_sheet.append(tuple(neutralize_formula(value) for value in row))

        info_sheet = workbook.create_sheet("Kapsam")
        info_sheet.append(("Bilgi", "Değer"))
        info_sheet.append(("Rapor", neutralize_formula(snapshot.title)))
        for key, value in snapshot.metadata:
            run_checkpoint(checkpoint)
            info_sheet.append((neutralize_formula(key), neutralize_formula(value)))

        _style_header(data_sheet, len(snapshot.headers))
        _style_header(info_sheet, 2)
        return workbook
    except BaseException:
        workbook.close()
        raise


class OpenpyxlVisibleTableExporter:
    """Write a bounded two-sheet snapshot without changing full export schemas."""

    def export(
        self,
        snapshot: VisibleTableSnapshot,
        destination: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        _validate_snapshot(snapshot, checkpoint=checkpoint)
        path = _validated_destination(destination, overwrite=overwrite)
        try:
            descriptor, temporary_name = tempfile.mkstemp(
                dir=path.parent,
                prefix=".visible-export-",
                suffix=".xlsx",
            )
            os.close(descriptor)
        except OSError as exc:
            raise VisibleExportWriteError(
                "Görünür satır Excel dosyası için geçici dosya oluşturulamadı."
            ) from exc
        temporary_path = Path(temporary_name)
        workbook: Workbook | None = None
        try:
            workbook = _build_workbook(snapshot, checkpoint=checkpoint)
            workbook.save(temporary_path)
            with temporary_path.open("rb+") as stream:
                os.fsync(stream.fileno())
            try:
                temporary_path.chmod(0o600)
            except OSError:
                pass
            run_checkpoint(checkpoint)
            if overwrite:
                os.replace(temporary_path, path)
            else:
                try:
                    os.link(temporary_path, path)
                except FileExistsError as exc:
                    raise VisibleExportExistsError(
                        "Hedef dosya işlem sırasında oluştu; üzerine yazılmadı."
                    ) from exc
        except (VisibleExportError, OperationCancelled):
            raise
        except Exception as exc:
            raise VisibleExportWriteError(
                "Görünür satır Excel dosyası atomik olarak yazılamadı."
            ) from exc
        finally:
            if workbook is not None:
                workbook.close()
            temporary_path.unlink(missing_ok=True)
        return path
