from flask import Flask, request, jsonify, send_from_directory
from flask_caching import Cache
from flask_cors import CORS
import anthropic
import requests
from functools import wraps
import hashlib
from datetime import datetime
import logging
from config import Config
from xml.etree import ElementTree

# Configure logging
logging.basicConfig(level=Config.LOG_LEVEL)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure caching
app.config.from_mapping(Config.CACHE_CONFIG)
cache = Cache(app)

# Initialize Anthropic client
try:
    client = anthropic.Client(api_key=Config.ANTHROPIC_API_KEY)
except Exception as e:
    logger.error(f"Failed to initialize Anthropic client: {e}")
    client = None


def validate_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not Config.ANTHROPIC_API_KEY:
            return (
                jsonify(
                    {
                        "error": "No API key configured",
                        "details": "Please set the ANTHROPIC_API_KEY environment variable",
                    }
                ),
                500,
            )
        if not client:
            return (
                jsonify(
                    {
                        "error": "API client not initialized",
                        "details": "Failed to initialize Anthropic client",
                    }
                ),
                500,
            )
        return f(*args, **kwargs)

    return decorated_function


def get_cache_key(prompt):
    """Generate a cache key from the prompt"""
    return f"{Config.CACHE_CONFIG['CACHE_KEY_PREFIX']}summary_{hashlib.md5(prompt.encode()).hexdigest()}"


def check_first_edit(changeset_id):
    """
    Server-side verification of whether this is a user's first edit.
    Returns (is_first_edit, error_message)
    """
    if Config.OVERRIDE_FIRST_EDIT:
        return True, None
    try:
        # First get the changeset to find the user ID
        changeset_url = (
            f"https://api.openstreetmap.org/api/0.6/changeset/{changeset_id}"
        )
        changeset_response = requests.get(changeset_url)
        if not changeset_response.ok:
            return False, "Failed to fetch changeset data"

        # Parse the XML
        changeset_tree = ElementTree.fromstring(changeset_response.content)
        changeset = changeset_tree.find("changeset")
        if changeset is None:
            return False, "Invalid changeset data"

        uid = changeset.get("uid")
        if not uid:
            return False, "Could not determine user ID"

        # Get user's changesets
        user_changesets_url = (
            f"https://api.openstreetmap.org/api/0.6/changesets?user={uid}"
        )
        user_response = requests.get(user_changesets_url)
        if not user_response.ok:
            return False, "Failed to fetch user changesets"

        # Parse the changesets XML
        changesets_tree = ElementTree.fromstring(user_response.content)
        changesets = changesets_tree.findall(".//changeset")

        # Check if this is their first edit
        logger.info(f"checking changeset {changeset_id}")
        is_first = changeset_id in [changeset.get("id") for changeset in changesets]
        logger.info(is_first)
        return is_first, None

    except Exception as e:
        logger.error(f"Error checking first edit: {e}")
        return False, str(e)


@app.route("/")
def serve_index():
    """Serve the static index.html file"""
    return send_from_directory("static", "index.html")


@app.route("/api/summarize", methods=["POST"])
@validate_api_key
def summarize_changeset():
    try:
        data = request.get_json()
        if not data or "prompt" not in data or "changeset_id" not in data:
            return (
                jsonify(
                    {
                        "error": "Invalid request",
                        "details": "Missing prompt or changeset_id in request body",
                    }
                ),
                400,
            )

        changeset_id = data["changeset_id"]
        prompt = data["prompt"]

        # Check first edit status
        cache_key = f"first_edit_{changeset_id}"
        is_first_edit = cache.get(cache_key)

        if is_first_edit is None:
            # Not in cache, check OSM API
            is_first_edit, error = check_first_edit(changeset_id)
            if error:
                return (
                    jsonify(
                        {"error": "Failed to verify edit status", "details": error}
                    ),
                    400,
                )

            # Cache the result
            cache.set(cache_key, is_first_edit)

        # Always enforce first edit check, regardless of cache status
        if not is_first_edit:
            return (
                jsonify(
                    {
                        "error": "Not first edit",
                        "details": "This page is only for first-time editors",
                    }
                ),
                403,
            )

        # Check for cached summary
        summary_cache_key = get_cache_key(prompt)
        cached_response = cache.get(summary_cache_key)
        if cached_response:
            logger.info(f"Cache hit for key: {summary_cache_key}")
            return jsonify({"summary": cached_response, "cached": True})

        logger.info(f"Cache miss for key: {summary_cache_key}")

        # Get response from Claude
        try:
            response = client.messages.create(
                model=Config.ANTHROPIC_MODEL,
                max_tokens=150,
                temperature=0.7,
                system=Config.SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            summary = response.content[0].text

            if not summary:
                raise ValueError("Empty response received from API")

            # Cache the response
            cache.set(summary_cache_key, summary)

            return jsonify({"summary": summary, "cached": False, "changeset_id": changeset_id})

        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {e}")
            return jsonify({"error": "API error", "details": str(e)}), 500

    except Exception as e:
        logger.error(f"Unexpected error in summarize_changeset: {e}")
        return jsonify({"error": "Server error", "details": str(e)}), 500


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint that validates API key, cache, and OSM API status"""
    status = {
        "timestamp": datetime.utcnow().isoformat(),
        "api_key_configured": bool(Config.ANTHROPIC_API_KEY),
        "cache_enabled": bool(cache.get("health_check")),
        "client_initialized": bool(client),
    }

    # Test cache
    cache.set("health_check", "ok")
    status["cache_working"] = cache.get("health_check") == "ok"

    # Check OSM API
    try:
        osm_response = requests.get(
            "https://api.openstreetmap.org/api/0.6/capabilities"
        )
        status["osm_api_status"] = osm_response.ok
    except Exception:
        status["osm_api_status"] = False

    if not all(
        [
            status["api_key_configured"],
            status["client_initialized"],
            status["cache_working"],
            status["osm_api_status"],
        ]
    ):
        return jsonify(status), 500

    return jsonify(status), 200


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Server error", "details": str(e)}), 500


if __name__ == "__main__":
    # Validate configuration before starting
    Config.is_valid()

    app.run(host=Config.FLASK_HOST, port=Config.FLASK_PORT, debug=Config.FLASK_DEBUG)
