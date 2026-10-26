# Fake News Detector — Frontend

## Files
- `index.html` — complete page structure
- `style.css` — medium-dark elegant styling, responsive layout, hover effects
- `script.js` — sidebar, account/settings interactions, text and article-link analysis

## Run
1. Open a terminal in the `Frontend` folder.
2. Install the Python dependencies with `py -m pip install -r requirements.txt`.
3. Start the Flask API with `py app.py` and leave that terminal open.
4. Open `http://127.0.0.1:5000/app/` in your browser. This serves the page
   and API from the same origin so browser requests reach Flask correctly.
5. Optionally check `http://127.0.0.1:5000/` for the API health message.

Paste either a claim or a public article URL. Article URLs are fetched by Flask,
and readable page text is passed to the trained classifier. Some websites may
block automated requests or provide too little readable article text.
The result also shows the fetched publisher and text preview, with search links
for fact checks and other sources; those search links are not verified citations.
