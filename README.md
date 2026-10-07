# Yamishi · Portfolio

Static site: `index.html`, `css/styles.css`, `js/main.js`. No build step.

**Run locally:** `python3 -m http.server` in this folder, then open http://localhost:8000

**Publish on GitHub Pages:** push the files to a repo, then Settings → Pages → Deploy from branch → `main` / root.

**Edit:** replace the placeholder projects and the `you@example.com` address in `index.html`. Colours live in the `defs` array at the top of `js/main.js`.

## Before you share the link

1. In `index.html`, replace `https://YOUR-USERNAME.github.io/YOUR-REPO/og.png` (two lines near the top, search for `YOUR-USERNAME`) with your real site address. This makes the preview image appear when the link is shared in chats and on social media.
2. Replace the two placeholder "Project name" cards with real projects.
3. `favicon.svg` is the tab icon and `og.png` is the link preview image. Replace either file to change them.

## Contact form

The form posts to [Formspree](https://formspree.io) (free plan available, with a monthly message limit).
1. Create a free account and a new form. Messages are sent to the email you register there.
2. Copy the form's endpoint, which looks like `https://formspree.io/f/abcdwxyz`.
3. In `index.html`, replace `YOUR_FORM_ID` in the form's `action` with the ID at the end of that URL.

Until you do this, the form opens the visitor's email app with the message pre-filled instead.

## Light and dark mode

The site follows the visitor's system theme, and the button in the header lets them switch. Their choice is remembered in the browser.
