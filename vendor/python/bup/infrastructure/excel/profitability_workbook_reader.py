# -*- coding: utf-8 -*-
"""Hardened openpyxl reader for BUP profitability workbooks."""

from __future__ import annotations

from pathlib import Path, PurePosixPath
from typing import Any, Iterable
from zipfile import BadZipFile, ZipFile

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet

from core.cancellation import Checkpoint, OperationCancelled, run_checkpoint
from domain.karlilik import (
    InvalidProfitabilityWorkbookError,
    PriceSourceRow,
    ProfitabilityColumnNotFoundError,
    ProfitabilityDataError,
    ProfitabilityHeaderNotFoundError,
    ProfitabilitySourceRow,
    ProfitabilityWorkbookEmptyError,
    ProfitabilityWorkbookLimitError,
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


def _normalize(value: Any) -> str:
    value = _bounded_value(value)
    text = "" if value is None else str(value).lower().strip()
    replacements = {
        "ı": "i",
        "i̇": "i",
        "ş": "s",
        "ç": "c",
        "ğ": "g",
        "ü": "u",
        "ö": "o",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return " ".join(text.split())


def _bounded_value(value: Any) -> Any:
    if isinstance(value, str) and len(value) > MAX_TEXT_LENGTH:
        raise ProfitabilityWorkbookLimitError(
            f"Excel hücresi {MAX_TEXT_LENGTH} karakter sınırını aşıyor."
        )
    return value


def _as_text(value: Any) -> str | None:
    value = _bounded_value(value)
    if value is None:
        return None
    text = str(value).strip()
    return text if text and text.lower() != "nan" else None


def _validate_path(
    path: str | Path,
    *,
    checkpoint: Checkpoint | None = None,
) -> Path:
    run_checkpoint(checkpoint)
    file_path = Path(path).expanduser()
    if file_path.is_symlink():
        raise InvalidProfitabilityWorkbookError(
            "Sembolik bağlantı Excel girdisi kabul edilmez."
        )
    if not file_path.exists() or not file_path.is_file():
        raise InvalidProfitabilityWorkbookError("Excel dosyası bulunamadı.")
    if file_path.suffix.lower() != ".xlsx":
        raise InvalidProfitabilityWorkbookError("Yalnız .xlsx Excel dosyaları desteklenir.")
    try:
        size = file_path.stat().st_size
        with file_path.open("rb") as stream:
            magic = stream.read(len(XLSX_MAGIC))
    except OSError as exc:
        raise InvalidProfitabilityWorkbookError("Excel dosyasına erişilemiyor.") from exc
    if size > MAX_FILE_SIZE_BYTES:
        limit_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
        raise ProfitabilityWorkbookLimitError(
            f"Excel dosyası izin verilen {limit_mb:.0f} MB sınırını aşıyor."
        )
    if magic != XLSX_MAGIC:
        raise InvalidProfitabilityWorkbookError("Dosya uzantısı .xlsx ancak içerik Excel değil.")
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
                raise ProfitabilityWorkbookLimitError(
                    f"Excel arşivi {MAX_ARCHIVE_ENTRIES} parça sınırını aşıyor."
                )
            expanded_size = 0
            for entry in entries:
                run_checkpoint(checkpoint)
                archive_name = entry.filename.replace("\\", "/")
                parts = PurePosixPath(archive_name).parts
                if entry.flag_bits & 0x1:
                    raise InvalidProfitabilityWorkbookError(
                        "Şifreli Excel arşivleri desteklenmez."
                    )
                if archive_name.startswith("/") or ".." in parts:
                    raise InvalidProfitabilityWorkbookError(
                        "Excel arşivi güvenli olmayan dosya yolları içeriyor."
                    )
                expanded_size += entry.file_size
                if expanded_size > MAX_UNCOMPRESSED_BYTES:
                    raise ProfitabilityWorkbookLimitError(
                        "Excel arşivinin açılmış boyutu güvenli sınırı aşıyor."
                    )
            required = {"[Content_Types].xml", "xl/workbook.xml"}
            if not required.issubset(names):
                raise InvalidProfitabilityWorkbookError(
                    "Excel arşivinde zorunlu çalışma kitabı parçaları eksik."
                )
    except BadZipFile as exc:
        raise InvalidProfitabilityWorkbookError(
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
        raise InvalidProfitabilityWorkbookError(
            "Excel dosyası bozuk veya desteklenmeyen bir yapıda."
        ) from exc
    try:
        run_checkpoint(checkpoint)
        if len(workbook.sheetnames) > MAX_SHEET_COUNT:
            raise ProfitabilityWorkbookLimitError(
                f"Excel dosyası en fazla {MAX_SHEET_COUNT} çalışma sayfası içerebilir."
            )
        if not workbook.worksheets:
            raise ProfitabilityWorkbookEmptyError(
                "Excel dosyasında çalışma sayfası yok."
            )
        sheet = workbook.worksheets[0]
        if sheet.max_row is None or sheet.max_column is None:
            # Bazı gerçek muhasebe dışa aktarımları sayfa <dimension> meta verisi
            # taşımaz; read_only modda max_row/max_column None döner ve alttaki
            # sınır kontrolü çökerdi. Açılmış boyut yukarıda zaten sınırlandığından
            # gerçek boyutu güvenle zorla hesaplarız (iter_rows sonrasında çalışır).
            sheet.calculate_dimension(force=True)
        if sheet.max_row > MAX_DATA_ROWS + HEADER_SEARCH_ROWS:
            raise ProfitabilityWorkbookLimitError(
                f"Excel dosyası {MAX_DATA_ROWS} veri satırı sınırını aşıyor."
            )
        if sheet.max_column > MAX_COLUMNS:
            raise ProfitabilityWorkbookLimitError(
                f"Excel dosyası {MAX_COLUMNS} sütun sınırını aşıyor."
            )
        return workbook, sheet
    except (OperationCancelled, ProfitabilityDataError):
        workbook.close()
        raise
    except Exception as exc:
        workbook.close()
        raise InvalidProfitabilityWorkbookError(
            "Excel çalışma sayfası bozuk veya okunamıyor."
        ) from exc


def _header_candidates(
    sheet: Worksheet,
    *,
    checkpoint: Checkpoint | None = None,
) -> Iterable[tuple[int, tuple[Any, ...]]]:
    for item in enumerate(
        sheet.iter_rows(min_row=1, max_row=HEADER_SEARCH_ROWS, values_only=True),
        start=1,
    ):
        run_checkpoint(checkpoint)
        yield item


def _column_map(values: tuple[Any, ...]) -> dict[str, int]:
    return {_normalize(value): index for index, value in enumerate(values) if value is not None}


def _find_column(
    columns: dict[str, int],
    predicate,
) -> int | None:
    for name, index in columns.items():
        if predicate(name):
            return index
    return None


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
            raise ProfitabilityWorkbookLimitError(
                f"Excel dosyası {MAX_DATA_ROWS} veri satırı sınırını aşıyor."
            )
        yield tuple(_bounded_value(value) for value in row)


class OpenpyxlProfitabilityWorkbookReader:
    """Read price and profitability reports into pure domain rows."""

    def read_price_report(
        self,
        path: str | Path,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> tuple[PriceSourceRow, ...]:
        workbook, sheet = _open_first_sheet(path, checkpoint=checkpoint)
        try:
            header_row, columns = self._find_price_header(
                sheet,
                checkpoint=checkpoint,
            )
            stock_index = self._required_price_column(
                columns,
                lambda name: "stok" in name and ("isim" in name or "ismi" in name),
                "Stok İsmi",
            )
            price_index = self._required_price_column(
                columns,
                lambda name: "fiyat" in name and "liste" not in name,
                "Fiyat",
            )
            depot_index = self._required_price_column(
                columns,
                lambda name: name == "depo" or name.endswith(" depo"),
                "Depo",
            )
            date_index = _find_column(columns, lambda name: "tarih" in name)

            rows: list[PriceSourceRow] = []
            for values in _read_rows(
                sheet,
                header_row=header_row,
                checkpoint=checkpoint,
            ):
                stock_name = _as_text(self._value(values, stock_index))
                date = _as_text(self._value(values, date_index))
                depot = _as_text(self._value(values, depot_index))
                price = self._value(values, price_index)
                if stock_name is None and date is None and depot is None and price is None:
                    continue
                rows.append(PriceSourceRow(stock_name, date, depot, price))
            if not rows:
                raise ProfitabilityWorkbookEmptyError(
                    "Fiyat raporunda kullanılabilir veri satırı yok."
                )
            return tuple(rows)
        except (OperationCancelled, ProfitabilityDataError):
            raise
        except Exception as exc:
            raise InvalidProfitabilityWorkbookError(
                "Excel çalışma sayfası bozuk veya okunamıyor."
            ) from exc
        finally:
            workbook.close()

    def read_profitability_report(
        self,
        path: str | Path,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> tuple[ProfitabilitySourceRow, ...]:
        workbook, sheet = _open_first_sheet(path, checkpoint=checkpoint)
        try:
            header_row, columns = self._find_profitability_header(
                sheet,
                checkpoint=checkpoint,
            )
            # Maliyet eşleştirmesi fiyat raporundaki "Stok İsim" anahtarına karşı
            # yapılır; bu yüzden satış raporunda da "Stok İsmi" (ad) tercih edilir.
            # S01S "Stok Dağılımlı" raporu hem Stok Kodu hem Stok İsmi taşır ve
            # sütun sırası [Stok Kodu, Stok İsmi] olduğundan, ada özel olarak
            # öncelik verilmezse kod anahtarı seçilip fiyatla hiç eşleşmezdi.
            stock_index = _find_column(
                columns,
                lambda name: "stok" in name and ("isim" in name or "ismi" in name),
            )
            if stock_index is None:
                stock_index = self._required_profitability_column(
                    columns,
                    lambda name: "stok" in name and "kodu" in name,
                    "Stok İsmi/Kodu",
                )
            quantity_index = self._required_profitability_column(
                columns,
                lambda name: "satis" in name and "miktar" in name,
                "Satış Miktar",
            )
            average_price_index = self._required_profitability_column(
                columns,
                lambda name: "ort" in name and "satis" in name and "fiyat" in name,
                "Ortalama Satış Fiyat",
            )
            sales_amount_index = _find_column(
                columns,
                lambda name: "satis" in name and "tutar" in name,
            )

            rows: list[ProfitabilitySourceRow] = []
            for values in _read_rows(
                sheet,
                header_row=header_row,
                checkpoint=checkpoint,
            ):
                stock_name = _as_text(self._value(values, stock_index))
                if stock_name is None:
                    continue
                normalized_stock = stock_name.upper()
                if any(term in normalized_stock for term in ("TOPLAM", "TOTAL", "GENEL")):
                    continue
                rows.append(
                    ProfitabilitySourceRow(
                        normalized_stock,
                        self._value(values, quantity_index),
                        self._value(values, average_price_index),
                        self._value(values, sales_amount_index),
                    )
                )
            if not rows:
                raise ProfitabilityWorkbookEmptyError(
                    "Karlılık raporunda kullanılabilir stok satırı yok."
                )
            return tuple(rows)
        except (OperationCancelled, ProfitabilityDataError):
            raise
        except Exception as exc:
            raise InvalidProfitabilityWorkbookError(
                "Excel çalışma sayfası bozuk veya okunamıyor."
            ) from exc
        finally:
            workbook.close()

    @staticmethod
    def _find_price_header(
        sheet: Worksheet,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> tuple[int, dict[str, int]]:
        for row_number, values in _header_candidates(
            sheet,
            checkpoint=checkpoint,
        ):
            columns = _column_map(values)
            has_stock = _find_column(
                columns,
                lambda name: "stok" in name and ("isim" in name or "ismi" in name),
            )
            has_price = _find_column(
                columns,
                lambda name: "fiyat" in name and "liste" not in name,
            )
            if has_stock is not None and has_price is not None:
                return row_number, columns
        raise ProfitabilityHeaderNotFoundError("Fiyat raporu başlık satırı bulunamadı.")

    @staticmethod
    def _find_profitability_header(
        sheet: Worksheet,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> tuple[int, dict[str, int]]:
        for row_number, values in _header_candidates(
            sheet,
            checkpoint=checkpoint,
        ):
            columns = _column_map(values)
            has_stock = _find_column(
                columns,
                lambda name: "stok" in name
                and ("isim" in name or "ismi" in name or "kodu" in name),
            )
            flags = (
                any("satis" in name for name in columns),
                any("miktar" in name for name in columns),
                any("fiyat" in name for name in columns),
                any("tutar" in name for name in columns),
            )
            if has_stock is not None and sum(flags) >= 2:
                return row_number, columns
        raise ProfitabilityHeaderNotFoundError(
            "Karlılık raporu başlık satırı bulunamadı."
        )

    @staticmethod
    def _required_price_column(columns, predicate, label: str) -> int:
        index = _find_column(columns, predicate)
        if index is None:
            raise ProfitabilityColumnNotFoundError(
                f"Fiyat raporunda '{label}' sütunu bulunamadı."
            )
        return index

    @staticmethod
    def _required_profitability_column(columns, predicate, label: str) -> int:
        index = _find_column(columns, predicate)
        if index is None:
            raise ProfitabilityColumnNotFoundError(
                f"Karlılık raporunda '{label}' sütunu bulunamadı."
            )
        return index

    @staticmethod
    def _value(values: tuple[Any, ...], index: int | None) -> Any:
        if index is None or index >= len(values):
            return None
        return values[index]
