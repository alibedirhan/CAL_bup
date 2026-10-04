# -*- coding: utf-8 -*-
"""Cancellable PDF document builder for full discount exports."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from core.cancellation import Checkpoint, run_checkpoint
from core.runtime_support import (
    get_clean_filename,
    get_date_display,
    safe_turkish_text,
    setup_logging,
)

logger = setup_logging("ISKONTO_EXPORT")


class SafePDF(FPDF):
    """Use an available Unicode font while preserving the legacy PDF layout."""

    def __init__(self) -> None:
        self.font_loaded = False
        super().__init__()
        self._load_fonts()

    def _load_fonts(self) -> None:
        try:
            self.set_font("Helvetica", "", 12)
            paths_to_try = [
                ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
                (
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                ),
            ]
            for normal_path, bold_path in paths_to_try:
                try:
                    if Path(normal_path).exists() and Path(bold_path).exists():
                        self.add_font("DejaVu", "", normal_path)
                        self.add_font("DejaVu", "B", bold_path)
                        self.font_loaded = True
                        break
                except Exception:
                    continue
        except Exception as exc:
            logger.warning("Font yükleme başarısız [tür=%s]", type(exc).__name__)

    def set_font(self, family, style="", size=0):
        try:
            if self.font_loaded and family == "Arial" and style in {"", "B"}:
                super().set_font("DejaVu", style, size)
            else:
                super().set_font("Helvetica", style, size)
        except Exception:
            try:
                super().set_font("Helvetica", "", 12)
            except Exception:
                pass

    def cell(
        self,
        w=None,
        h=None,
        text="",
        border=0,
        ln=0,
        align="",
        fill=False,
        link="",
    ):
        new_x = XPos.LMARGIN if ln == 1 else XPos.RIGHT
        new_y = YPos.NEXT if ln == 1 else YPos.TOP
        return super().cell(
            w=w,
            h=h,
            text=text,
            border=border,
            align=align,
            fill=fill,
            link=link,
            new_x=new_x,
            new_y=new_y,
        )

    def header(self) -> None:
        pass

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.cell(0, 10, f"Sayfa {self.page_no()}", 0, 0, "C")


def write_discount_pdf(
    destination: Path,
    pdf_name: str,
    data: Mapping[str, Sequence[Mapping[str, object]]],
    discount_rates: Mapping[str, float],
    *,
    checkpoint: Checkpoint | None = None,
) -> None:
    pdf = SafePDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    _add_cover_page(pdf, pdf_name, data, checkpoint=checkpoint)
    pdf.add_page()
    _add_summary_page(pdf, data, discount_rates, checkpoint=checkpoint)
    for category, products in data.items():
        run_checkpoint(checkpoint)
        if not products:
            continue
        pdf.add_page()
        _add_category_page(
            pdf,
            safe_turkish_text(category),
            products,
            discount_rates[category],
            checkpoint=checkpoint,
        )
    run_checkpoint(checkpoint)
    pdf.output(str(destination))


def _add_cover_page(
    pdf: SafePDF,
    pdf_name: str,
    data: Mapping[str, Sequence[Mapping[str, object]]],
    *,
    checkpoint: Checkpoint | None,
) -> None:
    pdf.set_font("Arial", "B", 24)
    pdf.ln(50)
    pdf.cell(0, 15, "BUPILIC", 0, 1, "C")
    pdf.set_font("Arial", "", 18)
    pdf.cell(0, 10, "ISKONTOLU FIYAT LISTESI", 0, 1, "C")
    pdf.ln(20)
    pdf.set_font("Arial", "", 14)
    pdf.cell(0, 10, safe_turkish_text(get_clean_filename(pdf_name)), 0, 1, "C")
    pdf.ln(10)
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 10, f"Tarih: {get_date_display()}", 0, 1, "C")
    pdf.ln(30)
    total = 0
    for products in data.values():
        run_checkpoint(checkpoint)
        if products:
            total += len(products)
    pdf.set_font("Arial", "", 11)
    pdf.cell(0, 8, f"Toplam Urun: {total}", 0, 1, "C")


def _add_summary_page(
    pdf: SafePDF,
    data: Mapping[str, Sequence[Mapping[str, object]]],
    discount_rates: Mapping[str, float],
    *,
    checkpoint: Checkpoint | None,
) -> None:
    pdf.set_font("Arial", "B", 14)
    pdf.cell(0, 10, "OZET", 0, 1, "L")
    pdf.ln(5)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(60, 8, "Kategori", 1, 0, "C")
    pdf.cell(25, 8, "Urun", 1, 0, "C")
    pdf.cell(25, 8, "Iskonto %", 1, 0, "C")
    pdf.cell(35, 8, "Iskonto TL", 1, 1, "C")
    pdf.set_font("Arial", "", 9)
    total_products = 0
    total_discount = 0.0
    for category, products in data.items():
        run_checkpoint(checkpoint)
        if not products:
            continue
        count = len(products)
        rate = discount_rates[category]
        discount = 0.0
        for product in products:
            run_checkpoint(checkpoint)
            discount += float(product.get("original_price_with_vat", 0)) - float(
                product["price_with_vat"]
            )
        safe_category = safe_turkish_text(category)[:30]
        pdf.cell(60, 7, safe_category, 1, 0, "L")
        pdf.cell(25, 7, str(count), 1, 0, "C")
        pdf.cell(25, 7, f"{rate:.1f}", 1, 0, "C")
        pdf.cell(35, 7, f"{discount:.2f}", 1, 1, "R")
        total_products += count
        total_discount += discount
    pdf.set_font("Arial", "B", 10)
    pdf.cell(60, 8, "TOPLAM", 1, 0, "L")
    pdf.cell(25, 8, str(total_products), 1, 0, "C")
    pdf.cell(25, 8, "-", 1, 0, "C")
    pdf.cell(35, 8, f"{total_discount:.2f}", 1, 1, "R")


def _add_category_page(
    pdf: SafePDF,
    category: str,
    products: Sequence[Mapping[str, object]],
    discount_rate: float,
    *,
    checkpoint: Checkpoint | None,
) -> None:
    pdf.set_font("Arial", "B", 14)
    pdf.cell(0, 10, f"{category} - %{discount_rate:.1f} Iskonto", 0, 1, "C")
    pdf.ln(5)
    pdf.set_font("Arial", "B", 9)
    pdf.cell(70, 7, "Urun", 1, 0, "C")
    pdf.cell(30, 7, "Orijinal", 1, 0, "C")
    pdf.cell(30, 7, "Iskontolu", 1, 0, "C")
    pdf.cell(25, 7, "Kazanc", 1, 1, "C")
    pdf.set_font("Arial", "", 8)
    for product in products:
        run_checkpoint(checkpoint)
        name = safe_turkish_text(product["name"])[:35]
        original = float(product.get("original_price_with_vat", 0))
        discounted = float(product["price_with_vat"])
        saved = original - discounted
        pdf.cell(70, 6, name, 1, 0, "L")
        pdf.cell(30, 6, f"{original:.2f}", 1, 0, "R")
        pdf.cell(30, 6, f"{discounted:.2f}", 1, 0, "R")
        pdf.cell(25, 6, f"{saved:.2f}", 1, 1, "R")
