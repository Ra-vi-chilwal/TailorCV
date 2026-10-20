from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Read variables from a .env file; ignore any extra ones we don't declare.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Secrets / connections
    groq_api_key: str = ""
    mongodb_uri: str = ""
    mongodb_db: str = "resume_builder"

    # Web
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    trust_proxy: bool = False          # True only behind Render/Nginx etc. (reads X-Forwarded-For)

    # Model + scoring (starting values, not tuned yet)
    # Models change: list what your key can use with GET https://api.groq.com/openai/v1/models
    llm_model: str = "openai/gpt-oss-20b"
    llm_max_output_tokens: int = 1200  # cap for short calls (extraction)
    llm_tailor_max_output_tokens: int = 4000  # tailoring writes a whole resume, and reasoning tokens count too
    llm_reasoning_effort: str = "low"  # gpt-oss "thinks" first; low = fewer hidden tokens, less quota
    debug_errors: bool = False         # True (in .env) = API errors also return the real reason. Dev only!
    llm_timeout_seconds: int = 40
    embed_model: str = "BAAI/bge-small-en-v1.5"
    semantic_threshold: float = 0.85   # similarity needed to call a skill "matched" (0.55 matched Kubernetes to Docker)
    guardrail_threshold: float = 0.85  # a tailored skill must be this close to a real one
    skill_weight: float = 0.6          # score = 60% skills ...
    experience_weight: float = 0.4     # ... + 40% experience
    pass_threshold: float = 0.6        # overall score needed to be "shortlisted"

    # Input limits (protect the free-tier token budget)
    max_upload_mb: int = 2
    max_pdf_pages: int = 3
    max_resume_chars: int = 12_000     # ~3k tokens
    max_jd_chars: int = 6_000          # ~1.5k tokens
    min_jd_chars: int = 100

    # Abuse limits. Fixed windows, counted per client IP.
    ip_analyze_per_hour: int = 5
    ip_analyze_per_day: int = 15
    ip_tailor_per_hour: int = 4
    ip_tailor_per_day: int = 10
    max_tailors_per_session: int = 3

    # Global daily caps for the WHOLE app (all users together), so one bad day can't empty the
    # free quota. Size them from your Groq limits: https://console.groq.com/settings/limits
    # Rough cost: analyze ~2 LLM calls (~4k tokens), tailor ~1-2 calls (~6k tokens).
    daily_analyze_cap: int = 60
    daily_tailor_cap: int = 30


# One shared instance: other files do `from app.core.config import settings`
settings = Settings()
