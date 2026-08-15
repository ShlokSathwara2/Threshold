import re
from bs4 import BeautifulSoup

from core.constants import (
    ATTENDANCE_TABLE_MARKER,
    COURSE_TABLE_MARKER,
    USER_TABLE_MARKER,
)


def extract_section_html(page_html: str, section: str) -> str:
    """Extract a specific HTML section from an Academia page."""
    soup = BeautifulSoup(page_html, "lxml")

    if section == "attendance":
        return _extract_between_tables(soup, ATTENDANCE_TABLE_MARKER)
    elif section == "course":
        return _extract_between_tables(soup, COURSE_TABLE_MARKER)
    elif section == "user":
        return _extract_between_tables(soup, USER_TABLE_MARKER)
    elif section == "marks":
        return _extract_marks_fragment(page_html)
    return page_html


def _extract_between_tables(soup: BeautifulSoup, marker: str) -> str:
    """Find the table matching the marker and return its HTML."""
    marker_soup = BeautifulSoup(marker, "lxml")
    target = marker_soup.find("table")
    if not target:
        return ""

    for table in soup.find_all("table"):
        attrs_match = True
        for key, val in target.attrs.items():
            if key == "style":
                continue
            if table.get(key) != val:
                attrs_match = False
                break
        if attrs_match:
            return str(table)
    return ""


def _extract_marks_fragment(page_html: str) -> str:
    """Extract the marks section from the attendance page."""
    parts = page_html.split("</table></td>")
    marks_parts = []
    for part in parts:
        if "Internal" in part or "Mark" in part or ".00" in part:
            marks_parts.append(part + "</table></td>")
    return "".join(marks_parts) if marks_parts else ""


def extract_reg_number(html: str) -> str:
    """Extract registration number from page HTML."""
    match = re.search(r"Reg\s*Number\s*[:\-]\s*(\d{10,})", html)
    if match:
        return match.group(1)
    match = re.search(r"(\d{2}[A-Z0-9]{8,})", html)
    return match.group(1) if match else ""


def decode_hex_html(encoded: str) -> str:
    """Decode hex-encoded HTML entities from calendar pages."""
    decoded = encoded
    for match in re.finditer(r"&#x([0-9a-fA-F]+);", encoded):
        hex_val = match.group(1)
        char = chr(int(hex_val, 16))
        decoded = decoded.replace(match.group(0), char)
    return decoded
