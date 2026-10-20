# 150 days 百五十日

A daily tracker for 150 days: **20 oct 2026 to 18 mar 2027**. Built as an installable web app (PWA) for iPhone,
with the same washi / sumi / hanko design language as tangocheck. No build step, no server, no account.

## What you log each day

| part | questions |
| --- | --- |
| data 数 | hours spent, topics worked |
| gym 鍛 | session (push, pull, legs+abs, rest), diet adhered, supplements adhered |
| japanese 語 | anki vocab studied, lesson today, input/output today, studied (optional note) |
| piano 音 | session today, worked on |
| sleep 眠 | ready to sleep by 2am |

Everything saves as you tap. A part counts as logged once all its yes/no and number questions are answered
(the free-text notes are optional). When all five parts are logged the day gets a 済 stamp.

- **the day number** is the hero, written in kanji and brushed in stroke by stroke (day 24 is 二十四).
- **the enso** closes as days are completed; the thin line around it is time passing, so the gap is what you missed.
- **five strokes per day** in the calendar: data, gym, japanese, piano, sleep. Green is all good, amber some, red none.
  Tap a name (data, gym, ...) to bring one stroke forward and see its numbers.
- **perfect / partial / none** count whole days: perfect is all five strokes green, none is a day with nothing logged
  (or everything answered with nothing done), partial is anything between. The streak is the run of perfect days
  that reaches today.
- **what makes a stroke green:** data 5+ hours (amber under 5, none at 0); gym all three of session (rest counts),
  diet, supplements (amber for any one or two); japanese all three of anki 50 or more, lesson, input/output (amber for any
  one or two, and anki under 50 caps it at amber); piano and sleep are yes (green) or no (none).
- **the day rolls over at 5am**, not midnight, because you sleep around 2am. Logging at 1:30am still counts for the day before.
- **sound and touch:** wooden toks on taps, a page-turn swish, a chime when a part is done, a stamp and bell when the day is
  complete, sparkles when the streak grows. The speaker button in the header turns sound and haptics off together. iOS mutes
  sounds with the ring/silent switch. Haptics need iOS 17.4 or later.
- **going back:** drag in from the left edge, or tap "days".
- days that haven't come yet are locked. Past days can be filled in later.

## Put it on your iPhone

The app is static files, so it needs to be hosted somewhere your phone can open it. Over **https** it also works offline.

1. Host this folder (GitHub Pages, Cloudflare Pages, Netlify, anything that serves static files).
2. On the iPhone, open the link in **Safari**, tap Share, then **Add to Home Screen**.
3. From then on, **only open it from the home screen icon.**

Your log is stored inside the app on the phone. Safari and the home-screen app keep separate storage on iOS, so
anything typed in a Safari tab will not show up in the installed app. Install first, then log.

To try it on the same wi-fi without hosting: run `python -m http.server 8150 --bind 0.0.0.0` in this folder and open
`http://<your computer's ip>:8150` on the phone. That works for a home-screen shortcut but not offline.

## Backup

The log lives on the phone only. **backup** (top right of the days page) exports a `.json` file through the share sheet
(save it to Files, AirDrop it, email it). **import** restores it; days in the file replace the same days in the app.
A small red mark appears on the button when you have 5+ days logged and no export in the last 14 days.

In the native app a copy also saves itself after every change: `150-days-latest.json`, plus one file per day in `history/`, in the
app's Documents folder, which shows in the Files app under On My iPhone > 150 days. If the app's web storage is ever cleared, the
app takes the copy back on launch (only when the log is empty, and an empty log never overwrites the copy). The copy goes when
the app is deleted or the phone is lost, so exports (ideally to iCloud Drive) still matter.

## Develop

```
python -m http.server 8150
```

Open `http://localhost:8150`. Add `?today=2026-12-20` to pretend it is that day; that mode uses its own storage key,
so it never touches the real log. Bump nothing for updates: the service worker tries the network first.

## Files

- `index.html`, `style.css`, `app.js`: the app. `strokes.js` holds the kanji stroke paths it draws.
- `sw.js`: offline cache. `manifest.webmanifest` and the `icon*.png` files make it installable.
- `fonts/`: Shippori Mincho. See `NOTICE.md` for font and stroke-data licenses.

## As a real iPhone app (full screen, normal keyboard)

The web app on the home screen is limited by what iOS gives home-screen web apps (on an iPhone 16 Pro Max the page area is
62pt shorter than the screen). The same code also builds as a native app, which gets the whole screen and the system keyboard,
plus real haptics, a status bar that matches the theme, and a native share sheet for backups.

It is built by GitHub (`.github/workflows/ios.yml`, a Capacitor wrapper compiled on a macOS runner) whenever the `ios-app`
branch is pushed, and published as an unsigned `.ipa`:
https://github.com/tariqashshareef/150-day-tracker/releases/download/ios-latest/150-days.ipa

Install it from Windows with **Sideloadly**:

1. Install iTunes and iCloud from apple.com (not the Microsoft Store versions), then Sideloadly from sideloadly.io.
2. Plug the iPhone in and tap Trust.
3. Drag `150-days.ipa` into Sideloadly, enter your Apple ID, press Start.
4. On the iPhone: Settings > Privacy & Security > Developer Mode on (then restart), and Settings > General >
   VPN & Device Management > trust your Apple ID.
5. A free Apple ID signs the app for **7 days**; repeat step 3 each week (install over the top, your data stays).
   A paid developer account ($99/year) lasts a year.

### Updating from SideStore (one tap)

Every build also publishes a SideStore source next to the `.ipa`, so SideStore can offer each new build as an update:

```
https://github.com/tariqashshareef/150-day-tracker/releases/download/ios-latest/source.json
```

Builds are numbered `1.0.<run number>`; SideStore offers an update when that number is higher than the installed app's.

One time, on the phone:

1. In the app: **backup > export**, to be safe.
2. SideStore > **Sources** > **+**, paste the url above, add it. (Or open `sidestore://source?url=` followed by the url, in Safari.)
3. Open the source, tap **150 days**, and install it once from there. It installs over the copy you already have (same bundle id,
   your log stays). That install is what links the app to the source: an app added from a file with **+** is not linked, so it never
   shows an update.

Every update after that:

1. Push to `ios-app` (`git push origin main:ios-app`) and wait for the build in the Actions tab to go green.
2. SideStore > **My Apps**, pull down to refresh. **150 days** appears under updates, tap **UPDATE**.

The app keeps its log in its own storage, separate from the home-screen web app: **backup > export** in the old one, then
**backup > import** in the new one. To change the app, edit the files and push to `ios-app`; to see the web version, push `main`.
