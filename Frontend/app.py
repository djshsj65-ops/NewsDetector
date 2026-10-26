import ipaddress
import math
import socket
from pathlib import Path
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

import joblib
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

FRONTEND_DIR = Path(__file__).resolve().parent

model = joblib.load(FRONTEND_DIR / "model.pkl")
vectorizer = joblib.load(FRONTEND_DIR / "vectorizer.pkl")
MAX_PAGE_BYTES = 1_000_000
UNCERTAIN_MARGIN_THRESHOLD = math.log(1.25)


class ArticleTextParser(HTMLParser):
    ignored_tags = {"script", "style", "noscript", "svg", "nav", "header", "footer", "aside", "form"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ignored = []
        self.parts = []
        self.title_parts = []
        self.title_meta = ""
        self.publisher = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)

        if tag == "meta":
            key = (attributes.get("property") or attributes.get("name") or "").lower()
            content = (attributes.get("content") or "").strip()

            if key in {"og:title", "twitter:title"} and content and not self.title_meta:
                self.title_meta = content
            elif key in {"og:site_name", "application-name"} and content and not self.publisher:
                self.publisher = content

        if tag == "title":
            self.in_title = True
            return

        if self.ignored:
            if tag in self.ignored_tags:
                self.ignored.append(tag)
        elif tag in self.ignored_tags:
            self.ignored.append(tag)

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
            return

        if self.ignored and tag == self.ignored[-1]:
            self.ignored.pop()

    def handle_data(self, data):
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
        "url": final_url,
        "preview": article_text[:500]
    }


@app.route("/")
def home():
    return jsonify({
        "message": "Fake News Detection API is running!"
    })


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

        result = {
            "prediction": bool(prediction == 1),
            "uncertain": margin < UNCERTAIN_MARGIN_THRESHOLD,
            "word_count": len(news_text.split())
        }

        if article_details:
            result["article"] = {
                "title": article_details["title"],
                "publisher": article_details["publisher"],
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