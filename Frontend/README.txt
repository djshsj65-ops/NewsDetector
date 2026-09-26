# Fake News Detector — Frontend

## Files
- `index.html` — complete page structure
- `style.css` — medium-dark elegant styling, responsive layout, hover effects
- `script.js` — sidebar, auth toggle, settings, demo investigation result, image upload and sharing

## Run
1. Open the folder in VS Code.
2. Install **Live Server** if you have it.
3. Right-click `index.html` → **Open with Live Server**.

You can also simply double-click `index.html`.

## Important
The Real/Fake/Uncertain classification in this version is only a frontend demo.
Replace the `classifyClaim()` function in `script.js` with a `fetch()` call to your
Python/Flask/FastAPI/Node backend when your fake-news ML model is ready.

The hero uses the Giphy URL supplied in the project brief.
