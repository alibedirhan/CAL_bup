# -*- coding: utf-8 -*-
"""Hardened openpyxl reader for BUP aging (yaşlandırma) workbooks.

Parses an untrusted `.xlsx` into a pure :class:`AgingReport`. Mirrors the
profitability reader's hardening (size cap, magic bytes, zip safety, bounded
sheets/rows/columns/text, fail-closed typed errors) and the legacy column
detection from ``YASLANDIRMA.modules.analysis_base``. `.xls` is retired.
"""

from __future__ import annotations

from pathlib import Path, PurePosixPath
from typing import Any, Iterable
from zipfile import BadZipFile, ZipFile

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet

from core.cancellation import Checkpoint, OperationCancelled, run_checkpoint
from domain.yaslandirma import (
    AgingColumnNotFoundError,
    AgingDataError,
    AgingHeaderNotFoundError,
    AgingReport,
    AgingSourceRow,
    AgingWorkbookEmptyError,
    AgingWorkbookLimitError,
    InvalidAgingWorkbookError,
)

MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 10_000
MAX_SHEET_COUNT = 16
MAX_DATA_ROWS = 200_000
MAX_COLUMNS = 256
MAX_TEXT_LENGTH = 512
HEADER_SEARCH_ROWS = 5
XLSX_MAGIC = b"PK\x03\x04"

# Legacy column-detection vocabulary (YASLANDIRMA/modules/analysis_base.py).
_VEHICLE_EXACT = frozenset(
    {"cari kategori 3", "kategori 3", "araç", "arac", "cari grubu 3"}
)
_AGING_PERIODS = (
    "açık hesap",
    "acik hesap",
    "0-7",
    "8-14",
    "15-21",
    "22-28",
    "29-35",
    "36-42",
    "43-49",
    "50-56",
    "57-63",
    "64-70",
    "71-77",
    "77+",
    "diğer bakiye",
    "diger bakiye",
    "toplam",
    "genel toplam",
)


def _bounded_value(value: Any) -> Any:
    if isinstance(value, str) and len(value) > MAX_TEXT_LENGTH:
        raise AgingWorkbookLimitError(
            f"Excel hücresi {MAX_TEXT_LENGTH} karakter sınırını aşıyor."
        )
    return value


def _lower(value: Any) -> str:
    value = _bounded_value(value)
    return "" if value is None else str(value).strip().lower()


def _as_text(value: Any) -> str | None:
    value = _bounded_value(value)
    if value is None:
        return None
    text = str(value).strip()
    return text if text and text.lower() != "nan" else None


def _is_vehicle_column(name: str) -> bool:
    if name in _VEHICLE_EXACT:
        return True
    if "kategori" in name and "3" in name:
        return True
    if "grup" in name and "3" in name:
        return True
    return "araç" in name or "arac" in name


def _is_cari_column(name: str) -> bool:
    if "cari" in name and ("ünvan" in name or "unvan" in name):
        return True
    if "müşteri" in name or "musteri" in name:
        return True
    if "firma" in name or "şirket" in name or "sirket" in name:
        return True
    return "isim" in name or "ad" in name or "name" in name


def _is_bucket_column(name: str) -> bool:
    if any(period in name for period in _AGING_PERIODS):
        return True
    if "gün" in name or "gun" in name:
        return True
    if "bakiye" in name or "bakiyesi" in name:
        return True
    return "tutar" in name or "meblağ" in name or "meblag" in name


def _validate_path(
    path: str | Path,
    *,
    checkpoint: Checkpoint | None = None,
) -> Path:
    run_checkpoint(checkpoint)
    file_path = Path(path).expanduser()
    if file_path.is_symlink():
        raise InvalidAgingWorkbookError("Sembolik bağlantı Excel girdisi kabul edilmez.")
    if not file_path.exists() or not file_path.is_file():
        raise InvalidAgingWorkbookError("Excel dosyası bulunamadı.")
    if file_path.suffix.lower() != ".xlsx":
        raise InvalidAgingWorkbookError("Yalnız .xlsx Excel dosyaları desteklenir.")
    try:
        size = file_path.stat().st_size
        with file_path.open("rb") as stream:
            magic = stream.read(len(XLSX_MAGIC))
    except OSError as exc:
        raise InvalidAgingWorkbookError("Excel dosyasına erişilemiyor.") from exc
    if size > MAX_FILE_SIZE_BYTES:
        limit_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
        raise AgingWorkbookLimitError(
            f"Excel dosyası izin verilen {limit_mb:.0f} MB sınırını aşıyor."
        )
    if magic != XLSX_MAGIC:
        raise InvalidAgingWorkbookError("Dosya uzantısı .xlsx ancak içerik Excel değil.")
    _validate_xlsx_archive(file_path, checkpoint=checkpoint)
    return file_path


