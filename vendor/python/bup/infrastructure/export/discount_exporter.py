# -*- coding: utf-8 -*-
"""İskonto sonuçlarını Excel ve PDF olarak dışa aktarır."""

from datetime import datetime
import os
from pathlib import Path
import tempfile
from typing import Dict, List, Mapping

import pandas as pd

from core.cancellation import Checkpoint, OperationCancelled, run_checkpoint
from core.runtime_support import (
    get_clean_filename,
    get_exports_dir,
    setup_logging,
)
from domain.iskonto import (
    DiscountExportError,
    DiscountExportExistsError,
    DiscountExportWriteError,
    InvalidDiscountExportDataError,
    InvalidDiscountExportPathError,
)
from infrastructure.export.atomic_publish import fsync_parent, publish_staged_file
from infrastructure.export.discount_bundle_publish import (
    StagedOutput,
    publish_staged_bundle,
)
from infrastructure.export.discount_export_safety import (
    MAX_EXCEL_BYTES,
    MAX_PDF_BYTES,
    neutralize_formula,
    planned_pdf_destinations,
    validate_export_payload,
    validated_file_destination,
)
from infrastructure.export.discount_pdf_writer import write_discount_pdf

logger = setup_logging("ISKONTO_EXPORT")


class DiscountExporter:
    """Excel ve PDF dışa aktarma yöneticisi"""

    def __init__(self):
        self.exports_dir = get_exports_dir()
        self._setup_directories()
    
    def _setup_directories(self):
        """Gerekli dizinleri oluştur"""
        for directory in (self.exports_dir / "excel", self.exports_dir / "pdf"):
            if directory.is_symlink():
                raise InvalidDiscountExportPathError(
                    "Varsayılan export klasörü sembolik bağlantı olamaz."
                )
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            try:
                directory.chmod(0o700)
            except OSError:
                pass
        logger.info("Export dizinleri hazır")
    
    def export_to_excel_multi(
        self,
        all_pdf_data: Dict,
        discount_rates: Mapping[str, float],
        file_path: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> Path:
        """Çoklu PDF verisini belirtilen Excel dosyasına atomik aktar."""
        validate_export_payload(
            all_pdf_data,
            discount_rates,
            checkpoint=checkpoint,
        )
        destination = validated_file_destination(
            file_path,
            suffix=".xlsx",
            overwrite=overwrite,
        )
        temporary_path: Path | None = None
        try:
            temporary_path = self._stage_excel_output(
                all_pdf_data,
                discount_rates,
                destination,
                checkpoint=checkpoint,
            )
            self._publish_file(
                temporary_path,
                destination,
                overwrite=overwrite,
                checkpoint=checkpoint,
            )
        except (DiscountExportError, OperationCancelled):
            raise
        except Exception as exc:
            raise DiscountExportWriteError(
                "İskonto Excel dosyası atomik olarak yazılamadı."
            ) from exc
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
        logger.info("Excel export kaydedildi")
        return destination

    def export_to_pdf_multi(
        self,
        all_pdf_data: Dict,
        discount_rates: Mapping[str, float],
        save_dir: str | Path,
        *,
        overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> list[Path]:
        """Her kaynak için ayrı PDF'i atomik ve açık overwrite ile yaz."""
        validate_export_payload(
            all_pdf_data,
            discount_rates,
            checkpoint=checkpoint,
        )
        destinations = self.pdf_output_paths(
            all_pdf_data,
            save_dir,
            checkpoint=checkpoint,
        )
        collisions = tuple(path for path in destinations if path.exists())
        if collisions and not overwrite:
            raise DiscountExportExistsError(
                f"{len(collisions)} PDF zaten var; açık onay olmadan üzerine yazılmadı."
            )

        staged: list[tuple[Path, Path]] = []
        published: list[tuple[Path, Path]] = []
        completed = False
        try:
            staged = self._stage_pdf_outputs(
                all_pdf_data,
                discount_rates,
                destinations,
                checkpoint=checkpoint,
            )

            if not overwrite and any(destination.exists() for _, destination in staged):
                raise DiscountExportExistsError(
                    "PDF hedeflerinden biri işlem sırasında oluştu; üzerine yazılmadı."
                )
            run_checkpoint(checkpoint)
            for temporary_path, destination in staged:
                self._publish_file(
                    temporary_path,
                    destination,
                    overwrite=overwrite,
                )
                published.append((temporary_path, destination))
                logger.info("PDF export kaydedildi")
            completed = True
        except (DiscountExportError, OperationCancelled):
            raise
        except Exception as exc:
            raise DiscountExportWriteError(
                "İskonto PDF dosyaları atomik olarak yazılamadı."
            ) from exc
        finally:
            if not completed and not overwrite:
                self._rollback_created_links(published)
            for temporary_path, _destination in staged:
                temporary_path.unlink(missing_ok=True)
        return list(destinations)

    def export_bundle(
        self,
        all_pdf_data: Dict,
        discount_rates: Mapping[str, float],
        excel_path: str | Path,
        pdf_dir: str | Path,
        *,
        excel_overwrite: bool = False,
        pdf_overwrite: bool = False,
        checkpoint: Checkpoint | None = None,
    ) -> list[Path]:
        """Stage Excel and every PDF, then publish them as one commit phase."""

        validate_export_payload(
            all_pdf_data,
            discount_rates,
            checkpoint=checkpoint,
        )
        excel_destination = validated_file_destination(
            excel_path,
            suffix=".xlsx",
            overwrite=excel_overwrite,
        )
        pdf_destinations = self.pdf_output_paths(
            all_pdf_data,
            pdf_dir,
            checkpoint=checkpoint,
        )
        collisions = tuple(path for path in pdf_destinations if path.exists())
        if collisions and not pdf_overwrite:
            raise DiscountExportExistsError(
                f"{len(collisions)} PDF zaten var; açık onay olmadan üzerine yazılmadı."
            )

        staged_outputs: list[StagedOutput] = []
        try:
            excel_temporary = self._stage_excel_output(
                all_pdf_data,
                discount_rates,
                excel_destination,
                checkpoint=checkpoint,
            )
            staged_outputs.append(
                StagedOutput(
                    excel_temporary,
                    excel_destination,
                    excel_overwrite,
                )
            )
            staged_outputs.extend(
                StagedOutput(temporary, destination, pdf_overwrite)
                for temporary, destination in self._stage_pdf_outputs(
                    all_pdf_data,
                    discount_rates,
                    pdf_destinations,
                    checkpoint=checkpoint,
                )
            )
            # Cancellation is honored only before the multi-file commit. Once
            # publication starts it runs to completion or rolls back safely.
            run_checkpoint(checkpoint)

            def publish(temporary: Path, destination: Path) -> None:
                output = next(
                    item
                    for item in staged_outputs
                    if item.temporary_path == temporary
                    and item.destination == destination
                )
                self._publish_file(
                    temporary,
                    destination,
                    overwrite=output.overwrite,
                )

            publish_staged_bundle(staged_outputs, publish=publish)
        except FileExistsError as exc:
            raise DiscountExportExistsError(
                "Hedef dosyalardan biri işlem sırasında oluştu; üzerine yazılmadı."
            ) from exc
        except (DiscountExportError, OperationCancelled):
            raise
        except Exception as exc:
            raise DiscountExportWriteError(
                "İskonto Excel ve PDF paketi atomik olarak yazılamadı."
            ) from exc
        finally:
            for output in staged_outputs:
                output.temporary_path.unlink(missing_ok=True)
        logger.info("Excel ve PDF export paketi kaydedildi")
        return [excel_destination, *pdf_destinations]

    def _stage_excel_output(
        self,
        all_pdf_data: Dict,
        discount_rates: Mapping[str, float],
        destination: Path,
        *,
        checkpoint: Checkpoint | None,
    ) -> Path:
        temporary_path = self._temporary_path(destination, "excel")
        try:
            with pd.ExcelWriter(temporary_path, engine="openpyxl") as writer:
                summary_data = self._create_multi_summary(
                    all_pdf_data,
                    checkpoint=checkpoint,
                )
                pd.DataFrame(summary_data).to_excel(
                    writer,
                    sheet_name="OZET",
                    index=False,
                )
                self._write_excel_detail_sheets(
                    writer,
                    all_pdf_data,
                    discount_rates,
                    checkpoint=checkpoint,
                )
            self._prepare_temporary_file(temporary_path, max_bytes=MAX_EXCEL_BYTES)
            return temporary_path
        except Exception:
            temporary_path.unlink(missing_ok=True)
            raise

    def _stage_pdf_outputs(
        self,
        all_pdf_data: Mapping[str, Mapping[str, object]],
        discount_rates: Mapping[str, float],
        destinations: tuple[Path, ...],
        *,
        checkpoint: Checkpoint | None,
    ) -> list[tuple[Path, Path]]:
        staged: list[tuple[Path, Path]] = []
        try:
            for (pdf_name, pdf_data), destination in zip(
                all_pdf_data.items(),
                destinations,
                strict=True,
            ):
                run_checkpoint(checkpoint)
                temporary_path = self._temporary_path(destination, "pdf")
                staged.append((temporary_path, destination))
                write_discount_pdf(
                    temporary_path,
                    pdf_name,
                    pdf_data["data"],
                    discount_rates,
                    checkpoint=checkpoint,
                )
                self._prepare_temporary_file(
                    temporary_path,
                    max_bytes=MAX_PDF_BYTES,
                )
            return staged
        except Exception:
            for temporary_path, _destination in staged:
                temporary_path.unlink(missing_ok=True)
            raise

    def pdf_output_paths(
        self,
        all_pdf_data: Mapping[str, Mapping[str, object]],
        save_dir: str | Path,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> tuple[Path, ...]:
        """Return validated deterministic PDF targets for confirmation UI."""
        date_label = datetime.now().strftime("%d.%m.%Y")
        return planned_pdf_destinations(
            all_pdf_data,
            save_dir,
            date_label=date_label,
            checkpoint=checkpoint,
        )

    def existing_pdf_outputs(
        self,
        all_pdf_data: Mapping[str, Mapping[str, object]],
        save_dir: str | Path,
    ) -> tuple[Path, ...]:
        """List only deterministic outputs that currently collide."""
        paths = self.pdf_output_paths(all_pdf_data, save_dir)
        return tuple(path for path in paths if path.exists())

    def _write_excel_detail_sheets(
        self,
        writer,
        all_pdf_data: Mapping[str, Mapping[str, object]],
        discount_rates: Mapping[str, float],
        *,
        checkpoint: Checkpoint | None = None,
    ) -> None:
        for sheet_idx, (pdf_name, pdf_data) in enumerate(all_pdf_data.items(), 1):
            run_checkpoint(checkpoint)
            clean_name = get_clean_filename(pdf_name, max_length=25)
            sheet_name = f"{sheet_idx}_{clean_name}"[:31]
            sheet_data: list[dict[str, object]] = []
            category_data = pdf_data["data"]
            for category, products in category_data.items():
                run_checkpoint(checkpoint)
                if not products:
                    continue
                discount_rate = discount_rates[category]
                sheet_data.append(
                    {
                        "Kategori": neutralize_formula(category),
                        "Ürün Adı": f"%{discount_rate:.1f} İSKONTO",
                        "Orj. KDV Hariç": "",
                        "Orj. KDV Dahil": "",
                        "İsk. KDV Hariç": "",
                        "İsk. KDV Dahil": "",
                        "İskonto %": discount_rate,
                        "İskonto TL": "",
                    }
                )
                for product in products:
                    run_checkpoint(checkpoint)
                    iskonto = (
                        product.get("original_price_with_vat", 0)
                        - product["price_with_vat"]
                    )
                    sheet_data.append(
                        {
                            "Kategori": neutralize_formula(category),
                            "Ürün Adı": neutralize_formula(product["name"]),
                            "Orj. KDV Hariç": product.get(
                                "original_price_without_vat",
                                0,
                            ),
                            "Orj. KDV Dahil": product.get(
                                "original_price_with_vat",
                                0,
                            ),
                            "İsk. KDV Hariç": product["price_without_vat"],
                            "İsk. KDV Dahil": product["price_with_vat"],
                            "İskonto %": discount_rate,
                            "İskonto TL": round(iskonto, 2),
                        }
                    )
                sheet_data.append({column: "" for column in sheet_data[0]})
            if sheet_data:
                pd.DataFrame(sheet_data).to_excel(
                    writer,
                    sheet_name=sheet_name,
                    index=False,
                )
                self._format_excel_sheet(writer, sheet_name)

    @staticmethod
    def _temporary_path(destination: Path, kind: str) -> Path:
        descriptor, temporary_name = tempfile.mkstemp(
            dir=destination.parent,
            prefix=f".discount-{kind}-",
            suffix=destination.suffix,
        )
        os.close(descriptor)
        return Path(temporary_name)

    @staticmethod
    def _prepare_temporary_file(path: Path, *, max_bytes: int) -> None:
        size = path.stat().st_size
        if not 0 < size <= max_bytes:
            raise InvalidDiscountExportDataError(
                "Üretilen çıktı güvenli dosya boyutu sınırını aşıyor."
            )
        try:
            path.chmod(0o600)
        except OSError:
            pass
        with path.open("rb+") as stream:
            os.fsync(stream.fileno())

    @staticmethod
    def _publish_file(
        temporary_path: Path,
        destination: Path,
        *,
        overwrite: bool,
        checkpoint: Checkpoint | None = None,
    ) -> None:
        if destination.parent.is_symlink() or destination.is_symlink():
            raise InvalidDiscountExportPathError(
                "Sembolik bağlantı hedefi kullanılamaz."
            )
        if destination.exists():
            if not destination.is_file():
                raise InvalidDiscountExportPathError(
                    "Dışa aktarma hedefi normal bir dosya olmalıdır."
                )
            if not overwrite:
                raise DiscountExportExistsError(
                    "Hedef dosya işlem sırasında oluştu; üzerine yazılmadı."
                )
        run_checkpoint(checkpoint)
        try:
            publish_staged_file(
                temporary_path,
                destination,
                overwrite=overwrite,
            )
        except FileExistsError as exc:
            raise DiscountExportExistsError(
                "Hedef dosya işlem sırasında oluştu; üzerine yazılmadı."
            ) from exc

    @staticmethod
    def _rollback_created_links(published: list[tuple[Path, Path]]) -> None:
        """Remove only no-clobber destinations still linked to our staging inode."""

        for temporary_path, destination in reversed(published):
            try:
                if os.path.samefile(temporary_path, destination):
                    destination.unlink()
                    fsync_parent(destination.parent)
            except OSError:
                # A concurrently replaced path no longer belongs to this
                # operation and must never be deleted by rollback.
                continue
    
    def _create_multi_summary(
        self,
        all_pdf_data: Dict,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> List[Dict]:
        """Özet verisi oluştur"""
        summary = []
        
        for pdf_name, pdf_data in all_pdf_data.items():
            run_checkpoint(checkpoint)
            pdf_summary = {
                'PDF Dosyası': neutralize_formula(pdf_name),
                'Kategori': 0,
                'Ürün': 0,
                'Toplam Orijinal': 0,
                'Toplam İskontolu': 0,
                'Toplam İskonto': 0
            }
            
            for category, products in pdf_data['data'].items():
                run_checkpoint(checkpoint)
                if products:
                    pdf_summary['Kategori'] += 1
                    pdf_summary['Ürün'] += len(products)
                    
                    for product in products:
                        run_checkpoint(checkpoint)
                        pdf_summary['Toplam Orijinal'] += product.get('original_price_with_vat', 0)
                        pdf_summary['Toplam İskontolu'] += product['price_with_vat']
                        pdf_summary['Toplam İskonto'] += (
                            product.get('original_price_with_vat', 0) - product['price_with_vat']
                        )
            
            for key in ['Toplam Orijinal', 'Toplam İskontolu', 'Toplam İskonto']:
                pdf_summary[key] = round(pdf_summary[key], 2)
            
            summary.append(pdf_summary)
        
        return summary
    
    def _format_excel_sheet(self, writer, sheet_name: str):
        """Excel formatla"""
        try:
            worksheet = writer.sheets[sheet_name]
            widths = {'A': 25, 'B': 50, 'C': 15, 'D': 15, 'E': 15, 'F': 15, 'G': 12, 'H': 15}
            for col, width in widths.items():
                worksheet.column_dimensions[col].width = width
        except Exception as exc:
            logger.warning("Format hatası [tür=%s]", type(exc).__name__)
