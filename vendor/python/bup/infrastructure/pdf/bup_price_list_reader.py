# -*- coding: utf-8 -*-
"""BUP fiyat listesi PDF dosyalarından ürün verisi çıkarır."""

import pdfplumber
import re
import time
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from core.cancellation import Checkpoint, OperationCancelled, run_checkpoint
from core.runtime_support import setup_logging

from domain.iskonto.calculations import (
    apply_discounts_to_categories,
    determine_category_by_code,
    determine_category_by_table,
    empty_category_bucket,
)

logger = setup_logging("ISKONTO_PDF")

MAX_PDF_BYTES = 50 * 1024 * 1024
MAX_PAGES = 250
MAX_TABLES_PER_PAGE = 100
MAX_ROWS_TOTAL = 200_000
MAX_COLUMNS_PER_ROW = 256
MAX_CELL_TEXT = 4_096
MAX_PAGE_TEXT = 2_000_000
MAX_PROCESS_SECONDS = 120.0
PDF_MAGIC = b"%PDF-"


class PriceListInputError(ValueError):
    """An untrusted PDF is missing, unsafe, malformed, or over budget."""


def _validated_pdf_path(pdf_path: str | Path) -> Path:
    path = Path(pdf_path).expanduser()
    if path.is_symlink():
        raise PriceListInputError("Sembolik bağlantı PDF girdisi kabul edilmez.")
    if not path.exists() or not path.is_file():
        raise PriceListInputError("PDF dosyası bulunamadı.")
    if path.suffix.lower() != ".pdf":
        raise PriceListInputError("Yalnız .pdf fiyat listeleri desteklenir.")
    try:
        size = path.stat().st_size
        with path.open("rb") as stream:
            magic = stream.read(len(PDF_MAGIC))
    except OSError as exc:
        raise PriceListInputError("PDF dosyasına erişilemiyor.") from exc
    if size > MAX_PDF_BYTES:
        raise PriceListInputError(
            f"PDF dosyası {MAX_PDF_BYTES // (1024 * 1024)} MB sınırını aşıyor."
        )
    if magic != PDF_MAGIC:
        raise PriceListInputError("Dosya uzantısı .pdf ancak içerik PDF değil.")
    return path


