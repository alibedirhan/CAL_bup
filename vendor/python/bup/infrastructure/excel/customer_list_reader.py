# -*- coding: utf-8 -*-
"""Read BUP customer-list Excel files into a pure CustomerSheet.

Header detection, column finding, and customer extraction reproduce the legacy
``Musteri_Sayisi_Kontrolu`` behaviour exactly (locked by the golden fixture).
Untrusted-file hardening (existence, extension, size cap) is added per the
security standard. No UI toolkit and no dialogs live here.
"""

from __future__ import annotations

from pathlib import Path, PurePosixPath
from typing import Any
from zipfile import BadZipFile, ZipFile

import pandas as pd
from openpyxl import load_workbook

from core.cancellation import Checkpoint, OperationCancelled, run_checkpoint
from domain.musteri_takip.models import (
    CariColumnNotFoundError,
    CustomerDataError,
    CustomerSheet,
    HeaderNotFoundError,
    InvalidCustomerFileError,
)
from domain.musteri_takip.naming import extract_depo_name

MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 10_000
MAX_SHEET_COUNT = 16
MAX_DATA_ROWS = 200_000
MAX_COLUMNS = 256
MAX_TEXT_LENGTH = 512
SUPPORTED_EXTENSIONS = {".xlsx"}
_HEADER_SEARCH_ROWS = 15
XLSX_MAGIC = b"PK\x03\x04"


def find_header_row(df: pd.DataFrame) -> int:
    """Return the row index whose cells contain ``Cari Ünvan``, else ``-1``."""
    try:
        df_str = df.astype(str)
        mask = df_str.apply(
            lambda row: row.str.contains("Cari Ünvan", case=False, na=False).any(),
            axis=1,
        )
        if mask.any():
            return int(mask.idxmax())
        return -1
    except Exception:
        for i, row in df.iterrows():
            for value in row.values:
                if isinstance(value, str) and "Cari Ünvan" in value:
                    return int(i)
        return -1


def find_cari_unvan_column(columns) -> str | None:
    """Return the ``Cari Ünvan`` column name, else ``None``."""
    for col in columns:
        if isinstance(col, str) and "Cari Ünvan" in col:
            return col
    return None


def extract_cari_unvan_list(df: pd.DataFrame, cari_unvan_col: str) -> list[str]:
    """Return cleaned, non-empty customer titles from the column."""
    cari_unvan_list = (
        df[cari_unvan_col]
        .dropna()
        .apply(lambda x: x.strip() if isinstance(x, str) else str(x).strip())
        .tolist()
    )
    return [x for x in cari_unvan_list if x and x.strip()]


