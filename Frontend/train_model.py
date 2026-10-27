"""Train and evaluate the fake-news text classifier.

Evaluation vectorizers are fitted only on each training partition. After evaluation,
a fresh classifier/vectorizer pair is fitted on all cleaned rows and saved for use.
"""

import re
import unicodedata
from pathlib import Path

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import brier_score_loss, classification_report, confusion_matrix
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.svm import LinearSVC


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "IFND_10000.csv"
MODEL_PATH = BASE_DIR / "model.pkl"
VECTORIZER_PATH = BASE_DIR / "vectorizer.pkl"
CONFIDENCE_MODEL_PATH = BASE_DIR / "confidence_model.pkl"
RANDOM_STATE = 42


def normalize_statement(value):
    """Normalize Unicode, whitespace, and case for deduplication and modeling."""
    if pd.isna(value):
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    return re.sub(r"\s+", " ", text).strip().casefold()


def make_vectorizer():
    return TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
    )


def make_confidence_model():
    return CalibratedClassifierCV(
        estimator=LinearSVC(random_state=RANDOM_STATE),
        method="sigmoid",
        cv=5,
        ensemble=False,
    )


def evaluate(name, train_indices, test_indices, statements, labels):
    """Fit preprocessing/model on training rows only and report held-out metrics."""
    vectorizer = make_vectorizer()
    train_text = statements.iloc[train_indices]
    test_text = statements.iloc[test_indices]
    train_features = vectorizer.fit_transform(train_text)
    test_features = vectorizer.transform(test_text)

    model = LinearSVC(random_state=RANDOM_STATE)
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

    if name == "Stratified random 80/20 holdout":
        confidence_model = make_confidence_model()
        confidence_model.fit(train_features, labels.iloc[train_indices])
        true_probabilities = confidence_model.predict_proba(test_features)[
            :, list(confidence_model.classes_).index(1)
        ]
        print(
            "Calibrated holdout Brier score (lower is better; 0 is perfect): "
            f"{brier_score_loss(truth, true_probabilities):.3f}"
        )


def main():
    data = pd.read_csv(DATA_PATH)
    required = {"Statement", "Label"}
    missing = required.difference(data.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {sorted(missing)}")
    if "Web" not in data.columns:
        print("Publisher-held-out evaluation unavailable: dataset has no Web column.")

    print(f"Dataset loaded: {DATA_PATH}")
    print(f"Input rows: {len(data)}")

    data = data.copy()
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

    statements = data["Statement"]
    labels = data["Label"]
    all_indices = list(range(len(data)))
    train_indices, test_indices = train_test_split(
        all_indices,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=labels,
    )
    evaluate(
        "Stratified random 80/20 holdout",
        train_indices,
        test_indices,
        statements,
        labels,
    )

    if "Web" in data.columns:
        publishers = data["Web"].fillna("").astype(str).str.strip().str.upper()
        publishers = publishers.mask(publishers.eq(""), "__UNKNOWN__")
        publisher_split = None
        # Try deterministic group splits until both partitions contain both labels.
        for seed in range(RANDOM_STATE, RANDOM_STATE + 100):
            splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=seed)
            candidate_train, candidate_test = next(
                splitter.split(statements, labels, groups=publishers)
            )
            if (
                labels.iloc[candidate_train].nunique() == 2
                and labels.iloc[candidate_test].nunique() == 2
            ):
                publisher_split = (candidate_train, candidate_test)
                break
        if publisher_split is None:
            print(
                "\nPublisher-held-out evaluation skipped: no deterministic 20% "
                "publisher-group split in 100 attempts contained both classes "
                "in train and test."
            )
        else:
            publisher_train, publisher_test = publisher_split
            held_out_publishers = sorted(set(publishers.iloc[publisher_test]))
            print("\nHeld-out publisher groups:", ", ".join(held_out_publishers))
            evaluate(
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

    # Production artifacts use all cleaned rows only after the held-out evaluations.
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


if __name__ == "__main__":
    main()
