# Fake News Detector — Frontend

## Files
- `index.html` — complete page structure
- `style.css` — medium-dark elegant styling, responsive layout, hover effects
- `script.js` — sidebar, preferences, text and article-link analysis
- `database.py` — SQLite schema and investigation-history read/write helpers
- `news_detector.sqlite3` — automatically created local database file

<<<<<<< HEAD
## Run
1. Open a terminal in the `Frontend` folder.
2. Install the Python dependencies with `py -m pip install -r requirements.txt`.
3. Start the Flask API with `py app.py` and leave that terminal open.
4. Open `http://127.0.0.1:5000/app/` in your browser. This serves the page
   and API from the same origin so browser requests reach Flask correctly.
5. Optionally check `http://127.0.0.1:5000/` for the API health message.
6. Run the backend regression tests from this folder with
   `py -m unittest discover -s tests`.

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
=======
## Run on Windows
1. Double-click `run.bat`.
2. Open `http://127.0.0.1:5000` in your browser.
3. Keep the command window open while using the website.

Flask serves both the website and prediction API from the same address. The
launcher uses Python 3.14 free-threaded (`py -3.14t`) to match the installed
scikit-learn build used to load the model.
>>>>>>> d352270299c0a035bfea9ce5072f434925afd7bd

Paste either a claim or a public article URL. Article URLs are fetched by Flask,
and readable page text is passed to the trained classifier. Some websites may
block automated requests or provide too little readable article text.
The result also shows the fetched publisher and text preview, with search links
for fact checks and other sources; those search links are not verified citations.
<<<<<<< HEAD
The result panel displays a cross-validated, calibrated model-confidence estimate
for the predicted class. It is not the model's accuracy and does not establish
whether the claim is true. The confidence model is created by running
`py train_model.py` after changes to the training data or model pipeline.
=======


>>>>>>> d352270299c0a035bfea9ce5072f434925afd7bd
