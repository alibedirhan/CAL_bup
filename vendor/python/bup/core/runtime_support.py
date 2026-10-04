from datetime import datetime
from pathlib import Path
import logging

def setup_logging(name):
    logger = logging.getLogger(name)
    logger.disabled = True
    return logger

def get_exports_dir():
    return Path("/cal/exports")

def safe_turkish_text(text: object) -> str:
    value = str(text)
    replacements = str.maketrans(
        {
            "İ": "I",
            "ı": "i",
            "Ğ": "G",
            "ğ": "g",
            "Ü": "U",
            "ü": "u",
            "Ş": "S",
            "ş": "s",
            "Ö": "O",
            "ö": "o",
            "Ç": "C",
            "ç": "c",
        }
    )
    return value.translate(replacements)

def get_clean_filename(filename: str, max_length: int = 50) -> str:
    base_name = Path(filename).stem
    clean_name = "".join(
        character
        for character in base_name
        if character.isalnum() or character in (" ", "-", "_")
    )
    clean_name = " ".join(clean_name.split())[:max_length]
    return clean_name or "Dosya"

def get_date_display() -> str:
    return datetime.now().strftime("%d.%m.%Y %H:%M")
