import re
import unicodedata

import pandas as pd


def normalize_statement(value):
    """Normalize Unicode, whitespace, and case for duplicate detection."""
    if pd.isna(value):
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    return re.sub(r"\s+", " ", text).strip().casefold()


# ==============================
# 1. Load original dataset
# ==============================

data = pd.read_csv("IFND.csv")
print("Original dataset loaded!")
print("Total records:", len(data))

required = {"Statement", "Label"}
missing = required.difference(data.columns)
if missing:
    raise ValueError(f"Dataset missing required columns: {sorted(missing)}")

# ==============================
# 2. Clean labels and statements
# ==============================

data["Label"] = data["Label"].astype(str).str.strip().str.casefold()
data = data[data["Label"].isin(["true", "fake"])].copy()
print("\nAfter removing invalid labels:")
print(data["Label"].value_counts())

data["Statement"] = data["Statement"].fillna("").astype(str).str.strip()
data["_normalized_statement"] = data["Statement"].map(normalize_statement)
data = data[data["_normalized_statement"] != ""].copy()

# Exclude every row for normalized statements appearing with both labels.
label_counts = data.groupby("_normalized_statement", sort=False)["Label"].nunique()
conflicting_statements = set(label_counts[label_counts > 1].index)
conflict_rows = int(data["_normalized_statement"].isin(conflicting_statements).sum())
print("\nConflicting normalized duplicate groups:", len(conflicting_statements))
print("Rows removed from conflicting groups:", conflict_rows)
data = data[~data["_normalized_statement"].isin(conflicting_statements)].copy()

# Deduplicate remaining normalized statements, not just byte-for-byte matches.
duplicate_rows = int(data.duplicated(subset=["_normalized_statement"], keep="first").sum())
data = data.drop_duplicates(subset=["_normalized_statement"], keep="first").copy()
print("Same-label normalized duplicate rows removed:", duplicate_rows)
print("Rows remaining after normalization/deduplication:", len(data))

# ==============================
# 3. Balance and sample
# ==============================

true_data = data[data["Label"] == "true"]
fake_data = data[data["Label"] == "fake"]
print("\nAvailable records after conflict removal and deduplication:")
print("TRUE:", len(true_data))
print("FAKE:", len(fake_data))

sample_size = 5000
if len(true_data) < sample_size or len(fake_data) < sample_size:
    raise ValueError(
        f"Cannot create a balanced {sample_size}-per-class sample after conflict "
        f"removal: TRUE={len(true_data)}, FAKE={len(fake_data)}."
    )

true_sample = true_data.sample(n=sample_size, random_state=42)
fake_sample = fake_data.sample(n=sample_size, random_state=42)
balanced_data = pd.concat([true_sample, fake_sample], ignore_index=True)
balanced_data = balanced_data.sample(frac=1, random_state=42).reset_index(drop=True)
balanced_data = balanced_data.drop(columns=["_normalized_statement"])

# ==============================
# 4. Save final dataset
# ==============================

balanced_data.to_csv("IFND_10000.csv", index=False)
print("\n==============================")
print("DATASET CREATED SUCCESSFULLY")
print("==============================")
print("Total records:", len(balanced_data))
print("\nFinal distribution:")
print(balanced_data["Label"].value_counts())
print("\nFile created: IFND_10000.csv")
