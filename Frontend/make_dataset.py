import pandas as pd

# ==============================
# 1. Load original dataset
# ==============================

data = pd.read_csv("IFND.csv")

print("Original dataset loaded!")
print("Total records:", len(data))

# ==============================
# 2. Clean labels
# ==============================

data["Label"] = (
    data["Label"]
    .astype(str)
    .str.strip()
    .str.lower()
)

# Keep only TRUE and FAKE
data = data[data["Label"].isin(["true", "fake"])]

print("\nAfter removing invalid labels:")
print(data["Label"].value_counts())

# ==============================
# 3. Clean statements
# ==============================

data["Statement"] = (
    data["Statement"]
    .fillna("")
    .astype(str)
    .str.strip()
)

# Remove empty statements
data = data[data["Statement"] != ""]

# Remove duplicate statements
data = data.drop_duplicates(subset=["Statement"])

print("\nAfter removing duplicates:")
print("Total records:", len(data))

# ==============================
# 4. Separate TRUE and FAKE
# ==============================

true_data = data[data["Label"] == "true"]
fake_data = data[data["Label"] == "fake"]

print("\nAvailable records:")
print("TRUE:", len(true_data))
print("FAKE:", len(fake_data))

# ==============================
# 5. Take 5000 from each
# ==============================

true_sample = true_data.sample(
    n=5000,
    random_state=42
)

fake_sample = fake_data.sample(
    n=5000,
    random_state=42
)

# ==============================
# 6. Combine datasets
# ==============================

balanced_data = pd.concat(
    [true_sample, fake_sample],
    ignore_index=True
)

# Shuffle the final dataset
balanced_data = balanced_data.sample(
    frac=1,
    random_state=42
).reset_index(drop=True)

# ==============================
# 7. Save final dataset
# ==============================

balanced_data.to_csv(
    "IFND_10000.csv",
    index=False
)

# ==============================
# 8. Show final results
# ==============================

print("\n==============================")
print("DATASET CREATED SUCCESSFULLY")
print("==============================")

print("Total records:", len(balanced_data))

print("\nFinal distribution:")
print(balanced_data["Label"].value_counts())

print("\nFile created:")
print("IFND_10000.csv")