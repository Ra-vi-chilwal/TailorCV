"""Every message a user can see from the API, in one place so the wording is easy to review."""

NOT_PDF = "Please upload a PDF file (.pdf)."
TOO_BIG = "That file is larger than {mb} MB. Please upload a smaller PDF."
TOO_MANY_PAGES = "That PDF has {pages} pages. Please upload a resume of {max} pages or fewer."
EMPTY_FILE = "The uploaded file is empty."
BAD_PDF = "This file is not a valid PDF."
LOCKED_PDF = "This PDF is password-protected. Please upload an unlocked copy."
SCANNED_PDF = "We couldn't find readable text. Is this a scanned (image) PDF? Please upload a text-based PDF."
JD_SHORT = "The job description is too short. Please paste the full description (at least {min} characters)."
JD_LONG = "The job description is too long (max {max:,} characters). Please paste only the role and requirements."

SESSION_GONE = "Your analysis expired or was not found. Please analyse your resume again."
TAILOR_LIMIT_SESSION = "You've already tailored this analysis {n} times. Please run a new analysis to continue."

# Free-tier protection. {wait} is a human string like "about 25 minutes".
LIMIT_HOUR = "You've reached the hourly limit for this free demo. Please try again in {wait}."
LIMIT_DAY = "You've used all of today's free runs. Your limit resets in {wait}, so please come back then."
LIMIT_GLOBAL = (
    "This free demo has reached its daily capacity for all users. It resets in {wait}. "
    "Please try again then. Thank you for your patience!"
)

AI_BUSY = "The AI service is busy right now. Please wait a minute and try again."
AI_FAILED = "The AI service failed. Please try again in a minute."
AI_KEY_MISSING = "The service is not configured yet. Please try again later."
SERVER_ERROR = "Something went wrong on our side. Please try again."
UNAVAILABLE = "The service is temporarily unavailable. Please try again shortly."


def human_wait(seconds: int) -> str:
    """'about 25 minutes', 'about 3 hours', 'less than a minute'."""
    if seconds < 60:
        return "less than a minute"
    if seconds < 3600:
        m = round(seconds / 60)
        return f"about {m} minute{'s' if m != 1 else ''}"
    h = round(seconds / 3600)
    return f"about {h} hour{'s' if h != 1 else ''}"
