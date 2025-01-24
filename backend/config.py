import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    # API Configuration
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    ANTHROPIC_MODEL = "claude-3-5-haiku-latest"  # https://docs.anthropic.com/en/docs/about-claude/models

    # Flask Configuration
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
    FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))

    # Cache Configuration
    CACHE_CONFIG = {
        "CACHE_TYPE": os.getenv("CACHE_TYPE", "simple"),
        "CACHE_DEFAULT_TIMEOUT": int(os.getenv("CACHE_DEFAULT_TIMEOUT", 3600)),
        "CACHE_THRESHOLD": int(os.getenv("CACHE_THRESHOLD", 1000)),
        "CACHE_KEY_PREFIX": "osm_welcome_",
    }

    # Logging Configuration
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    # System Prompt for Claude
    SYSTEM_PROMPT = """You are an encouraging assistant specializing in analyzing OpenStreetMap edits. 
    When describing edits:
    - Be specific about what was changed
    - Use positive, encouraging language
    - Keep responses short (2-3 sentences)
    - Include exactly one relevant emoji
    - Focus on the value the edit adds to the map
    - Mention specific features (buildings, roads, etc.) when possible
    """

    OVERRIDE_FIRST_EDIT = os.getenv("OVERRIDE_FIRST_EDIT")

    AWS_CHANGES_ENDPOINT = "https://real-changesets.s3.us-west-2.amazonaws.com"

    @classmethod
    def is_valid(cls):
        """Validate the configuration"""
        if not cls.ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")

        if not isinstance(cls.CACHE_CONFIG["CACHE_DEFAULT_TIMEOUT"], int):
            raise ValueError("CACHE_DEFAULT_TIMEOUT must be an integer")

        if not isinstance(cls.CACHE_CONFIG["CACHE_THRESHOLD"], int):
            raise ValueError("CACHE_THRESHOLD must be an integer")

        return True
