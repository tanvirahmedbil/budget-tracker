# Spent

A calm, simple spending tracker. Type what you spent, pick a category, done.
It installs on iPhone and Android like a normal app, works offline, and keeps
all your data on your phone.

## What it does

- **Add** – amount, what it was for, a category. It's saved under today's date,
  and you can tap **Today** to pick a different day.
- **View** – your spending as clean tables. Filter by **Day, Week, Month, Year**
  or a custom **Range**, and by category (e.g. *Therapy · October*). Switch
  between **Categories**, **Days** and **Items**. Tap any entry to edit or delete it.
- **Limits** – set a ceiling such as *Bike, 5,000 a month* or *Everything,
  15,000 a week*. When a new entry pushes you over, you get a full-screen
  **Over.** alert and a phone notification (if you turned notifications on).
- **Setup** – currency, the day your week starts, your categories,
  CSV/backup export, restore, and install help.

No accounts, no servers, no AI — just simple filters.

## Deploy on Netlify

1. Push this repo to GitHub (already done if you're reading this there).
2. In Netlify: **Add new site → Import an existing project → GitHub**, pick
   this repo.
3. Leave the build command empty. The publish directory is set to `public`
   by `netlify.toml`.
4. Deploy. Open the URL on your phone.

(Or drag the `public` folder onto https://app.netlify.com/drop.)

## Install it on your phone

- **iPhone** – open the site in **Safari** → **Share** → **Add to Home Screen**.
  Open Spent from the Home Screen icon, go to **Limits → Turn on** to allow
  notifications (needs iOS 16.4 or newer, and only works from the Home Screen app).
- **Android** – open the site in **Chrome** → **⋮** → **Install app**
  (or use **Setup → Install Spent**).

## Android app (APK)

Every push that changes the app makes GitHub build a real Android app
(`.github/workflows/android.yml`, using Capacitor). To install it:

1. On your Android phone, open the **Releases** page of this repo and
   download **Spent.apk** from the newest release.
2. Open the file and allow installing from your browser/files app when asked.
3. Later builds install as updates on top and keep your data.

The app works offline, sends real Android notifications for limits, and shares
CSV/backup files through the normal Android share sheet. Its data is separate
from the website's, so use **Back up** on the website → **Restore** in the app
to move it across.

The app is signed with the key in `android-signing/` (a debug key), which is
fine for installing on your own phones. Publishing to the Play Store will need
a proper private release key.

## Your data

Everything is stored on the device in the browser's local storage — nothing is
uploaded. Use **Setup → Back up** now and then; **Restore from backup** brings it
back on a new phone. Clearing Safari/Chrome website data will erase it.

## Run locally

Any static file server works:

```sh
npx serve public
```

## Files

```
public/
  index.html             the four screens
  styles.css             all styling (light + dark mode)
  app.js                 all logic
  sw.js                  offline support + notifications
  manifest.webmanifest   install info
  fonts/                 Bricolage Grotesque (SIL OFL), self-hosted
  icons/                 app icons
netlify.toml             Netlify config
```

When you change files, bump `CACHE` in `public/sw.js` (and `VERSION` in
`app.js`) so installed phones pick up the update.
