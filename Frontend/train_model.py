"""Train and evaluate the fake-news classifier, then save production artifacts.

Evaluation vectorizers are fitted only on each training partition. After evaluation,
the final models and vectorizer are fitted on all cleaned rows and saved for use.
"""

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.svm import LinearSVC

from text_cleaning import clean_claim_text


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "IFND_10000.csv"
MODEL_PATH = BASE_DIR / "model.pkl"
VECTORIZER_PATH = BASE_DIR / "vectorizer.pkl"
CONFIDENCE_MODEL_PATH = BASE_DIR / "confidence_model.pkl"
METRICS_PATH = BASE_DIR / "model_metrics.json"
BENCHMARK_PATH = BASE_DIR / "claim_benchmark.csv"
RANDOM_STATE = 42


def normalize_statement(value):
    """Normalize text and remove fact-check framing (same cleaning as the website)."""
    if pd.isna(value):
        return ""
    return clean_claim_text(value)


def make_vectorizer():
    # English stop words and min_df=3 stop the model from leaning on filler words
    # ("this", "here", "of") that differ between fact-check and news headline styles.
    return TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 2),
        min_df=3,
        stop_words="english",
        sublinear_tf=True,
    )


def make_confidence_model():
    return CalibratedClassifierCV(
        estimator=LinearSVC(random_state=RANDOM_STATE),
        method="sigmoid",
        cv=5,
        ensemble=False,
    )


def evaluate(
    name,
    train_indices,
    test_indices,
    statements,
    labels,
    score_confidence=False,
    classifier=None,
):
    """Fit preprocessing/model on training rows only, report and return held-out metrics."""
    vectorizer = make_vectorizer()
    train_text = statements.iloc[train_indices]
    test_text = statements.iloc[test_indices]
    train_features = vectorizer.fit_transform(train_text)
    test_features = vectorizer.transform(test_text)

    model = (
        classifier
        if classifier is not None
        else LinearSVC(random_state=RANDOM_STATE)
    )
    model.fit(train_features, labels.iloc[train_indices])
    predictions = model.predict(test_features)
    truth = labels.iloc[test_indices]

    print(f"\n=== {name} ===")
    print(f"Train rows: {len(train_indices)}; test rows: {len(test_indices)}")
    print("Per-class metrics (labels: 0=FAKE, 1=TRUE):")
    print(
        classification_report(
            truth,
            predictions,
            labels=[0, 1],
            target_names=["FAKE", "TRUE"],
            digits=3,
            zero_division=0,
        )
    )
    print("Confusion matrix (rows=true, columns=predicted; labels [FAKE, TRUE]):")
    print(confusion_matrix(truth, predictions, labels=[0, 1]))

    if score_confidence:
        confidence_model = make_confidence_model()
        confidence_model.fit(train_features, labels.iloc[train_indices])
        true_probabilities = confidence_model.predict_proba(test_features)[
            :, list(confidence_model.classes_).index(1)
        ]
        print(
            "Calibrated holdout Brier score (lower is better; 0 is perfect): "
            f"{brier_score_loss(truth, true_probabilities):.3f}"
        )

    precision, recall, _, _ = precision_recall_fscore_support(
        truth, predictions, labels=[0, 1], zero_division=0
    )
    return {
        "accuracy": round(float(accuracy_score(truth, predictions)), 4),
        "test_rows": len(test_indices),
        "train_rows": len(train_indices),
        "fake_precision": round(float(precision[0]), 4),
        "fake_recall": round(float(recall[0]), 4),
        "true_precision": round(float(precision[1]), 4),
        "true_recall": round(float(recall[1]), 4),
    }


def save_metrics(metrics):
    """Save holdout metrics so the website can show the measured accuracy."""
    METRICS_PATH.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(f"Saved holdout metrics: {METRICS_PATH}")


def load_and_clean_data():
    data = pd.read_csv(DATA_PATH)
    required = {"Statement", "Label"}
    missing = required.difference(data.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {sorted(missing)}")
    if "Web" not in data.columns:
        print("Publisher-held-out evaluation unavailable: dataset has no Web column.")

    print(f"Dataset loaded: {DATA_PATH}")
    print(f"Input rows: {len(data)}")

    data["Statement"] = data["Statement"].map(normalize_statement)
    data["Label"] = data["Label"].astype(str).str.strip().str.casefold().map(
        {"true": 1, "fake": 0}
    )
    invalid_labels = int(data["Label"].isna().sum())
    data = data.dropna(subset=["Label"])
    empty_statements = int(data["Statement"].eq("").sum())
    data = data[data["Statement"] != ""].copy()

    # Remove every row in a normalized statement group that has conflicting labels.
    label_counts = data.groupby("Statement", sort=False)["Label"].nunique()
    conflicting_statements = set(label_counts[label_counts > 1].index)
    conflict_rows = int(data["Statement"].isin(conflicting_statements).sum())
    data = data[~data["Statement"].isin(conflicting_statements)].copy()

    # At this point repeated normalized statements have one label; retain one row.
    duplicate_rows = int(data.duplicated(subset=["Statement"], keep="first").sum())
    data = data.drop_duplicates(subset=["Statement"], keep="first").reset_index(drop=True)
    data["Label"] = data["Label"].astype(int)

    print(f"Invalid-label rows dropped: {invalid_labels}")
    print(f"Empty-statement rows dropped: {empty_statements}")
    print(
        "Conflicting normalized duplicate groups dropped: "
        f"{len(conflicting_statements)} groups / {conflict_rows} rows"
    )
    print(f"Additional same-label normalized duplicate rows dropped: {duplicate_rows}")
    label_counts = data["Label"].value_counts().sort_index().to_dict()
    print(f"Clean rows: {len(data)}; label counts: {label_counts}")

    if data["Label"].nunique() != 2 or data["Label"].value_counts().min() < 2:
        raise ValueError("Need at least two examples of each class for held-out evaluation.")

    return data


def find_publisher_split(statements, labels, publishers):
    publishers = publishers.fillna("").astype(str).str.strip().str.upper()
    publishers = publishers.mask(publishers.eq(""), "__UNKNOWN__")

    for seed in range(RANDOM_STATE, RANDOM_STATE + 100):
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=seed)
        train_indices, test_indices = next(
            splitter.split(statements, labels, groups=publishers)
        )
        if (
            labels.iloc[train_indices].nunique() == 2
            and labels.iloc[test_indices].nunique() == 2
        ):
            return train_indices, test_indices, publishers

    return None


