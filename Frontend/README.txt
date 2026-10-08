# Fake News Detector — Frontend

## Files
- `index.html` — complete page structure
- `style.css` — medium-dark elegant styling, responsive layout, hover effects
- `script.js` — sidebar, account/settings interactions, text and article-link analysis

## Run
1. Open the folder in VS Code.
2. Install **Live Server** if you have it.
3. Start the Flask API with `py app.py`.
4. Right-click `index.html` → **Open with Live Server**.

Paste either a claim or a public article URL. Article URLs are fetched by Flask,
and readable page text is passed to the trained classifier. Some websites may
block automated requests or provide too little readable article text.
The result also shows the fetched publisher and text preview, with search links
for fact checks and other sources; those search links are not verified citations.

