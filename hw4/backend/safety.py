"""Sensitive-info shield for chat messages.

Runs on every chat message before it reaches the AI model or the database. It
removes things a shopper should never paste into a store chat:

- payment card numbers (13-19 digits that pass the Luhn checksum)
- card security codes ("cvv 123")
- US Social Security numbers (123-45-6789)
- passwords ("my password is ...")

Deterministic regexes, so it costs no model call and can't be talked out of it.
"""

from __future__ import annotations

import re

_CARD = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
_CVV = re.compile(r"(?i)\b(cvv|cvc|cvv2|security code)\b(\s*(?:is|:|=|-)?\s*)\d{3,4}\b")
_SSN = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")
_PASSWORD = re.compile(r"(?i)\b(password|passcode|passwd|pwd)\b(\s*(?:is|:|=)\s*)(\S+)")


def _luhn_ok(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def shield(text: str) -> tuple[str, list[str]]:
    """Return (cleaned text, kinds of info removed). Kinds are listed once each."""
    found: list[str] = []

    def note(kind: str) -> None:
        if kind not in found:
            found.append(kind)

    def card(match: re.Match) -> str:
        digits = re.sub(r"\D", "", match.group(0))
        if 13 <= len(digits) <= 19 and _luhn_ok(digits):
            note("card number")
            return "[card number removed]"
        return match.group(0)

    def cvv(match: re.Match) -> str:
        note("card security code")
        return f"{match.group(1)}{match.group(2)}[removed]"

    def ssn(_match: re.Match) -> str:
        note("Social Security number")
        return "[SSN removed]"

    def password(match: re.Match) -> str:
        note("password")
        return f"{match.group(1)}{match.group(2)}[removed]"

    cleaned = _CARD.sub(card, text)
    cleaned = _CVV.sub(cvv, cleaned)
    cleaned = _SSN.sub(ssn, cleaned)
    cleaned = _PASSWORD.sub(password, cleaned)
    return cleaned, found
