import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
import joblib

# ==============================
# 1. Load dataset
# ==============================

data = pd.read_csv("IFND_10000.csv")

print("Dataset loaded successfully!")
print("Total records:", len(data))

# ==============================
# 2. Keep required columns
# ==============================

data = data[["Statement", "Label"]].copy()

# ==============================
# 3. Clean text
# ==============================

data["Statement"] = (
    data["Statement"]
    .fillna("")
    .astype(str)
    .str.strip()
)

# Remove empty statements
data = data[data["Statement"] != ""]

# ==============================
# 4. Clean labels
# ==============================

data["Label"] = (
    data["Label"]
    .astype(str)
    .str.lower()
    .str.strip()
)

# TRUE = 1
# FAKE = 0

data["Label"] = data["Label"].map({
    "true": 1,
    "fake": 0
})

# Remove invalid labels
data = data.dropna(subset=["Label"])

# ==============================
# 5. Remove duplicate statements
# ==============================

data = data.drop_duplicates(
    subset=["Statement"]
)

print("Records after cleaning:", len(data))

# ==============================
# 6. Input and output
# ==============================

X = data["Statement"]
y = data["Label"]

# ==============================
# 8. TF-IDF
# ==============================

vectorizer = TfidfVectorizer(
    lowercase=True,
    ngram_range=(1, 2),
    min_df=2,
    sublinear_tf=True
)

X_tfidf = vectorizer.fit_transform(X)

print("TF-IDF conversion completed!")

# ==============================
# 9. Linear SVM
# ==============================

model = LinearSVC(random_state=42)

model.fit(
    X_tfidf,
    y
)

print("Linear SVM model training completed!")

# ==============================
# 12. Save model
# ==============================

joblib.dump(
    model,
    "model.pkl"
)

# Save TF-IDF vectorizer
joblib.dump(
    vectorizer,
    "vectorizer.pkl"
)

print("\n==============================")
print("FILES SAVED SUCCESSFULLY!")
print("==============================")

print("model.pkl")
print("vectorizer.pkl")