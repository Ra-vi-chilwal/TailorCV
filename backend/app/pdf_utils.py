import io
import re

from pypdf import PdfReader

from app.core import messages
from app.core.config import settings


class PDFExtractionError(Exception):
    """Raised when we can't get usable text out of a PDF. The message is safe to show the user."""


# Less text than this probably means a scanned/image PDF
MIN_TEXT_LENGTH = 50


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Take the raw bytes of an uploaded PDF and return clean text."""
    if not file_bytes:
        raise PDFExtractionError(messages.EMPTY_FILE)
    if not file_bytes.lstrip()[:5] == b"%PDF-":          # real PDFs start with this signature
        raise PDFExtractionError(messages.BAD_PDF)

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            raise PDFExtractionError(messages.LOCKED_PDF)
        n_pages = len(reader.pages)
        if n_pages > settings.max_pdf_pages:
            raise PDFExtractionError(messages.TOO_MANY_PAGES.format(pages=n_pages, max=settings.max_pdf_pages))
        pages = [page.extract_text() or "" for page in reader.pages]
    except PDFExtractionError:
        raise
    except Exception as e:                                # corrupt / hostile files raise many error types
        raise PDFExtractionError(messages.BAD_PDF) from e

    text = clean_text("\n".join(pages))

    if len(text) < MIN_TEXT_LENGTH:
        raise PDFExtractionError(messages.SCANNED_PDF)
    return text[: settings.max_resume_chars]              # cap what we ever send to the LLM


def clean_text(text: str) -> str:
    """Tidy up messy spacing that PDFs often produce."""
    text = text.replace("\x00", "")           # remove invisible 'null' characters
    text = re.sub(r"[ \t]+", " ", text)       # many spaces/tabs -> one space
    text = re.sub(r"\n{3,}", "\n\n", text)    # 3+ blank lines -> just one blank line
    return text.strip()                       # remove spaces at start and end
