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
1. Double-click `run.bat` in the `Frontend` folder.
2. On the first run, it creates a local `.venv` and installs `requirements.txt`.
3. Open `http://127.0.0.1:5000/app/` in your browser. Do not open `index.html`
   directly as a file; the Flask server must be running for API requests.
4. Keep the command window open while using the website.
5. Run backend regression tests from this folder with
   `py -m unittest discover -s tests`.
6. To check the Flask server, open `http://127.0.0.1:5000/health`. A healthy
   server returns `{"status":"ok","service":"news-detector-api"}`.

Flask serves the website and API from the same local address. The launcher uses
an isolated Python environment to avoid conflicts with global Python packages,
reuses an existing detector server, and warns if another process occupies port
5000.

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

Paste either a claim or a public article URL. Article URLs are fetched by Flask,
and readable page text is passed to the trained classifier. Some websites may
block automated requests or provide too little readable article text.
The result also shows the fetched publisher and text preview, with search links
for fact checks and other sources; those search links are not verified citations.
The result panel displays a cross-validated, calibrated model-confidence estimate
for the predicted class. It is not the model's accuracy and does not establish
whether the claim is true. The confidence model is created by running
`py train_model.py` after changes to the training data or model pipeline.