class CustomerListReader:
    """Parse a customer workbook into a CustomerSheet, hardened for untrusted input."""

    @staticmethod
    def _bounded(value: Any) -> Any:
        if isinstance(value, str) and len(value) > MAX_TEXT_LENGTH:
            raise InvalidCustomerFileError(
                f"Excel hücresi {MAX_TEXT_LENGTH} karakter sınırını aşıyor."
            )
        return value

    def _validate(
        self,
        path: Path,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        run_checkpoint(checkpoint)
        path = path.expanduser()
        if path.is_symlink():
            raise InvalidCustomerFileError(
                "Sembolik bağlantı Excel girdisi kabul edilmez."
            )
        if not path.exists() or not path.is_file():
            raise InvalidCustomerFileError("Dosya bulunamadı!")
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise InvalidCustomerFileError("Yalnız .xlsx Excel dosyaları desteklenir.")
        try:
            size = path.stat().st_size
            with path.open("rb") as stream:
                magic = stream.read(len(XLSX_MAGIC))
        except OSError as exc:
            raise InvalidCustomerFileError("Excel dosyasına erişilemiyor.") from exc
        if size > MAX_FILE_SIZE_BYTES:
            limit_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
            raise InvalidCustomerFileError(
                f"Excel dosyası izin verilen {limit_mb:.0f} MB sınırını aşıyor."
            )
        if magic != XLSX_MAGIC:
            raise InvalidCustomerFileError(
                "Dosya uzantısı .xlsx ancak içerik Excel değil."
            )
        self._validate_archive(path, checkpoint=checkpoint)
        return path

    @staticmethod
    def _validate_archive(
        path: Path,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> None:
        try:
            with ZipFile(path) as archive:
                entries = archive.infolist()
                names = {entry.filename for entry in entries}
                if len(entries) > MAX_ARCHIVE_ENTRIES:
                    raise InvalidCustomerFileError(
                        f"Excel arşivi {MAX_ARCHIVE_ENTRIES} parça sınırını aşıyor."
                    )
                expanded_size = 0
                for entry in entries:
                    run_checkpoint(checkpoint)
                    archive_name = entry.filename.replace("\\", "/")
                    parts = PurePosixPath(archive_name).parts
                    if entry.flag_bits & 0x1:
                        raise InvalidCustomerFileError(
                            "Şifreli Excel arşivleri desteklenmez."
                        )
                    if archive_name.startswith("/") or ".." in parts:
                        raise InvalidCustomerFileError(
                            "Excel arşivi güvenli olmayan dosya yolları içeriyor."
                        )
                    expanded_size += entry.file_size
                    if expanded_size > MAX_UNCOMPRESSED_BYTES:
                        raise InvalidCustomerFileError(
                            "Excel arşivinin açılmış boyutu güvenli sınırı aşıyor."
                        )
                required = {"[Content_Types].xml", "xl/workbook.xml"}
                if not required.issubset(names):
                    raise InvalidCustomerFileError(
                        "Excel arşivinde zorunlu çalışma kitabı parçaları eksik."
                    )
        except BadZipFile as exc:
            raise InvalidCustomerFileError(
                "Excel dosyası bozuk veya geçerli bir ZIP arşivi değil."
            ) from exc

    def read(
        self,
        path: str | Path,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> CustomerSheet:
        file_path = self._validate(Path(path), checkpoint=checkpoint)
        try:
            workbook = load_workbook(file_path, read_only=True, data_only=True)
        except PermissionError as exc:
            raise InvalidCustomerFileError("Dosyaya erişim izni yok!") from exc
        except OperationCancelled:
            raise
        except Exception as exc:
            raise InvalidCustomerFileError(
                "Excel dosyası bozuk veya desteklenmeyen bir yapıda."
            ) from exc

        try:
            run_checkpoint(checkpoint)
        except BaseException:
            workbook.close()
            raise

        try:
            if len(workbook.sheetnames) > MAX_SHEET_COUNT:
                raise InvalidCustomerFileError(
                    f"Excel dosyası en fazla {MAX_SHEET_COUNT} çalışma sayfası içerebilir."
                )
            if not workbook.worksheets:
                raise InvalidCustomerFileError("Excel dosyasında çalışma sayfası yok.")
            sheet = workbook.worksheets[0]
            if sheet.max_row is None or sheet.max_column is None:
                sheet.calculate_dimension(force=True)
            if sheet.max_row > MAX_DATA_ROWS + _HEADER_SEARCH_ROWS:
                raise InvalidCustomerFileError(
                    f"Excel dosyası {MAX_DATA_ROWS} veri satırı sınırını aşıyor."
                )
            if sheet.max_column > MAX_COLUMNS:
                raise InvalidCustomerFileError(
                    f"Excel dosyası {MAX_COLUMNS} sütun sınırını aşıyor."
                )

            header_rows: list[tuple[Any, ...]] = []
            for values in sheet.iter_rows(
                min_row=1,
                max_row=_HEADER_SEARCH_ROWS,
                values_only=True,
            ):
                run_checkpoint(checkpoint)
                header_rows.append(
                    tuple(self._bounded(value) for value in values)
                )
            first_column = [values[0] if values else None for values in header_rows[:10]]
            depo_name = extract_depo_name(first_column)

            needle = "Cari Ünvan".casefold()
            header_number = -1
            for index, values in enumerate(header_rows, start=1):
                run_checkpoint(checkpoint)
                if any(
                    isinstance(value, str) and needle in value.casefold()
                    for value in values
                ):
                    header_number = index
                    break
            if header_number == -1:
                raise HeaderNotFoundError(
                    "Excel dosyasında 'Cari Ünvan' başlığı bulunamadı!"
                )

            headers = tuple(
                value.strip() if isinstance(value, str) else value
                for value in header_rows[header_number - 1]
            )
            cari_col = find_cari_unvan_column(headers)
            if not cari_col:
                raise CariColumnNotFoundError(
                    "Excel dosyasında 'Cari Ünvan' sütunu bulunamadı."
                )
            cari_index = headers.index(cari_col)

            customers: list[str] = []
            row_count = 0
            for values in sheet.iter_rows(min_row=header_number + 1, values_only=True):
                run_checkpoint(checkpoint)
                row_count += 1
                if row_count > MAX_DATA_ROWS:
                    raise InvalidCustomerFileError(
                        f"Excel dosyası {MAX_DATA_ROWS} veri satırı sınırını aşıyor."
                    )
                value = values[cari_index] if cari_index < len(values) else None
                value = self._bounded(value)
                if value is None:
                    continue
                text = value.strip() if isinstance(value, str) else str(value).strip()
                if text:
                    customers.append(text)

            return CustomerSheet(
                depo_name=depo_name,
                header_row=header_number - 1,
                customers=tuple(customers),
            )
        except (OperationCancelled, CustomerDataError):
            raise
        except Exception as exc:
            raise InvalidCustomerFileError(
                "Excel çalışma sayfası bozuk veya okunamıyor."
            ) from exc
        finally:
            workbook.close()
