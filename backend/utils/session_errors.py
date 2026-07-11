"""Session store errors shared by Redis helpers and interview services."""


class SessionConflictError(Exception):
    """Raised when optimistic session update retries are exhausted."""
