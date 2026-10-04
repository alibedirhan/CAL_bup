# -*- coding: utf-8 -*-
"""Validated, toolkit-independent application settings storage."""

from __future__ import annotations

import json
import logging
import os
import shutil
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path

logger = logging.getLogger("BUP_SETTINGS")

SETTINGS_SCHEMA_VERSION = 2
# Eski sürümler okunmaya devam eder; eksik alanlar varsayılana düşer.
READABLE_SCHEMA_VERSIONS = frozenset({1, 2})
SUPPORTED_THEME_MODES = frozenset({"light", "dark", "system"})
MAX_SETTINGS_BYTES = 64 * 1024
# Yerel model dosyası ayarlarda yalnız YOL olarak tutulur; model paketin
# içine girmez ve uygulama onu kendiliğinden indirmez.
MAX_MODEL_PATH_LENGTH = 4096


@dataclass(frozen=True)
class ApplicationSettings:
    """Small, versioned set of non-sensitive user preferences."""

    schema_version: int = SETTINGS_SCHEMA_VERSION
    theme_mode: str = "system"
    # Kullanıcının seçtiği yerel dil modeli dosyası; boş = model yok.
    local_model_path: str = ""


def get_config_dir() -> Path:
    override = os.environ.get("BUP_CONFIG_DIR")
    if override:
        return Path(override).expanduser()
    if sys.platform.startswith("win"):
        root = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA")
        return Path(root).expanduser() / "BUP Yonetim" if root else Path.home() / "BUP Yonetim"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "BUP Yonetim"
    root = os.environ.get("XDG_CONFIG_HOME")
    return Path(root).expanduser() / "bup-yonetim" if root else Path.home() / ".config" / "bup-yonetim"


_READ_ERRORS = (OSError, UnicodeError, json.JSONDecodeError, ValueError)


def _validated_model_path(value: object) -> str:
    """Model yolunu sınırla; ayar dosyası keyfi veri taşıyamaz."""

    if value in (None, ""):
        return ""
    if not isinstance(value, str):
        raise ValueError("Yerel model yolu metin olmalıdır")
    cleaned = value.strip()
    if len(cleaned) > MAX_MODEL_PATH_LENGTH:
        raise ValueError("Yerel model yolu izin verilen uzunluğu aşıyor")
    if not cleaned.isprintable():
        raise ValueError("Yerel model yolu kontrol karakteri içeremez")
    return cleaned


class SettingsStore:
    """Load and atomically persist validated JSON preferences.

    Kayıtta önceki geçerli dosya bir ``.bak`` yedeğine alınır; yüklemede
    birincil dosya bozuksa otomatik olarak yedekten kurtarılır (kendi kendini
    iyileştirme), o da geçersizse güvenli varsayılana düşülür.
    """

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or get_config_dir() / "settings.json"
        self.backup_path = self.path.parent / (self.path.name + ".bak")

    def _parse(self, path: Path) -> ApplicationSettings:
        if path.stat().st_size > MAX_SETTINGS_BYTES:
            raise ValueError("Ayar dosyası izin verilen boyutu aşıyor")
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Ayar dosyası JSON nesnesi olmalıdır")
        mode = payload.get("theme_mode", "system")
        if mode not in SUPPORTED_THEME_MODES:
            raise ValueError(f"Desteklenmeyen tema modu: {mode!r}")
        version = payload.get("schema_version", SETTINGS_SCHEMA_VERSION)
        if version not in READABLE_SCHEMA_VERSIONS:
            raise ValueError(f"Desteklenmeyen ayar şeması: {version!r}")
        model_path = _validated_model_path(payload.get("local_model_path", ""))
        # Eski dosyalar okunur ama güncel şemaya taşınır.
        return ApplicationSettings(
            schema_version=SETTINGS_SCHEMA_VERSION,
            theme_mode=mode,
            local_model_path=model_path,
        )

    def load(self) -> ApplicationSettings:
        if self.path.exists():
            try:
                return self._parse(self.path)
            except _READ_ERRORS as exc:
                logger.warning("Ayarlar okunamadı, yedek deneniyor [tür=%s]", type(exc).__name__)
        if self.backup_path.exists():
            try:
                recovered = self._parse(self.backup_path)
                logger.info("Ayarlar güvenli yedekten kurtarıldı")
                return recovered
            except _READ_ERRORS as exc:
                logger.warning("Ayar yedeği de okunamadı [tür=%s]", type(exc).__name__)
        return ApplicationSettings()

    def _backup_existing(self) -> None:
        if not self.path.exists():
            return
        try:
            shutil.copy2(self.path, self.backup_path)
            try:
                self.backup_path.chmod(0o600)
            except OSError:
                pass
        except OSError as exc:
            logger.warning("Ayar yedeği oluşturulamadı [tür=%s]", type(exc).__name__)

    def save(self, settings: ApplicationSettings) -> None:
        if settings.theme_mode not in SUPPORTED_THEME_MODES:
            raise ValueError(f"Desteklenmeyen tema modu: {settings.theme_mode!r}")
        _validated_model_path(settings.local_model_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            dir=self.path.parent,
            prefix=".settings-",
            suffix=".tmp",
            text=True,
        )
        temporary_path = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                json.dump(asdict(settings), stream, ensure_ascii=False, indent=2)
                stream.write("\n")
                stream.flush()
                os.fsync(stream.fileno())
            try:
                temporary_path.chmod(0o600)
            except OSError:
                pass
            self._backup_existing()
            os.replace(temporary_path, self.path)
        finally:
            temporary_path.unlink(missing_ok=True)

    def restore_from_backup(self) -> bool:
        """Geçerli bir yedek varsa birincil ayar dosyasına geri yükler."""
        if not self.backup_path.exists():
            return False
        try:
            self._parse(self.backup_path)
        except _READ_ERRORS as exc:
            logger.warning("Geçersiz yedek geri yüklenmedi [tür=%s]", type(exc).__name__)
            return False
        try:
            shutil.copy2(self.backup_path, self.path)
            try:
                self.path.chmod(0o600)
            except OSError:
                pass
            return True
        except OSError as exc:
            logger.warning("Yedek geri yüklenemedi [tür=%s]", type(exc).__name__)
            return False
