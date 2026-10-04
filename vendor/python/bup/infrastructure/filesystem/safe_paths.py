# -*- coding: utf-8 -*-
"""Shared filesystem boundaries for untrusted inputs and user-chosen outputs.

Every reader and exporter in the app enforces the same rules: refuse symlinks,
refuse ``..`` traversal, keep the destination inside the directory the user
actually chose, and require explicit consent before overwriting.  The logic
lives here once so a fix reaches every caller; each caller supplies its own
typed exception classes so users still get a message in their own vocabulary.
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from pathlib import Path

__all__ = [
    "SafePathError",
    "DestinationExistsError",
    "reject_symlink_chain",
    "requested_path",
    "validated_directory",
    "validated_file_destination",
    "validated_input_file",
]


class SafePathError(ValueError):
    """A path is missing, unsafe, or outside the permitted boundary."""


class DestinationExistsError(SafePathError):
    """The destination exists and the caller did not consent to overwriting."""


def reject_symlink_chain(path: Path, *, error: type[Exception], message: str) -> None:
    """Refuse a path whose own name or any ancestor is a symlink."""

    current = path
    while True:
        if current.is_symlink():
            raise error(message)
        if current == current.parent:
            return
        current = current.parent


def requested_path(
    value: str | Path,
    *,
    error: type[Exception],
    message: str,
    traversal_message: str | None = None,
) -> Path:
    """Expand ``~`` and reject traversal before the path touches the disk.

    Traversal gets its own message by default: "this path is invalid" and "this
    path tries to escape the folder you chose" are different things to be told.
    """

    try:
        requested = Path(value).expanduser()
    except (OSError, TypeError, ValueError) as exc:
        raise error(message) from exc
    if ".." in requested.parts:
        raise error(traversal_message or message)
    return requested


def validated_directory(
    directory: str | Path,
    *,
    error: type[Exception],
    invalid_message: str,
    missing_message: str,
    symlink_message: str,
    traversal_message: str | None = None,
) -> Path:
    """Resolve an existing, non-symlink, user-selected output directory."""

    requested = requested_path(
        directory,
        error=error,
        message=invalid_message,
        traversal_message=traversal_message,
    )
    try:
        absolute = Path(os.path.abspath(requested))
        reject_symlink_chain(absolute, error=error, message=symlink_message)
        if not absolute.exists() or not absolute.is_dir():
            raise error(missing_message)
        return absolute.resolve(strict=True)
    except error:
        raise
    except (OSError, RuntimeError, ValueError) as exc:
        raise error(invalid_message) from exc


def validated_file_destination(
    destination: str | Path,
    *,
    suffix: str,
    overwrite: bool,
    error: type[Exception],
    exists_error: type[Exception],
    invalid_message: str,
    missing_message: str,
    symlink_message: str,
    outside_message: str,
    not_a_file_message: str,
    exists_message: str,
    traversal_message: str | None = None,
) -> Path:
    """Resolve a writable destination that stays inside its parent directory."""

    requested = requested_path(
        destination,
        error=error,
        message=invalid_message,
        traversal_message=traversal_message,
    )
    if requested.suffix.lower() != suffix:
        requested = requested.with_suffix(suffix)
    try:
        absolute = Path(os.path.abspath(requested))
        reject_symlink_chain(absolute, error=error, message=symlink_message)
        parent = validated_directory(
            absolute.parent,
            error=error,
            invalid_message=invalid_message,
            missing_message=missing_message,
            symlink_message=symlink_message,
            traversal_message=traversal_message,
        )
        resolved = (parent / absolute.name).resolve(strict=False)
        if resolved.parent != parent:
            raise error(outside_message)
        if resolved.exists():
            if resolved.is_symlink() or not resolved.is_file():
                raise error(not_a_file_message)
            if not overwrite:
                raise exists_error(exists_message)
        return resolved
    except (error, exists_error):
        raise
    except (OSError, RuntimeError, ValueError) as exc:
        raise error(invalid_message) from exc


def validated_input_file(
    path: str | Path,
    *,
    suffixes: Sequence[str],
    magic: bytes,
    max_bytes: int,
    error: type[Exception],
    symlink_message: str,
    missing_message: str,
    suffix_message: str,
    unreadable_message: str,
    oversize_message: str,
    magic_message: str,
) -> Path:
    """Validate an untrusted input by kind, size, and leading magic bytes.

    Extension alone is not evidence: the content must start with ``magic`` too.
    """

    candidate = requested_path(path, error=error, message=missing_message)
    if candidate.is_symlink():
        raise error(symlink_message)
    if not candidate.exists() or not candidate.is_file():
        raise error(missing_message)
    if candidate.suffix.lower() not in {s.lower() for s in suffixes}:
        raise error(suffix_message)
    try:
        size = candidate.stat().st_size
        with candidate.open("rb") as stream:
            head = stream.read(len(magic))
    except OSError as exc:
        raise error(unreadable_message) from exc
    if size > max_bytes:
        raise error(oversize_message)
    if magic and head != magic:
        raise error(magic_message)
    return candidate
