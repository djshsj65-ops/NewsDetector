import ipaddress
import json
import math
import socket
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

import joblib
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Load trained model
model = joblib.load("model.pkl")

# Load TF-IDF vectorizer
vectorizer = joblib.load("vectorizer.pkl")
MAX_PAGE_BYTES = 1_000_000
UNCERTAIN_MARGIN_THRESHOLD = math.log(1.25)


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
    ignored_tags = {"script", "style", "noscript", "svg", "nav", "header", "footer", "aside", "form"}

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
            elif key in {"author", "article:author", "citation_author", "parsely-author"} and content and not self.author:
                self.author = content[:160]

        if tag == "script" and attributes.get("type", "").split(";", 1)[0].strip().lower() == "application/ld+json":
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
        "preview": article_text[:500]
    }


@app.route("/")
def home():
    return send_from_directory(app.root_path, "index.html")


@app.route("/style.css")
def styles():
    return send_from_directory(app.root_path, "style.css")


@app.route("/script.js")
def javascript():
    return send_from_directory(app.root_path, "script.js")


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

        # Convert news text into TF-IDF
        text_vector = vectorizer.transform([news_text])

        prediction = model.predict(text_vector)[0]
        margin = abs(float(model.decision_function(text_vector)[0]))
        confidence = round(50 + 50 * (1 - math.exp(-margin)))

        result = {
            "prediction": bool(prediction == 1),
            "uncertain": margin < UNCERTAIN_MARGIN_THRESHOLD,
            "confidence": confidence,
            "word_count": len(news_text.split())
        }

        if article_details:
            result["article"] = {
                "title": article_details["title"],
                "publisher": article_details["publisher"],
                "author": article_details["author"],
                "url": article_details["url"],
                "preview": article_details["preview"]
            }

        return jsonify(result)

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)