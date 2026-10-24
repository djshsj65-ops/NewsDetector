# Fake News Detector — Frontend

## Files
- `index.html` — complete page structure
- `style.css` — medium-dark elegant styling, responsive layout, hover effects
- `script.js` — sidebar, account/settings interactions, text and article-link analysis

## Run on Windows
1. Double-click `run.bat`.
2. Open `http://127.0.0.1:5000` in your browser.
3. Keep the command window open while using the website.

Flask serves both the website and prediction API from the same address. The
launcher uses Python 3.14 free-threaded (`py -3.14t`) to match the installed
scikit-learn build used to load the model.

Paste either a claim or a public article URL. Article URLs are fetched by Flask,
and readable page text is passed to the trained classifier. Some websites may
block automated requests or provide too little readable article text.
The result also shows the fetched publisher and text preview, with search links
for fact checks and other sources; those search links are not verified citations.


