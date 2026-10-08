# Arts For Life — Paint Tube Fundraising Thermometer

A two-page fundraising tracker for [Arts For Life](https://artsforlifenc.org).

- **Public page** (`index.html`): a cartoon paint tube that fills with rainbow paint as donations come in, plus the amount raised and the goal. It updates live without a reload.
- **Admin page** (`admin.html`): a staff-only control panel for setting the amount raised and the goal. Edits save immediately.

It's a static site with no build step: plain HTML, CSS and ES modules, hosted on **GitHub Pages**. The numbers live in a **Firebase Realtime Database**, which the pages read and write directly from the browser over its REST API, so no server and no Firebase SDK are needed.

```
index.html            public page (tube is inline SVG)
admin.html            staff control panel
css/styles.css        shared styles and design tokens
js/config.js          ← your Firebase settings go here
js/store.js           data layer: getState / setState / subscribe + staff sign-in
js/progress.js        shared number handling (clamping, percent, currency)
js/public.js          public page behavior
js/admin.js           admin page behavior
database.rules.json   Realtime Database security rules (paste into the Firebase console)
.nojekyll             tells GitHub Pages to serve the files as-is
assets/               logo
docs/design-reference screenshots from the design handoff
```

## Run it locally

ES modules need a web server (opening the file directly won't work):

```sh
python3 -m http.server 8000     # or: npx serve .
```

Then open http://localhost:8000 and http://localhost:8000/admin.html.

With `js/config.js` left empty, the site runs in **local mode**. Data is saved in this browser only and syncs across its tabs. That's fine for development, but other visitors won't see your changes.

## Going live

Two parts: the **database** is set up once in the Firebase console, and the **site** is published with GitHub Pages. Both are free. Everything is done in a web browser, with no command-line tools needed.

### 1. Create the Firebase database
1. Go to https://console.firebase.google.com and create a project (the free Spark plan is enough; you can turn off Google Analytics).
2. **Build → Realtime Database → Create Database.** Choose a location and start in **locked mode**.
3. **Build → Authentication → Get started → Email/Password**, then enable it.
4. **Project settings → General**: copy the **Web API key**. (If there isn't one yet, click **Add app → Web** to generate it; you don't need the code snippet it shows.)
5. Back in **Realtime Database**, copy the database URL shown at the top of the **Data** tab.

### 2. Lock down writes (required)
Anyone can read the fundraiser totals, but only staff listed under `/admins` can change them.

1. **Realtime Database → Rules**: replace the contents with `database.rules.json` from this repo and click **Publish**.
2. **Authentication → Users → Add user**: create an account for each staff member.
3. Copy each staff member's **User UID** from that list.
4. **Realtime Database → Data**: hover over the root, click **+**, and add a child `admins`. Under it, add one entry per staff UID with the value `true`:
   ```
   admins
     └─ kX9f…Q2  : true
   ```
   Only the Firebase console can edit `/admins`. The website can't.

To remove someone's access, delete their entry under `admins` (or disable their account under Authentication).

### 3. Connect the site to the database
Fill in `js/config.js` with the two values from step 1, then commit and push:
```js
export const FIREBASE_DB_URL = "https://<your-project>-default-rtdb.firebaseio.com";
export const FIREBASE_API_KEY = "AIza…";
```
The API key isn't a secret, and it's fine for it to be in a public repo. It only identifies the project; the rules from step 2 are what keep writes staff-only.

### 4. Turn on GitHub Pages
1. On GitHub, open the repo's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick **`main`** and **`/ (root)`**, and click **Save**.
3. After a minute or two, the site is live at:
   - Public page: `https://smoyamendez.github.io/AFL_Thermometer/`
   - Admin page: `https://smoyamendez.github.io/AFL_Thermometer/admin.html`

Every push to `main` republishes the site within a minute or two. Changing the numbers on the admin page doesn't need a push; those go straight to the database and show up live.

The public page deliberately doesn't link to the admin page. Share that URL with staff directly.

**Optional: a custom domain** (e.g. `fund.artsforlifenc.org`). In **Settings → Pages → Custom domain**, enter the domain, then add a `CNAME` DNS record pointing it to `smoyamendez.github.io` at your DNS provider. Tick **Enforce HTTPS** once it's available.

### First check after going live
1. Open the admin page. The strip at the bottom should say **● Live — synced across all devices**, and you should see the sign-in form.
2. Sign in with a staff account and click **+$25**. The note should say **Saved automatically**.
3. Open the public page on another device. It should show the new amount, and further admin changes should appear within about a second.

If saving shows **"Not allowed to save"**, the staff account's UID is missing from `admins` (step 2.4) or the rules weren't published.

### Embedding on artsforlifenc.org
Add `?embed=1` to show only the tube-and-stats card on a transparent background, with no logo or rainbow strip:
```html
<iframe src="https://smoyamendez.github.io/AFL_Thermometer/?embed=1"
        title="Paint Fund progress"
        style="width:100%; max-width:980px; height:720px; border:0;"></iframe>
```
The card shrinks to fit whatever height you give the iframe. On narrow screens it stacks the stats under the tube.

## How it works

**Data.** The database holds one record at `/paintFund`:
```json
{ "raised": 9250, "goal": 15000 }
```
- `raised` is clamped to ≥ 0 and `goal` to ≥ 1; both are whole dollars.
- The percent is `min(1, raised / goal)`, rounded for display. Overfunding shows a full tube with the true dollar amount.
- The values in `js/config.js` → `DEFAULTS` are shown until the first admin save creates the record.

**Live updates.** The public page opens a Firebase REST stream (`EventSource`), so admin edits appear on every visitor's screen within about a second. It re-reads the data every 8 seconds if the stream drops, and again whenever the tab comes back into view.

**Staff sign-in.** The admin page signs in against Firebase Auth's REST API. It keeps the refresh token in `localStorage` and attaches a fresh ID token to every save. The admin stays signed in on that browser until they click **Sign out**.

**Pages depend only on `js/store.js`** (`getState`, `setState`, `subscribe`, `auth`). To switch to another backend (Supabase, your own API), rewrite that one file.

## Design notes
Built from the design handoff. `docs/design-reference/` has the target screenshots.
- The public page always fits on one screen with no scrolling. The header shrinks on short screens, and the tube scales to fill the space left in the card, up to its full 300×770 size. On phones the stats stack under the tube.
- The tube is a single inline SVG in a 300×770 coordinate space, so it scales cleanly. The rainbow gradient fills the whole body, and an "empty" layer slides up to reveal it, so the colors don't compress as the tube fills.
- The tube has `role="progressbar"` with `aria-valuenow/min/max`, and the stats are an `aria-live` region.
- The tube has no scale ticks or number labels (removed by request).
- "Reset progress" asks for confirmation before setting the amount raised to $0.

## Known limitations
- If two staff members click the quick buttons at the same moment, the last save wins. Changes from other devices appear on the admin page live, so this is unlikely to matter in practice.
- The logo is a 785px PNG. Ask Arts For Life for an SVG or @2x PNG for sharper display on high-density screens.