class BupPriceListReader:
    """PDF fiyat listesi işleyici"""
    
    def __init__(self):
        self.categories = empty_category_bucket()
        self.raw_data = []
        self.processed_codes = set()
        self.pdf_files = {}
        self._deadline = 0.0
        self._rows_seen = 0
        self._checkpoint: Checkpoint | None = None
        
        # Performans için regex pattern'leri önceden derle
        self.code_pattern = re.compile(r'^(D?[A-Z]{2,4}\d{3}(?:\.\d{2})?(?:\.\d{1,2})?(?:\-\d)?)\s*$')
        self.text_code_pattern = re.compile(
            r'\b(D?[A-Z]{2,4}\d{3}(?:\.\d{2})?(?:\.\d{1,2})?(?:\-\d)?)\b'
        )
        self.price_pattern = re.compile(r'(\d{2,3}[,\.]\d{2})')
    
    def extract_data_from_pdf(
        self,
        pdf_path: str,
        pdf_type: str = "normal",
        *,
        checkpoint: Checkpoint | None = None,
    ) -> bool:
        """PDF'den veri çıkarır"""
        self._checkpoint = checkpoint
        try:
            run_checkpoint(checkpoint)
            # A failed replacement load must never leave records from a
            # previously parsed document visible through this reader.
            self.clear_data()
            path = _validated_pdf_path(pdf_path)
            logger.info("PDF işleniyor [tip=%s]", pdf_type)
            self._deadline = time.monotonic() + MAX_PROCESS_SECONDS
            self._rows_seen = 0
            
            with pdfplumber.open(path) as pdf:
                if len(pdf.pages) > MAX_PAGES:
                    raise PriceListInputError(
                        f"PDF {MAX_PAGES} sayfa güvenli sınırını aşıyor."
                    )
                for page_num, page in enumerate(pdf.pages):
                    self._check_budget()
                    logger.info(f"Sayfa {page_num + 1} işleniyor...")
                    
                    # Önce tabloları dene
                    tables = page.extract_tables()
                    if tables:
                        logger.info(f"Sayfa {page_num + 1}'de {len(tables)} tablo bulundu")
                        self._process_tables(tables, pdf_type, page_num + 1)
                    else:
                        # Fallback: Metin bazlı çıkarma
                        self._process_text(page, pdf_type, page_num + 1)
                
                self._print_results()
                return True

        except OperationCancelled:
            self.clear_data()
            raise
        except PriceListInputError as exc:
            logger.warning(
                "PDF güvenlik doğrulaması reddetti [tür=%s]",
                type(exc).__name__,
            )
            return False
        except Exception as exc:
            logger.error("PDF işleme hatası [tür=%s]", type(exc).__name__)
            return False
        finally:
            self._checkpoint = None

    def _check_budget(self) -> None:
        run_checkpoint(self._checkpoint)
        if time.monotonic() > self._deadline:
            raise PriceListInputError("PDF işleme güvenli süre sınırını aştı.")

    def _consume_row_budget(self) -> None:
        self._rows_seen += 1
        if self._rows_seen > MAX_ROWS_TOTAL:
            raise PriceListInputError(
                f"PDF {MAX_ROWS_TOTAL} satır güvenli sınırını aşıyor."
            )
        self._check_budget()
    
    def _process_tables(self, tables: List, pdf_type: str, page_num: int):
        """Tabloları işle"""
        if len(tables) > MAX_TABLES_PER_PAGE:
            raise PriceListInputError(
                f"PDF sayfası {MAX_TABLES_PER_PAGE} tablo sınırını aşıyor."
            )
        for table_idx, table in enumerate(tables):
            if not table:
                continue
            for row_idx, row in enumerate(table):
                self._consume_row_budget()
                if row and any(cell for cell in row if cell):
                    self._parse_table_row(row, pdf_type, page_num, f"Tablo-{table_idx}-Satır-{row_idx}")
    
    def _process_text(self, page, pdf_type: str, page_num: int):
        """Metin bazlı işleme"""
        text = page.extract_text()
        if text:
            if len(text) > MAX_PAGE_TEXT:
                raise PriceListInputError(
                    "PDF sayfa metni güvenli uzunluk sınırını aşıyor."
                )
            logger.info(f"Sayfa {page_num}'de metin işleniyor...")
            for line_idx, line in enumerate(text.split('\n')):
                self._consume_row_budget()
                if line.strip():
                    self._parse_text_line(line, pdf_type, page_num, line_idx)
    
    def _parse_table_row(self, row: List, pdf_type: str, page_num: int, row_info: str):
        """Tablo satırını parse eder"""
        if not row or len(row) < 3:
            return
        if len(row) > MAX_COLUMNS_PER_ROW:
            raise PriceListInputError(
                f"PDF tablo satırı {MAX_COLUMNS_PER_ROW} hücre sınırını aşıyor."
            )
        
        for i in range(min(3, len(row))):
            if not row[i]:
                continue
                
            cell = str(row[i]).strip()
            if len(cell) > MAX_CELL_TEXT:
                raise PriceListInputError(
                    "PDF hücre metni güvenli uzunluk sınırını aşıyor."
                )
            match = self.code_pattern.match(cell)
            
            if match:
                product_code = match.group(1).strip()
                category = self._determine_category_by_position(product_code, row_info, page_num)
                
                if not category:
                    logger.debug("Kategori bulunamayan ürün satırı atlandı")
                    continue
                
                duplicate_key = f"{product_code}-{category}"
                if duplicate_key in self.processed_codes:
                    logger.debug("Yinelenen ürün satırı atlandı [kategori=%s]", category)
                    continue
                
                product_name = self._extract_product_name(row, i, pdf_type)
                price_without_vat, price_with_vat = self._extract_prices_from_row(row, i + 2)
                
                if product_name and price_without_vat and price_with_vat:
                    if not self._has_supported_vat_rate(
                        price_without_vat,
                        price_with_vat,
                    ):
                        continue
                    
                    product = {
                        'code': product_code,
                        'name': self._clean_product_name(product_name),
                        'price_without_vat': price_without_vat,
                        'price_with_vat': price_with_vat,
                        'category': category
                    }
                    
                    self.categories[category].append(product)
                    self.processed_codes.add(duplicate_key)
                    # Gizlilik: ürün adı/fiyatı log dosyasına yazılmaz (payload
                    # değil, olay logla). Yalnız kategori bağlamı, DEBUG'da.
                    logger.debug("Ürün eklendi [%s - %s]", pdf_type, category)
                    break
    
    def _extract_product_name(self, row: List, code_index: int, pdf_type: str) -> str:
        """Ürün adını çıkar"""
        if code_index + 1 < len(row) and row[code_index + 1]:
            product_name = str(row[code_index + 1]).strip()
            if len(product_name) > MAX_CELL_TEXT:
                raise PriceListInputError(
                    "PDF ürün metni güvenli uzunluk sınırını aşıyor."
                )
            
            if pdf_type == "dondurulmus":
                product_name = product_name.replace("DON.", "DONDURULMUŞ")
            
            return product_name
        return ""
    
    def _extract_prices_from_row(self, row: List, start_index: int) -> Tuple[Optional[float], Optional[float]]:
        """Satırdan fiyatları çıkar"""
        prices = []
        
        for j in range(start_index, len(row)):
            if row[j]:
                cell_value = str(row[j]).strip()
                if len(cell_value) > MAX_CELL_TEXT:
                    raise PriceListInputError(
                        "PDF hücre metni güvenli uzunluk sınırını aşıyor."
                    )
                
                if '%' in cell_value or 'fark' in cell_value.lower():
                    continue
                
                price = self._extract_price_from_text(cell_value)
                if price and 5 <= price <= 2000:
                    prices.append(price)
        
        if len(prices) < 2:
            return None, None
        
        price_without_vat = prices[-2] if len(prices) >= 2 else prices[0]
        price_with_vat = prices[-1]
        
        if price_without_vat > price_with_vat:
            price_without_vat, price_with_vat = price_with_vat, price_without_vat
        
        return price_without_vat, price_with_vat
    
    def _extract_price_from_text(self, text: str) -> Optional[float]:
        """Metinden fiyat çıkar"""
        try:
            clean = text.strip().replace(',', '.')
            clean = re.sub(r'[^\d.]', '', clean)
            if clean:
                return float(clean)
        except (TypeError, ValueError):
            pass
        return None

    @staticmethod
    def _has_supported_vat_rate(
        price_without_vat: float,
        price_with_vat: float,
    ) -> bool:
        """Return whether a parsed price pair carries the expected ~1% VAT."""
        if price_without_vat <= 0:
            logger.warning("Anormal KDV oranı nedeniyle ürün satırı atlandı")
            return False
        vat_rate = (price_with_vat / price_without_vat - 1) * 100
        if 0.5 <= vat_rate <= 1.5:
            return True
        logger.warning("Anormal KDV oranı nedeniyle ürün satırı atlandı")
        return False
    
    def _determine_category_by_position(self, product_code: str, row_info: str, page_num: int) -> Optional[str]:
        """PDF'deki konuma ve ürün koduna göre kategori belirler"""
        table_match = re.search(r'Tablo-(\d+)', row_info)
        if table_match:
            table_num = int(table_match.group(1))
            
            category = determine_category_by_table(table_num)
            if category:
                return category
        
        return self._determine_category_by_code(product_code)
    
    def _determine_category_by_code(self, product_code: str) -> Optional[str]:
        """Ürün koduna göre kategori belirler."""
        return determine_category_by_code(product_code)
    
    def _clean_product_name(self, name: str) -> str:
        """Ürün adını temizle"""
        if not name:
            return ""
        
        name = re.sub(r'\s+', ' ', name)
        name = name.strip()
        name = re.sub(r'^[\d\.\-\s]+', '', name)
        
        return name
    
    def _parse_text_line(self, line: str, pdf_type: str, page_num: int, line_idx: int):
        """Metin satırını parse et"""
        if len(line) > MAX_CELL_TEXT:
            raise PriceListInputError(
                "PDF metin satırı güvenli uzunluk sınırını aşıyor."
            )
        code_matches = list(self.text_code_pattern.finditer(line))
        
        for match in code_matches:
            product_code = match.group(1).strip()
            category = self._determine_category_by_code(product_code)
            
            if not category:
                continue
            
            duplicate_key = f"{product_code}-{category}"
            if duplicate_key in self.processed_codes:
                continue
            
            start_pos = match.end()
            remaining = line[start_pos:].strip()
            
            price_matches = self.price_pattern.findall(remaining)
            prices = []
            
            for price_str in price_matches[-2:]:
                if '%' not in price_str:
                    price = self._extract_price_from_text(price_str)
                    if price and 10 <= price <= 2000:
                        prices.append(price)
            
            if len(prices) < 2:
                continue
            
            price_without_vat, price_with_vat = prices[0], prices[1]
            if not self._has_supported_vat_rate(
                price_without_vat,
                price_with_vat,
            ):
                continue
            
            product_name = remaining
            for price_str in price_matches:
                product_name = product_name.replace(price_str, '')
            
            product_name = re.sub(r'%.*?\d+[,\.]\d{2}', '', product_name)
            product_name = self._clean_product_name(product_name)
            
            if pdf_type == "dondurulmus" and "DON." in product_name:
                product_name = product_name.replace("DON.", "DONDURULMUŞ")
            
            if product_name and len(product_name) > 3:
                product = {
                    'code': product_code,
                    'name': product_name,
                    'price_without_vat': price_without_vat,
                    'price_with_vat': price_with_vat,
                    'category': category
                }
                
                self.categories[category].append(product)
                self.processed_codes.add(duplicate_key)
                # Gizlilik: ürün kodu/adı log'a yazılmaz; olay + kategori, DEBUG.
                logger.debug("Ürün eklendi [%s - %s]", pdf_type, category)
    
    def _print_results(self):
        """Ayrıştırma özetini gizlilik-güvenli raporla.

        Ürün kodu/adı/fiyatı log'a veya stdout'a YAZILMAZ (payload değil, olay
        logla). Yalnız toplam ve kategori sayıları paylaşılır; kategori adları
        sabit BUP etiketleridir, hassas değildir.
        """
        total = 0
        for cat_name, products in self.categories.items():
            count = len(products)
            total += count
            if count:
                logger.debug("Kategori özeti [%s]: %d ürün", cat_name, count)

        if total == 0:
            logger.warning("Hiç ürün bulunamadı; PDF formatını kontrol edin.")
        else:
            logger.info("PDF ayrıştırma tamam: %d benzersiz ürün", total)
    
    def apply_discounts(
        self,
        discount_rates: Dict[str, float],
        *,
        checkpoint: Checkpoint | None = None,
    ) -> Dict:
        """İskonto oranlarını uygular - %1 KDV ile."""
        return apply_discounts_to_categories(
            self.categories,
            discount_rates,
            vat_rate=1.0,
            checkpoint=checkpoint,
        )
    
    def get_categories(self) -> List[str]:
        """Mevcut kategorileri döner"""
        return list(self.categories.keys())
    
    def get_product_count(self) -> int:
        """Toplam ürün sayısını döner"""
        return sum(len(products) for products in self.categories.values())
    
    def clear_data(self):
        """Verileri temizler"""
        for category in self.categories:
            self.categories[category] = []
        self.processed_codes.clear()
    
    @staticmethod
    def determine_pdf_type(
        pdf_path: str,
        *,
        checkpoint: Checkpoint | None = None,
    ) -> str:
        """PDF tipini belirler"""
        try:
            run_checkpoint(checkpoint)
            path = _validated_pdf_path(pdf_path)
            deadline = time.monotonic() + MAX_PROCESS_SECONDS
            with pdfplumber.open(path) as pdf:
                if len(pdf.pages) > MAX_PAGES:
                    raise PriceListInputError(
                        f"PDF {MAX_PAGES} sayfa güvenli sınırını aşıyor."
                    )
                text = ""
                for page in pdf.pages[:2]:
                    run_checkpoint(checkpoint)
                    if time.monotonic() > deadline:
                        raise PriceListInputError(
                            "PDF işleme güvenli süre sınırını aştı."
                        )
                    page_text = page.extract_text()
                    if page_text:
                        if len(page_text) > MAX_PAGE_TEXT:
                            raise PriceListInputError(
                                "PDF sayfa metni güvenli uzunluk sınırını aşıyor."
                            )
                        text += page_text.lower()
                
                if 'dondurulmuş' in text or 'don.' in text:
                    return 'dondurulmus'
                elif 'gramaj' in text or 'soslu' in text:
                    return 'gramaj'
                else:
                    return 'normal'
        except OperationCancelled:
            raise
        except Exception as exc:
            logger.warning("PDF tipi belirlenemedi [tür=%s]", type(exc).__name__)
            return 'normal'
