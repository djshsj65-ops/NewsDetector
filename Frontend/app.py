import ipaddress
import json
import math
import os
import re
import socket
import sqlite3
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

import joblib
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge

from database import (
    clear_investigations,
    get_investigations,
    initialize_database,
    save_investigation,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 128_000

FRONTEND_DIR = Path(__file__).resolve().parent
model = joblib.load(FRONTEND_DIR / "model.pkl")
confidence_model = joblib.load(FRONTEND_DIR / "confidence_model.pkl")
vectorizer = joblib.load(FRONTEND_DIR / "vectorizer.pkl")

MAX_PAGE_BYTES = 1_000_000
MAX_INPUT_CHARS = 20_000
UNCERTAIN_MARGIN_THRESHOLD = math.log(1.25)
NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "").strip()


initialize_database()


def find_author_metadata(value):
    if isinstance(value, list):
        for item in value:
            author = find_author_metadata(item)
            if author:
                return author
        return ""

    if not isinstance(value, dict):
        return ""

    author = value.get("author")
    if isinstance(author, str) and author.strip():
        return author.strip()
    if isinstance(author, dict):
        name = author.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
    if isinstance(author, list):
        author_name = find_author_metadata(author)
        if author_name:
            return author_name

    for child in value.values():
        author_name = find_author_metadata(child)
        if author_name:
            return author_name

    return ""


class ArticleTextParser(HTMLParser):
    ignored_tags = {
        "script",
        "style",
        "noscript",
        "svg",
        "nav",
        "header",
        "footer",
        "aside",
        "form",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ignored = []
        self.parts = []
        self.title_parts = []
        self.title_meta = ""
        self.publisher = ""
        self.author = ""
        self.in_title = False
        self.in_json_ld = False
        self.json_ld_parts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)

        if tag == "meta":
            key = (attributes.get("property") or attributes.get("name") or "").lower()
            content = (attributes.get("content") or "").strip()

            if key in {"og:title", "twitter:title"} and content and not self.title_meta:
                self.title_meta = content
            elif key in {"og:site_name", "application-name"} and content and not self.publisher:
                self.publisher = content
            elif (
                key in {"author", "article:author", "citation_author", "parsely-author"}
                and content
                and not self.author
            ):
                self.author = content[:160]

        is_json_ld = (
            attributes.get("type", "").split(";", 1)[0].strip().lower()
            == "application/ld+json"
        )
        if tag == "script" and is_json_ld:
            self.in_json_ld = True
            self.json_ld_parts = []
            return

        if tag == "title":
            self.in_title = True
            return

        if self.ignored:
            if tag in self.ignored_tags:
                self.ignored.append(tag)
        elif tag in self.ignored_tags:
            self.ignored.append(tag)

    def handle_endtag(self, tag):
        if tag == "script" and self.in_json_ld:
            try:
                json_data = json.loads("".join(self.json_ld_parts))
                self.author = self.author or find_author_metadata(json_data)[:160]
            except (json.JSONDecodeError, TypeError):
                pass
            self.in_json_ld = False
            self.json_ld_parts = []
            return

        if tag == "title":
            self.in_title = False
            return

        if self.ignored and tag == self.ignored[-1]:
            self.ignored.pop()

    def handle_data(self, data):
        if self.in_json_ld:
            self.json_ld_parts.append(data)
            return

        text = data.strip()
        if text and self.in_title:
            self.title_parts.append(text)
        elif text and not self.ignored:
            self.parts.append(text)


def validate_public_url(url):
    parsed = urlparse(url)

    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Use a complete public http:// or https:// article URL.")

    if parsed.username or parsed.password:
        raise ValueError("URLs containing login credentials are not supported.")

    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as error:
        raise ValueError("The URL contains an invalid port.") from error

    if port not in {80, 443}:
        raise ValueError("Only public websites on standard HTTP/HTTPS ports are supported.")

    host = parsed.hostname.rstrip(".")
    try:
        addresses = [ipaddress.ip_address(host)]
    except ValueError:
        try:
            records = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except socket.gaierror as error:
            raise ValueError("The website address could not be resolved.") from error
        addresses = [ipaddress.ip_address(record[4][0]) for record in records]

    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("Local and private network addresses cannot be analyzed.")


class PublicRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        validate_public_url(new_url)
        return super().redirect_request(request, response, code, message, headers, new_url)


def fetch_article_text(url):
    validate_public_url(url)
    request = Request(
        url,
        headers={"User-Agent": "NewsDetector/1.0", "Accept": "text/html"},
    )

    with build_opener(PublicRedirectHandler).open(request, timeout=8) as response:
        if response.headers.get_content_type() not in {"text/html", "application/xhtml+xml"}:
            raise ValueError("That URL does not return an HTML article page.")

        content = response.read(MAX_PAGE_BYTES + 1)
        final_url = response.geturl()

    if len(content) > MAX_PAGE_BYTES:
        content = content[:MAX_PAGE_BYTES]

    charset = response.headers.get_content_charset() or "utf-8"
    html = content.decode(charset, errors="replace")
    parser = ArticleTextParser()
    parser.feed(html)
    article_text = " ".join(parser.parts)

    if len(article_text) < 40:
        raise ValueError("Not enough readable article text was found at that URL.")

    page_title = parser.title_meta or " ".join(parser.title_parts).strip()
    publisher = parser.publisher or urlparse(final_url).hostname or "Unknown publisher"

    return {
        "text": article_text,
        "title": page_title[:200] or "Untitled article",
        "publisher": publisher[:120],
        "author": parser.author,
        "url": final_url,
        "preview": article_text[:500],
    }


def search_related_news(query):
    if not NEWSAPI_KEY:
        return {
            "available": False,
            "provider": "NewsAPI",
            "message": "Set the NEWSAPI_KEY environment variable to load related news articles.",
            "articles": [],
        }

    params = urlencode(
        {
            "q": query[:200],
            "language": "en",
            "sortBy": "relevancy",
            "pageSize": 5,
        }
    )
    request = Request(
        f"https://newsapi.org/v2/everything?{params}",
        headers={"X-Api-Key": NEWSAPI_KEY, "User-Agent": "NewsDetector/1.0"},
    )

    try:
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read(500_000).decode("utf-8"))
    except HTTPError as error:
        app.logger.warning("NewsAPI returned HTTP %s", error.code)
        return {
            "available": False,
            "provider": "NewsAPI",
            "message": "NewsAPI could not provide related articles. Check the API key or try again later.",
            "articles": [],
        }
    except (URLError, TimeoutError, socket.timeout, OSError, UnicodeDecodeError, json.JSONDecodeError):
        app.logger.exception("Could not retrieve related articles from NewsAPI")
        return {
            "available": False,
            "provider": "NewsAPI",
            "message": "Related articles could not be retrieved right now.",
            "articles": [],
        }

    if (
        not isinstance(payload, dict)
        or payload.get("status") != "ok"
        or not isinstance(payload.get("articles"), list)
    ):
        app.logger.warning("NewsAPI did not return a successful search status")
        return {
            "available": False,
            "provider": "NewsAPI",
            "message": "NewsAPI could not provide related articles. Check the API key or try again later.",
            "articles": [],
        }

    articles = []
    for item in payload.get("articles", [])[:5]:
        if not isinstance(item, dict):
            continue
        article_url = item.get("url")
        if not isinstance(article_url, str):
            continue
        parsed_url = urlparse(article_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.hostname:
            continue
        source = item.get("source") or {}
        articles.append(
            {
                "title": str(item.get("title") or "Untitled article")[:300],
                "publisher": str(source.get("name") or "Unknown publisher")[:120],
                "published_at": str(item.get("publishedAt") or "")[:40],
                "url": article_url,
                "description": str(item.get("description") or "")[:500],
            }
        )

    return {
        "available": True,
        "provider": "NewsAPI",
        "message": "Related news coverage only. These articles are not a fact-check verdict.",
        "articles": articles,
    }


@app.route("/")
def home():
    return send_from_directory(app.root_path, "index.html")


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "news-detector-api"})


@app.route("/style.css")
def styles():
    return send_from_directory(app.root_path, "style.css")


@app.route("/script.js")
def javascript():
    return send_from_directory(app.root_path, "script.js")