def _validate_xlsx_archive(
    path: Path,
    *,
    checkpoint: Checkpoint | None = None,
) -> None:
    try:
        with ZipFile(path) as archive:
            entries = archive.infolist()
            names = {entry.filename for entry in entries}
            if len(entries) > MAX_ARCHIVE_ENTRIES:
                raise AgingWorkbookLimitError(
                    f"Excel arşivi {MAX_ARCHIVE_ENTRIES} parça sınırını aşıyor."
                )
            expanded_size = 0
            for entry in entries:
                run_checkpoint(checkpoint)
                archive_name = entry.filename.replace("\\", "/")
                parts = PurePosixPath(archive_name).parts
                if entry.flag_bits & 0x1:
                    raise InvalidAgingWorkbookError("Şifreli Excel arşivleri desteklenmez.")
                if archive_name.startswith("/") or ".." in parts:
                    raise InvalidAgingWorkbookError(
                        "Excel arşivi güvenli olmayan dosya yolları içeriyor."
                    )
                expanded_size += entry.file_size
                if expanded_size > MAX_UNCOMPRESSED_BYTES:
                    raise AgingWorkbookLimitError(
                        "Excel arşivinin açılmış boyutu güvenli sınırı aşıyor."
                    )
            required = {"[Content_Types].xml", "xl/workbook.xml"}
            if not required.issubset(names):
                raise InvalidAgingWorkbookError(
                    "Excel arşivinde zorunlu çalışma kitabı parçaları eksik."
                )
    except BadZipFile as exc:
        raise InvalidAgingWorkbookError(
            "Excel dosyası bozuk veya geçerli bir ZIP arşivi değil."
        ) from exc


def _open_first_sheet(
    path: str | Path,
    *,
    checkpoint: Checkpoint | None = None,
):
    file_path = _validate_path(path, checkpoint=checkpoint)
    try:
        workbook = load_workbook(file_path, read_only=True, data_only=True)
    except OperationCancelled:
        raise
    except Exception as exc:
        raise InvalidAgingWorkbookError(
            "Excel dosyası bozuk veya desteklenmeyen bir yapıda."
        ) from exc
    try:
        run_checkpoint(checkpoint)
        if len(workbook.sheetnames) > MAX_SHEET_COUNT:
            raise AgingWorkbookLimitError(
                f"Excel dosyası en fazla {MAX_SHEET_COUNT} çalışma sayfası içerebilir."
            )
        if not workbook.worksheets:
            raise AgingWorkbookEmptyError("Excel dosyasında çalışma sayfası yok.")
        sheet = workbook.worksheets[0]
        if sheet.max_row is None or sheet.max_column is None:
            # Bazı gerçek muhasebe dışa aktarımları sayfa <dimension> meta verisi
            # taşımaz; read_only modda max_row/max_column None döner ve alttaki
            # sınır kontrolü çökerdi. Açılmış boyut yukarıda zaten sınırlandığından
            # gerçek boyutu güvenle zorla hesaplarız (iter_rows sonrasında çalışır).
            sheet.calculate_dimension(force=True)
        if sheet.max_row > MAX_DATA_ROWS + HEADER_SEARCH_ROWS:
            raise AgingWorkbookLimitError(
                f"Excel dosyası {MAX_DATA_ROWS} veri satırı sınırını aşıyor."
            )
        if sheet.max_column > MAX_COLUMNS:
            raise AgingWorkbookLimitError(
                f"Excel dosyası {MAX_COLUMNS} sütun sınırını aşıyor."
            )
        return workbook, sheet
    except (OperationCancelled, AgingDataError):
        workbook.close()
        raise
    except Exception as exc:
        workbook.close()
        raise InvalidAgingWorkbookError(
            "Excel çalışma sayfası bozuk veya okunamıyor."
        ) from exc


def _read_rows(
    sheet: Worksheet,
    *,
    header_row: int,
    checkpoint: Checkpoint | None = None,
) -> Iterable[tuple[Any, ...]]:
    count = 0
    for row in sheet.iter_rows(min_row=header_row + 1, values_only=True):
        run_checkpoint(checkpoint)
        count += 1
        if count > MAX_DATA_ROWS:
            raise AgingWorkbookLimitError(
                f"Excel dosyası {MAX_DATA_ROWS} veri satırı sınırını aşıyor."
            )
        yield tuple(_bounded_value(value) for value in row)