def train_and_save_models(statements, labels):
    vectorizer = make_vectorizer()
    all_features = vectorizer.fit_transform(statements)
    model = LinearSVC(random_state=RANDOM_STATE)
    model.fit(all_features, labels)
    confidence_model = make_confidence_model()
    confidence_model.fit(all_features, labels)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(vectorizer, VECTORIZER_PATH)
    joblib.dump(confidence_model, CONFIDENCE_MODEL_PATH)
    print("\nFinal production model/vectorizer retrained on all cleaned rows.")
    print(f"Saved model: {MODEL_PATH}")
    print(f"Saved vectorizer: {VECTORIZER_PATH}")
    print(f"Saved calibrated confidence model: {CONFIDENCE_MODEL_PATH}")
    print(
        "Caveat: final artifacts are fitted on the full cleaned sample; the "
        "reported holdout metrics are estimates for their respective splits, "
        "not scores of the full-data-fitted artifacts."
    )
    return model, vectorizer


def evaluate_benchmark(model, vectorizer):
    """Score the saved model on plain-language claims written outside the dataset.

    IFND fake rows are mostly fact-check headlines, so the holdout score alone
    does not show how the model handles a claim as a user would type it.
    """
    if not BENCHMARK_PATH.exists():
        print("\nClaim benchmark skipped: claim_benchmark.csv not found.")
        return {}

    benchmark = pd.read_csv(BENCHMARK_PATH)
    truth = benchmark["Label"].str.strip().str.casefold().map({"true": 1, "fake": 0})
    predictions = model.predict(vectorizer.transform(benchmark["Statement"].map(normalize_statement)))
    fake_rows, true_rows = truth == 0, truth == 1
    metrics = {
        "benchmark_rows": len(benchmark),
        "benchmark_accuracy": round(float((predictions == truth).mean()), 4),
        "benchmark_fake_caught": round(float((predictions[fake_rows] == 0).mean()), 4),
        "benchmark_true_kept": round(float((predictions[true_rows] == 1).mean()), 4),
    }
    print("\n=== Plain-language claim benchmark (claim_benchmark.csv) ===")
    print(metrics)
    return metrics


def main():
    data = load_and_clean_data()
    statements = data["Statement"]
    labels = data["Label"]

    train_indices, test_indices = train_test_split(
        list(range(len(data))),
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=labels,
    )
    holdout_metrics = evaluate(
        "Stratified random 80/20 holdout - LinearSVC",
        train_indices,
        test_indices,
        statements,
        labels,
        score_confidence=True,
    )
    evaluate(
        "Stratified random 80/20 holdout - Logistic Regression comparison",
        train_indices,
        test_indices,
        statements,
        labels,
        classifier=LogisticRegression(
            max_iter=1000,
            random_state=RANDOM_STATE,
        ),
    )

    publisher_metrics = None
    if "Web" in data.columns:
        split = find_publisher_split(statements, labels, data["Web"])
        if split is None:
            print(
                "\nPublisher-held-out evaluation skipped: no deterministic 20% "
                "publisher-group split in 100 attempts contained both classes "
                "in train and test."
            )
        else:
            publisher_train, publisher_test, publishers = split
            held_out_publishers = sorted(set(publishers.iloc[publisher_test]))
            print("\nHeld-out publisher groups:", ", ".join(held_out_publishers))
            publisher_metrics = evaluate(
                "Publisher-held-out evaluation",
                publisher_train,
                publisher_test,
                statements,
                labels,
            )
            print(
                "Caveat: publisher-level performance is sensitive to the specific "
                "held-out publishers and class mix; it is one diagnostic split, "
                "not a deployment guarantee."
            )

    model, vectorizer = train_and_save_models(statements, labels)
    save_metrics({
        "model": "TF-IDF + LinearSVC",
        "dataset": DATA_PATH.name,
        **holdout_metrics,
        "publisher_heldout_accuracy": publisher_metrics and publisher_metrics["accuracy"],
        **evaluate_benchmark(model, vectorizer),
    })


if __name__ == "__main__":
    main()
