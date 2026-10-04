# -*- coding: utf-8 -*-
"""Race-safe publication of a fully staged export file."""

from __future__ import annotations

import os
from pathlib import Path


def fsync_parent(path: Path) -> None:
    """Best-effort directory sync after a directory-entry change."""

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


def publish_staged_file(
    temporary_path: Path,
    destination: Path,
    *,
    overwrite: bool,
) -> None:
    """Publish atomically, using a no-clobber link without overwrite consent.

    The staged file must live beside the destination. ``os.link`` is an atomic
    create-if-absent operation on both supported platforms and therefore closes
    the ``exists()``/``replace()`` race. The caller owns and removes the staged
    name after this function returns.
    """

    if temporary_path.parent != destination.parent:
        raise OSError("Staged export and destination must share a directory.")
    if overwrite:
        os.replace(temporary_path, destination)
    else:
        os.link(temporary_path, destination)
    try:
        destination.chmod(0o600)
    except OSError:
        pass
    fsync_parent(destination.parent)