class OpenpyxlAgingWorkbookReader:
    """Read an aging report workbook into a pure :class:`AgingReport`."""

    def read_aging_report(
        self,
        path: str | Path,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> AgingReport:
        workbook, sheet = _open_first_sheet(path, checkpoint=checkpoint)
        try:
            header_row, headers = self._find_header(
                sheet,
                checkpoint=checkpoint,
            )
            vehicle_index = self._find_vehicle_index(headers)
            cari_index = self._find_cari_index(headers, vehicle_index)
            buckets = self._bucket_columns(headers, vehicle_index, cari_index)

            rows: list[AgingSourceRow] = []
            for values in _read_rows(
                sheet,
                header_row=header_row,
                checkpoint=checkpoint,
            ):
                vehicle = _as_text(self._value(values, vehicle_index))
                cari = _as_text(self._value(values, cari_index))
                balances: dict[str, Any] = {}
                for index, name in buckets:
                    run_checkpoint(checkpoint)
                    balances[name] = self._value(values, index)
                if vehicle is None and cari is None and all(
                    value is None for value in balances.values()
                ):
                    continue
                rows.append(
                    AgingSourceRow(
                        vehicle_category=vehicle,
                        cari_unvan=cari,
                        balances=balances,
                    )
                )
            if not rows:
                raise AgingWorkbookEmptyError(
                    "Yaşlandırma raporunda kullanılabilir veri satırı yok."
                )
            bucket_columns = tuple(name for _index, name in buckets)
            return AgingReport(rows=tuple(rows), bucket_columns=bucket_columns)
        except (OperationCancelled, AgingDataError):
            raise
        except Exception as exc:
            raise InvalidAgingWorkbookError(
                "Excel çalışma sayfası bozuk veya okunamıyor."
            ) from exc
        finally:
            workbook.close()

    @staticmethod
    def _header_cells(values: tuple[Any, ...]) -> list[tuple[int, str]]:
        cells: list[tuple[int, str]] = []
        for index, value in enumerate(values):
            if value is None:
                continue
            text = _as_text(value)
            if text is not None:
                cells.append((index, text))
        return cells

    def _find_header(
        self,
        sheet: Worksheet,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> tuple[int, list[tuple[int, str]]]:
        for row_number, values in enumerate(
            sheet.iter_rows(min_row=1, max_row=HEADER_SEARCH_ROWS, values_only=True),
            start=1,
        ):
            run_checkpoint(checkpoint)
            headers = self._header_cells(values)
            if self._is_header_row(headers):
                return row_number, headers
        raise AgingHeaderNotFoundError("Yaşlandırma raporu başlık satırı bulunamadı.")

    @staticmethod
    def _is_header_row(headers: list[tuple[int, str]]) -> bool:
        """A real header row carries its column names in *distinct* cells.

        Some exports open with the report's filter summary in a single merged
        cell whose text mentions both a category and a day range ("Cari Kategori
        3 : 12 Seçili ... Birim Zaman Aralığı : 7 Gün").  That one cell satisfies
        a naive per-row ``any()`` probe for both a vehicle and a bucket column,
        so the scan would stop there and shadow the actual header row below it.
        """

        vehicle = {i for i, name in headers if _is_vehicle_column(_lower(name))}
        cari = {i for i, name in headers if _is_cari_column(_lower(name))}
        buckets = {i for i, name in headers if _is_bucket_column(_lower(name))}
        if not buckets:
            return False
        # The vehicle and cari columns must be their own cells, not the same
        # blob that produced the bucket match.
        return bool(vehicle - buckets) and bool(cari - vehicle)

    @staticmethod
    def _find_vehicle_index(headers: list[tuple[int, str]]) -> int:
        for index, name in headers:
            if _is_vehicle_column(_lower(name)):
                return index
        raise AgingColumnNotFoundError(
            "Yaşlandırma raporunda ARAÇ/kategori sütunu bulunamadı."
        )

    @staticmethod
    def _find_cari_index(headers: list[tuple[int, str]], vehicle_index: int) -> int:
        for index, name in headers:
            if index != vehicle_index and _is_cari_column(_lower(name)):
                return index
        raise AgingColumnNotFoundError(
            "Yaşlandırma raporunda Cari Ünvan/müşteri sütunu bulunamadı."
        )

    @staticmethod
    def _bucket_columns(
        headers: list[tuple[int, str]],
        vehicle_index: int,
        cari_index: int,
    ) -> list[tuple[int, str]]:
        buckets = [
            (index, name)
            for index, name in headers
            if index not in (vehicle_index, cari_index)
            and _is_bucket_column(_lower(name))
        ]
        if not buckets:
            raise AgingColumnNotFoundError(
                "Yaşlandırma raporunda bakiye/gün sütunu bulunamadı."
            )
        return buckets

    @staticmethod
    def _value(values: tuple[Any, ...], index: int | None) -> Any:
        if index is None or index >= len(values):
            return None
        return values[index]
