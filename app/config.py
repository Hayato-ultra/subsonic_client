import os
import sys
from pathlib import Path


class ConfigError(Exception):
    pass


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(f"Missing required environment variable: {name}")
    return value


# ------------------------------------------------------------------
# Lightweight .env loader – works even when python‑dotenv is not installed.
# ------------------------------------------------------------------
def _load_env_file() -> None:
    """Read a .env file from the project root and set os.environ entries."""
    # Project root is two directories up from app/config.py
    project_root = Path(__file__).resolve().parent.parent
    env_path = project_root / ".env"
    if not env_path.is_file():
        return
    try:
        with env_path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                # Only set if not already defined – CLI/env take precedence
                os.environ.setdefault(key, value)
    except Exception as e:  # pragma: no cover
        print(f"Warning: could not load .env file: {e}", file=sys.stderr)


# ------------------------------------------------------------------
# Load .env before any settings are created
# ------------------------------------------------------------------
_load_env_file()


class Settings:
    def __init__(self) -> None:
        self.gonic_url = _require("GONIC_URL").rstrip("/")
        self.gonic_user = _require("GONIC_USER")
        self.gonic_password = _require("GONIC_PASSWORD")
        self.stream_bitrate = int(os.environ.get("STREAM_BITRATE", "320"))
        self.app_port = int(os.environ.get("APP_PORT", "8000"))
        self.app_host = os.environ.get("APP_HOST", "0.0.0.0")


def load_settings() -> Settings:
    try:
        return Settings()
    except ConfigError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
