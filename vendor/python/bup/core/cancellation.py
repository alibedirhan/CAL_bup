# -*- coding: utf-8 -*-
"""Thread-safe cooperative cancellation primitives shared across layers."""

from __future__ import annotations

from collections.abc import Callable
from threading import Event

Checkpoint = Callable[[], None]


class OperationCancelled(RuntimeError):
    """Raised at a cooperative checkpoint after cancellation is requested."""


class CancellationToken:
    """A small thread-safe cancellation flag checked by long-running work."""

    def __init__(self) -> None:
        self._event = Event()

    @property
    def is_cancelled(self) -> bool:
        return self._event.is_set()

    def cancel(self) -> None:
        """Request cancellation. Repeated requests are harmless."""

        self._event.set()

    def checkpoint(self) -> None:
        """Raise when cancellation has been requested; otherwise return."""

        if self._event.is_set():
            raise OperationCancelled("Operation cancelled.")


def run_checkpoint(checkpoint: Checkpoint | None) -> None:
    """Invoke an optional checkpoint without swallowing cancellation."""

    if checkpoint is not None:
        checkpoint()
