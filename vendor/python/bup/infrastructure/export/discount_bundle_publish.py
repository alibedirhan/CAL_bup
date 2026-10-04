# -*- coding: utf-8 -*-
"""Best-effort transactional publication for a staged discount export bundle."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
import os
from pathlib import Path
import tempfile

from infrastructure.export.atomic_publish import fsync_parent


@dataclass(frozen=True)
class StagedOutput:
    """One fully written output awaiting publication beside its destination."""

    temporary_path: Path
    destination: Path
    overwrite: bool


@dataclass
class _Publication:
    output: StagedOutput
    identity: tuple[int, int]
    backup_path: Path | None = None
    published: bool = False


def _identity(path: Path) -> tuple[int, int]:
    status = path.stat()
    return status.st_dev, status.st_ino


def _is_owned(path: Path, identity: tuple[int, int]) -> bool:
    try:
        return _identity(path) == identity
    except OSError:
        return False


def _backup_existing(destination: Path) -> Path | None:
    if not destination.exists():
        return None
    descriptor, backup_name = tempfile.mkstemp(
        dir=destination.parent,
        prefix=".discount-backup-",
        suffix=destination.suffix,
    )
    os.close(descriptor)
    backup = Path(backup_name)
    backup.unlink()
    try:
        os.link(destination, backup)
    except Exception:
        backup.unlink(missing_ok=True)
        raise
    return backup


def _rollback(publications: Sequence[_Publication]) -> None:
    for publication in reversed(publications):
        if not publication.published:
            continue
        output = publication.output
        if not _is_owned(output.destination, publication.identity):
            # Another process replaced the path after our publication. It is
            # no longer ours and must never be removed or overwritten.
            continue
        try:
            if publication.backup_path is not None:
                os.replace(publication.backup_path, output.destination)
            else:
                output.destination.unlink()
            fsync_parent(output.destination.parent)
        except OSError:
            # Preserve the original exception; cleanup remains best-effort.
            continue


def publish_staged_bundle(
    outputs: Sequence[StagedOutput],
    *,
    publish: Callable[[Path, Path], None],
) -> None:
    """Publish all staged outputs and safely roll back a partial publication.

    ``publish`` receives ``(temporary_path, destination)`` and owns the actual
    replace/no-clobber policy captured by each caller closure. No cancellation
    checkpoint belongs inside this commit phase.
    """

    publications = [
        _Publication(output=output, identity=_identity(output.temporary_path))
        for output in outputs
    ]
    try:
        for publication in publications:
            output = publication.output
            if output.overwrite:
                publication.backup_path = _backup_existing(output.destination)
            publish(output.temporary_path, output.destination)
            publication.published = True
    except Exception:
        _rollback(publications)
        raise
    finally:
        for publication in publications:
            if publication.backup_path is not None:
                publication.backup_path.unlink(missing_ok=True)
