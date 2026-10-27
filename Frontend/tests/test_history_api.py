import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

import app as detector
import database


class HistoryApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.database_path_patch = patch.object(
            database,
            "DATABASE_PATH",
            Path(cls.temp_dir.name) / "test.sqlite3",
        )
        cls.database_path_patch.start()
        database.initialize_database()

    @classmethod
    def tearDownClass(cls):
        cls.database_path_patch.stop()
        cls.temp_dir.cleanup()

    def setUp(self):
        database.clear_investigations()
        self.client = detector.app.test_client()

    def test_health_endpoint_identifies_the_detector_service(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {"status": "ok", "service": "news-detector-api"},
        )

    def test_prediction_is_saved_and_can_be_cleared(self):
        evidence = {
            "available": False,
            "provider": "NewsAPI",
            "message": "Not configured",
            "articles": [],
        }
        with patch.object(detector, "search_related_news", return_value=evidence):
            response = self.client.post(
                "/predict",
                json={"text": "A sample claim to test persistent history.", "is_url": False},
            )

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertGreater(result["history_id"], 0)
        self.assertIsInstance(result["confidence"], float)
        self.assertGreaterEqual(result["confidence"], 0)
        self.assertLessEqual(result["confidence"], 1)

        history_response = self.client.get("/history")
        self.assertEqual(history_response.status_code, 200)
        history = history_response.get_json()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["text"], "A sample claim to test persistent history.")
        self.assertEqual(history[0]["evidence"], [])

        clear_response = self.client.delete("/history")
        self.assertEqual(clear_response.status_code, 200)
        self.assertEqual(self.client.get("/history").get_json(), [])

    def test_prediction_and_confidence_are_case_insensitive(self):
        evidence = {
            "available": False,
            "provider": "NewsAPI",
            "message": "Not configured",
            "articles": [],
        }
        inputs = [
            "is modi a prime minister of inida",
            "IS MODI A PRIME MINISTER OF INIDA",
            "Is Modi a Prime Minister of Inida",
        ]
        with patch.object(detector, "search_related_news", return_value=evidence):
            results = [
                self.client.post(
                    "/predict",
                    json={"text": text, "is_url": False},
                ).get_json()
                for text in inputs
            ]

        model_outputs = [
            (result["prediction"], result["uncertain"], result["confidence"])
            for result in results
        ]
        self.assertEqual(model_outputs, [model_outputs[0]] * len(inputs))

    def test_empty_prediction_input_is_rejected(self):
        response = self.client.post("/predict", json={"text": " ", "is_url": False})
        self.assertEqual(response.status_code, 400)
        self.assertIn("empty", response.get_json()["error"].lower())

    def test_existing_history_database_gets_evidence_column(self):
        legacy_path = Path(self.temp_dir.name) / "legacy.sqlite3"
        with closing(sqlite3.connect(legacy_path)) as connection:
            with connection:
                connection.execute(
                    """
                    CREATE TABLE investigations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        input_text TEXT NOT NULL,
                        prediction TEXT NOT NULL,
                        uncertain INTEGER NOT NULL,
                        word_count INTEGER NOT NULL,
                        article_title TEXT,
                        article_publisher TEXT,
                        article_url TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )

        with patch.object(database, "DATABASE_PATH", legacy_path):
            database.initialize_database()

        with closing(sqlite3.connect(legacy_path)) as connection:
            columns = {
                row[1]
                for row in connection.execute("PRAGMA table_info(investigations)")
            }
        self.assertIn("evidence_json", columns)

    def test_prediction_returns_explicit_provider_status_without_key(self):
        with patch.object(detector, "NEWSAPI_KEY", ""):
            response = self.client.post(
                "/predict",
                json={"text": "A sample claim with related news search disabled.", "is_url": False},
            )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["evidence"]["available"])
        self.assertIn("unavailable right now", response.get_json()["evidence"]["message"])

    def test_newsapi_articles_are_bounded_and_labeled_as_related_coverage(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False if args else None

            def read(self, limit):
                articles = [
                    {
                        "title": f"Report {index}",
                        "source": {"name": "Sample Publisher"},
                        "publishedAt": "2026-10-27T00:00:00Z",
                        "url": f"https://example.org/{index}",
                        "description": "Related reporting.",
                    }
                    for index in range(7)
                ]
                return json.dumps({"status": "ok", "articles": articles}).encode()[:limit]

        with patch.object(detector, "NEWSAPI_KEY", "test-key"):
            with patch.object(detector, "urlopen", return_value=FakeResponse()):
                result = detector.search_related_news("test claim")

        self.assertTrue(result["available"])
        self.assertEqual(len(result["articles"]), 5)
        self.assertIn("not a fact-check verdict", result["message"])

    def test_private_article_url_is_rejected(self):
        response = self.client.post(
            "/predict",
            json={"text": "http://127.0.0.1/article", "is_url": True},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("private", response.get_json()["error"].lower())


if __name__ == "__main__":
    unittest.main()
