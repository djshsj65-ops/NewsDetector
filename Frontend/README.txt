# Fake News Detector — Frontend

## Files
- `index.html` — complete page structure
- `style.css` — responsive layout, light/dark themes, and component styling
- `script.js` — dashboard interactions, preferences, predictions, and history
- `database.py` — SQLite schema and investigation-history read/write helpers
- `news_detector.sqlite3` — automatically created local database file
- `app.py` — Flask API, model inference, article extraction, and static-file routes
- `train_model.py` — dataset evaluation and model artifact training
- `make_dataset.py` — cleans and prepares the balanced training dataset

## Run on Windows
1. Open a terminal in the `Frontend` folder.
2. Run `.\venv\Scripts\python.exe app.py`. If required packages are missing, run `.\venv\Scripts\python.exe -m pip install -r requirements.txt` first.
3. Open `http://127.0.0.1:5000/app/` in your browser.
4. Keep the terminal open while using the website.
5. Run backend regression tests with `.\venv\Scripts\python.exe -m unittest discover -s tests`.
6. Check server health at `http://127.0.0.1:5000/health`.

Flask serves the website and API from the same local address. The `venv`
environment keeps this project's Python packages separate from other projects.
Use the environment-specific command above so the app loads the working packages.

## How the result is decided
1. If fewer than half of the claim's key words (or fewer than two) appeared in the
   training data, the result is UNCERTAIN: the model cannot judge unfamiliar text.
   On the 1,948-headline holdout this rule flags about 7% of rows, where accuracy
   falls from about 81% to 75%.
2. Otherwise the model's LIKELY REAL / LIKELY FAKE label is shown (or UNCERTAIN for a
   weak signal), with its confidence as a percentage and a High/Medium/Low band, and
   the words that pushed it most toward FAKE and toward TRUE.
3. Related fact-check articles are shown separately as evidence. They do not change
   the label: on the 36-claim benchmark, matching fact-checks were found for many
   TRUE events too, because fact-checkers also debunk hoaxes around real events
   (for example fake Chandrayaan-3 images). Reading them is up to the user.

The accuracy shown in the result comes from `model_metrics.json`, written by
`train_model.py` from the 80/20 holdout evaluation (currently 81.0% on 1,948 unseen
headlines). Re-run `make_dataset.py` and `train_model.py` after changing the data or
the cleaning so the number stays true.

## Why the accuracy is about 81%, not 95%
Most FAKE rows in IFND are fact-checkers' headlines ("Fact Check: No, X did not...",
"Old video falsely shared as..."), and 11,321 FAKE rows marked AUGMENT are two such
headlines glued together. A model trained on that text reached about 95% by spotting
fact-check wording ("viral", "fake", "video", "did not") and even broken-character
patterns of each publisher, but caught only 39% of plainly written false claims.

The training pipeline now:
- leaves out the AUGMENT rows (`make_dataset.py`),
- removes fact-check framing and broken characters from every text, in training and
  at prediction time (`text_cleaning.py`),
- ignores English stop words and words seen in fewer than three headlines.

The holdout score fell to about 81%, but it now measures the claim text rather than
the headline style. `claim_benchmark.csv` holds 36 plainly written claims (18 widely
debunked false claims, 18 true events) written outside the dataset; `train_model.py`
reports accuracy on it (now about 78%, up from 67%). It is small and was also used
while choosing the cleaning rules, so treat it as a sanity check, not a final score.
The model still associates some topics (for example communal or religious terms)
with FAKE because of what IFND contains; this is a known dataset bias.

## Fact-check search (no API key needed)
Every check also searches published fact-checks from AltNews, BOOM, Factly,
Vishvas News, Newschecker and Fact Crescendo through the public Google News RSS
search. Only results that share keywords with the claim are shown (up to five).
These are leads to fact-check articles on the same topic, not an automatic
verdict: open them to read whether the fact-checker confirms or debunks the claim. The search needs an
internet connection; if it fails, the model result is still shown.

## Related news search (optional)
The result can show up to five related NewsAPI articles. These are related
coverage, not fact-check verdicts. To enable the search in PowerShell, set
`$env:NEWSAPI_KEY = "your-key"` in the same terminal before starting Flask.
If this variable is not set, the model still works and the result explains why
related articles are unavailable. Do not commit API keys to the project.

Investigation results are stored in `news_detector.sqlite3` in this folder.
The table structure and database operations are in `database.py`; Flask creates
the database and its table automatically on startup. The SQLite database file
is runtime data and is not included with the project files.
History is shared by users of this local app. Sign-in and profile controls are
browser-only and do not provide server authentication or per-user access
control; passwords are not stored or verified. Google search links are
user-initiated searches and are not verified citations.

## Investigating an image
Click the image icon in the search box and upload a PNG/JPG/WEBP/BMP (max 5 MB).
Flask reads the text in the image with OCR (`rapidocr-onnxruntime`) and sends that
text to the same classifier. The model only checks text, so photos without text
cannot be classified. The result also links to Google Lens and TinEye; upload the
same image there to see where it appeared before (reused or out-of-context photos).

Paste either a claim or a public article URL. Article URLs are fetched by Flask,
and readable page text is passed to the trained classifier. Some websites may
block automated requests or provide too little readable article text.
The result also shows the fetched publisher and text preview, with search links
for fact checks and other sources; those search links are not verified citations.
The result panel displays a cross-validated, calibrated model-confidence estimate
for the predicted class. It is not the model's accuracy and does not establish
whether the claim is true. The confidence model is created by running
`py train_model.py` after changes to the training data or model pipeline.
The uncertainty threshold is intentionally cautious: borderline model signals
remain uncertain rather than being forced into a likely label. It is not a
factual truth threshold, and short text can still be uncertain because it may
contain too few word and phrase patterns for the model.

The browser notification setting can show an alert when a check finishes. It
requires browser permission and the browser to remain open; it does not send
background alerts after the browser is closed.

## Training evaluation and limitations
`train_model.py` reports per-class precision/recall, confusion matrices, and
calibrated confidence on a stratified random holdout. It also compares
Logistic Regression with LinearSVC on the same random split and reports a
publisher-held-out diagnostic when publisher data is available. The comparison
does not automatically change the production classifier: LinearSVC remains the
model saved for the website. Review class counts and per-class metrics instead
of relying on accuracy alone; a single split is not a guarantee of performance
on future news.

Dataset preparation can be tested without rewriting the generated CSV by
running `.\venv\Scripts\python.exe -m unittest discover -s tests`. The
`make_dataset.py` command itself reads `IFND.csv` and overwrites
`IFND_10000.csv`; `train_model.py` overwrites the saved model artifacts, so
back up desired versions before running either command.

This project is a local educational demo, not a production service. Browser-only
sign-in is not authentication, investigation history is shared, and model
predictions are not verified fact-checks.
