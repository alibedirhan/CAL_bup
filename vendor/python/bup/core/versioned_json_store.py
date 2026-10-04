# -*- coding: utf-8 -*-
"""Private, versioned JSON persistence with atomic backup recovery.

This module owns only the file-system mechanics shared by the small local
configuration stores.  Each caller remains responsible for its own schema and
value validation through the supplied parser.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Callable, Generic, TypeVar


T = TypeVar("T")
Parser = Callable[[object], T]
_READ_ERRORS = (
    OSError,
    UnicodeError,
    json.JSONDecodeError,
    TypeError,
    ValueError,
    OverflowError,
    RecursionError,
)


def _reject_non_finite_json(value: str) -> object:
    """Reject JavaScript-style constants that are not valid JSON numbers."""

    raise ValueError(f"Sonlu olmayan JSON sayısı kabul edilmez: {value}")


class StoreRecoveryError(RuntimeError):
    """Stored data cannot be changed without risking silent data loss."""


class VersionedJsonStore(Generic[T]):
    """Read and atomically replace one bounded JSON document plus ``.bak``."""

    def __init__(
        self,
        path: Path,
        *,
        max_bytes: int,
        label: str,
        logger: logging.Logger,
    ) -> None:
        self.path = path
        self.backup_path = path.with_name(path.name + ".bak")
        self.max_bytes = max_bytes
        self.label = label
        self.logger = logger

    @staticmethod
    def _exists(path: Path) -> bool:
        return path.exists() or path.is_symlink()

    def _parse_path(self, path: Path, parser: Parser[T]) -> T:
        if path.is_symlink():
            raise ValueError("Sembolik bağlantı veri dosyası kabul edilmez")
        if path.stat().st_size > self.max_bytes:
            raise ValueError(f"{self.label} izin verilen boyutu aşıyor")
        return parser(
            json.loads(
                path.read_text(encoding="utf-8"),
                parse_constant=_reject_non_finite_json,
            )
        )

    def load(
        self,
        parser: Parser[T],
        default_factory: Callable[[], T],
        *,
        for_update: bool = False,
    ) -> T:
        """Load primary, recover from backup, or return a safe default.

        Mutating callers pass ``for_update=True``.  If both copies are invalid,
        that mode raises instead of allowing an empty default to overwrite the
        only evidence of the user's previous data.
        """

        found_stored_data = False
        if self._exists(self.path):
            found_stored_data = True
            try:
                return self._parse_path(self.path, parser)
            except _READ_ERRORS as exc:
                self.logger.warning(
                    "%s okunamadı; güvenli yedek deneniyor [tür=%s]",
                    self.label,
                    type(exc).__name__,
                )

        if self._exists(self.backup_path):
            found_stored_data = True
            try:
                recovered = self._parse_path(self.backup_path, parser)
            except _READ_ERRORS as exc:
                self.logger.warning(
                    "%s yedeği de okunamadı [tür=%s]",
                    self.label,
                    type(exc).__name__,
                )
            else:
                try:
                    self._replace_from_bytes(self.backup_path.read_bytes())
                except OSError as exc:
                    # The validated in-memory value is still safe to use.  A
                    # later mutation will retry and refuse data loss if needed.
                    self.logger.warning(
                        "%s birincil kopyası onarılamadı [tür=%s]",
                        self.label,
                        type(exc).__name__,
                    )
                else:
                    self.logger.info("%s güvenli yedekten kurtarıldı", self.label)
                return recovered

        if for_update and found_stored_data:
            raise StoreRecoveryError(
                f"{self.label} bozuk ve geçerli yedeği yok; veri kaybını önlemek için işlem durduruldu."
            )
        return default_factory()

    def write(self, payload: object, parser: Parser[T]) -> None:
        """Validate and atomically write payload, preserving a valid primary."""

        parser(payload)
        encoded = (
            json.dumps(
                payload,
                ensure_ascii=False,
                indent=2,
                allow_nan=False,
            )
            + "\n"
        ).encode("utf-8")
        if len(encoded) > self.max_bytes:
            raise ValueError(f"{self.label} izin verilen boyutu aşıyor")

        # Ensure an invalid primary cannot silently become the backup or be
        # overwritten.  ``load`` also self-heals from a valid backup.
        self.load(parser, lambda: parser(payload), for_update=True)
        self._ensure_private_parent()
        if self._exists(self.path):
            current = self.path.read_bytes()
            self._atomic_replace(self.backup_path, current, prefix=".backup-")
        self._atomic_replace(self.path, encoded, prefix=".store-")

    def restore_from_backup(self, parser: Parser[T]) -> bool:
        """Restore a valid backup without changing that backup."""

        if not self._exists(self.backup_path):
            return False
        try:
            self._parse_path(self.backup_path, parser)
            content = self.backup_path.read_bytes()
            self._replace_from_bytes(content)
        except _READ_ERRORS as exc:
            self.logger.warning(
                "%s yedeği geri yüklenemedi [tür=%s]",
                self.label,
                type(exc).__name__,
            )
            return False
        return True

    def _replace_from_bytes(self, content: bytes) -> None:
        self._ensure_private_parent()
        self._atomic_replace(self.path, content, prefix=".restore-")

    def _ensure_private_parent(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self.path.parent.chmod(0o700)
        except OSError:
            pass

    @staticmethod
    def _sync_parent(path: Path) -> None:
        if os.name == "nt":
            return
        try:
            descriptor = os.open(path, os.O_RDONLY)
        except OSError:
            return
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)

    def _atomic_replace(self, destination: Path, content: bytes, *, prefix: str) -> None:
        descriptor, temporary_name = tempfile.mkstemp(
            dir=destination.parent,
            prefix=prefix,
            suffix=".tmp",
        )
        temporary_path = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            try:
                temporary_path.chmod(0o600)
            except OSError:
                pass
            os.replace(temporary_path, destination)
            try:
                destination.chmod(0o600)
            except OSError:
                pass
            self._sync_parent(destination.parent)
        finally:
            temporary_path.unlink(missing_ok=True)
