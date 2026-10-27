"""SQLite storage for news-detector investigation history."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


DATABASE_PATH = Path(__file__).resolve().parent / "news_detector.sqlite3"


@contextmanager
def _connection():
    connection = sqlite3.connect(DATABASE_PATH)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database():
    """Create the investigation table if it does not already exist."""
    with _connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS investigations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                input_text TEXT NOT NULL,
                prediction TEXT NOT NULL,
                uncertain INTEGER NOT NULL,
                word_count INTEGER NOT NULL,
                article_title TEXT,
                article_publisher TEXT,
                article_url TEXT,
                evidence_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL
            )
            """
        )
        columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(investigations)")
        }
        if "evidence_json" not in columns:
            try:
                connection.execute(
                    "ALTER TABLE investigations ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]'"
                )
            except sqlite3.OperationalError as error:
                if "duplicate column name" not in str(error).lower():
                    raise


def save_investigation(
    input_text,
    prediction,
    uncertain,
    word_count,
    article=None,
    evidence=None,
):
    """Save a prediction and return the new investigation ID."""
    with _connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO investigations (
                input_text, prediction, uncertain, word_count,
                article_title, article_publisher, article_url, evidence_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                input_text,
                prediction,
                int(uncertain),
                word_count,
                article["title"] if article else None,
                article["publisher"] if article else None,
                article["url"] if article else None,
                json.dumps(evidence or [], ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        return cursor.lastrowid


def get_investigations(limit=100):
    """Return the most recent investigations, newest first."""
    with _connection() as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT id, input_text, prediction, uncertain, word_count,
                   article_title, article_publisher, article_url, evidence_json, created_at
            FROM investigations
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "text": row["input_text"],
            "prediction": row["prediction"],
            "uncertain": bool(row["uncertain"]),
            "word_count": row["word_count"],
            "article_title": row["article_title"],
            "article_publisher": row["article_publisher"],
            "article_url": row["article_url"],
            "evidence": json.loads(row["evidence_json"]),
            "date": row["created_at"],
        }
        for row in rows
    ]


def clear_investigations():
    """Delete all saved investigation history."""
    with _connection() as connection:
        connection.execute("DELETE FROM investigations")