@app.route("/app/")
def frontend():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/app/<path:filename>")
def frontend_assets(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict) or "text" not in data:
            return jsonify({
                "error": "No news text or article URL provided."
            }), 400

        supplied_text = data["text"]
        if not isinstance(supplied_text, str):
            return jsonify({"error": "Text or URL must be a string."}), 400

        supplied_text = supplied_text.strip()

        if not supplied_text:
            return jsonify({
                "error": "Text or URL cannot be empty."
            }), 400
        if len(supplied_text) > MAX_INPUT_CHARS:
            return jsonify({
                "error": f"Text or URL must be {MAX_INPUT_CHARS} characters or fewer."
            }), 400

        article_details = None
        if data.get("is_url"):
            try:
                article_details = fetch_article_text(supplied_text)
                news_text = article_details["text"]
            except ValueError as error:
                return jsonify({"error": str(error)}), 400
            except HTTPError as error:
                if error.code in {401, 403}:
                    message = "This website requires login or blocks automated access. Open the article and paste its text instead."
                elif error.code == 429:
                    message = "This website is temporarily limiting requests. Try again later or paste the article text."
                else:
                    message = f"The website refused the request (HTTP {error.code}). Paste the article text instead."
                return jsonify({"error": message}), 502
            except (URLError, TimeoutError, socket.timeout, OSError) as error:
                return jsonify({"error": f"Could not retrieve the article: {error}"}), 502
        else:
            news_text = supplied_text

        model_text = re.sub(
            r"\s+",
            " ",
            unicodedata.normalize("NFKC", news_text),
        ).strip().casefold()
        text_vector = vectorizer.transform([model_text])

        prediction = model.predict(text_vector)[0]
        margin = abs(float(model.decision_function(text_vector)[0]))
        probabilities = confidence_model.predict_proba(text_vector)[0]
        prediction_class_index = list(confidence_model.classes_).index(prediction)

        result = {
            "prediction": bool(prediction == 1),
            "uncertain": margin < UNCERTAIN_MARGIN_THRESHOLD,
            "confidence": float(probabilities[prediction_class_index]),
            "word_count": len(news_text.split()),
        }

        if article_details:
            result["article"] = {
                "title": article_details["title"],
                "publisher": article_details["publisher"],
                "author": article_details["author"],
                "url": article_details["url"],
                "preview": article_details["preview"],
            }

        search_query = article_details["title"] if article_details else news_text
        result["evidence"] = search_related_news(search_query)

        result_label = (
            "UNCERTAIN"
            if result["uncertain"]
            else "LIKELY REAL"
            if result["prediction"]
            else "LIKELY FAKE"
        )
        result["history_id"] = save_investigation(
            input_text=supplied_text,
            prediction=result_label,
            uncertain=result["uncertain"],
            word_count=result["word_count"],
            article=article_details,
            evidence=result["evidence"]["articles"],
        )

        return jsonify(result)

    except sqlite3.Error:
        app.logger.exception("Could not save prediction history")
        return jsonify({
            "error": "The prediction completed but could not be saved to history."
        }), 500


@app.errorhandler(RequestEntityTooLarge)
def request_too_large(error):
    app.logger.warning("Rejected oversized request: %s", error)
    return jsonify({
        "error": f"Request is too large. Keep input at or below {MAX_INPUT_CHARS} characters."
    }), 413


@app.errorhandler(500)
def internal_server_error(error):
    app.logger.error("Unhandled Flask internal error: %s", error)
    return jsonify({
        "error": "The server could not complete the request. Check the Flask terminal for details."
    }), 500


@app.route("/history", methods=["GET"])
def get_history():
    try:
        return jsonify(get_investigations())
    except sqlite3.Error:
        app.logger.exception("Could not read investigation history")
        return jsonify({"error": "Could not load investigation history."}), 500


@app.route("/history", methods=["DELETE"])
def clear_history():
    try:
        clear_investigations()
        return jsonify({"message": "Investigation history cleared."})
    except sqlite3.Error:
        app.logger.exception("Could not clear investigation history")
        return jsonify({"error": "Could not clear investigation history."}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)