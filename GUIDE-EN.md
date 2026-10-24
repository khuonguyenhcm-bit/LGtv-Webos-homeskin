# Skin install guide for webos-vibehack

This pack turns the [webos-vibehack](https://github.com/OmkarK97/webos-vibehack) launcher (big rectangular tiles on a colour-glow background) into a new look:

- A full-screen scenic wallpaper
- A big clock + date + **weather** in the top-left corner
- **One bottom row of square icons** with the app name under each tile, side-scrolling with Left/Right
- Sharp 1024×1024 icons instead of the blurry 130px ones the TV serves
- Built-in **Settings** and **Inputs** tiles right in the row

Battle-tested on an LG QNED 55" running webOS 25 (the original launcher was tested on webOS 26).

## 1. Requirements

- An LG webOS TV with the original webos-vibehack installed and working (Developer Mode + at least one successful `install.sh`). If you don't have it yet, follow the original repo's README first.
- A Mac (or any machine with Node.js + Python 3) on the same Wi-Fi as the TV — the same machine you installed the original with.
- The webos-vibehack folder on that machine (with `install.sh`, `sync-apps.py`, and the `app/` folder).

## 2. Back up first (important)

In the webos-vibehack folder:

```bash
cp app/app.js app/app.js.bak
cp app/style.css app/style.css.bak
cp app/index.html app/index.html.bak
cp sync-apps.py sync-apps.py.bak
```

(Use any suffix you like.) This is your way back: restore these files and reinstall to return to the old look (section 6).

## 3. Copy the skin files over

Download this repo (Code → Download ZIP, or `git clone`), then copy:

| From this repo | To |
| --- | --- |
| `app/style.css` | `app/style.css` (overwrite) |
| `app/index.html` | `app/index.html` (overwrite) |
| `app/app.js` | `app/app.js` (overwrite) |
| `app/wallpaper.jpg` | `app/wallpaper.jpg` (new) |
| `app/config.js` | `app/config.js` (overwrite — or adapt your own config per section 5) |
| `sync-apps.py` | `sync-apps.py` (overwrite) |
| the `icons-custom/` folder | next to `sync-apps.py` |

## 4. Install to the TV

TV on, showing the home screen. On the Mac:

```bash
TV_HOST=192.168.1.6 ./install.sh    # use your TV's IP
```

The first run after changing `sync-apps.py` may show a pairing prompt on the TV — accept it. You're done when the log shows `Success` and `Launched application com.gathin.tvhome`. The `ares install` step often takes 1–2 minutes — that is not a hang.

## 5. Customising

- **Wallpaper:** replace `app/wallpaper.jpg` with any 16:9 image (≥1920×1080 recommended) and reinstall. Very bright images make the clock/weather harder to read — the skin already darkens the top and bottom edges to help.
- **Weather city:** open `app/app.js`, find `fetchWeather`, change `latitude`/`longitude` and the city name in the display string. Weather comes from Open-Meteo (free, no API key) and refreshes every 30 minutes.
- **App order:** edit `dockApps` in `app/config.js` (the first four tiles). The Settings tile is pinned right after the dock via `pinFirst`; the Inputs tile is always last. You can also **hold OK** on any tile on the TV to drag it elsewhere — the order is saved on the TV.
- **Hide an app:** add its id to `hiddenApps` in `app/config.js` (the sample already hides 8 Ball Pool). List ids with `venv/bin/python sync-apps.py <TV IP> --list`.
- **Per-app icons:** drop a square PNG (1024×1024 recommended) into `icons-custom/`, named exactly like the app's icon file in `app/icons/` after a sync. From then on your icon wins over the TV's on every sync.

## 6. Going back to the old look

```bash
cp app/app.js.bak app/app.js
cp app/style.css.bak app/style.css
cp app/index.html.bak app/index.html
cp sync-apps.py.bak sync-apps.py
TV_HOST=192.168.1.6 ./install.sh
```

## 7. How it works (for the curious)

- The TV serves icons at a maximum of 130×130 over its API, so stock icons get upscaled ~3× on a 4K panel and turn to mush. The patched `sync-apps.py` overwrites them with the files in `icons-custom/` after every sync.
- LG's real Settings app (`com.palm.app.settings`) is not in the app list the TV returns, so `sync-apps.py` injects a synthetic Settings tile (and an Inputs tile). Settings opens the TV's own Settings; Inputs opens the HDMI/Live TV list.
- Navigation was rewritten for a single row: Left/Right move, the row scrolls to follow; Up/Down are unused.
- The **Home button** is still handled by the original `home-watch` (running on an always-on Mac/Pi) — this skin doesn't touch that part.

## 8. Troubleshooting

- **Still the old look after installing:** make sure you overwrote all three of `app.js`, `style.css`, `index.html` and re-ran `install.sh` afterwards. Force a reload by opening another app, then pressing Home.
- **No weather line:** the TV has no internet route, or Open-Meteo hiccuped — it will appear at the next refresh (30 min) or when the launcher is reopened.
- **`install.sh` sits at "Installing" for a long time:** normal — give it up to ~3 minutes. If it truly stalls, check the TV is on and the Developer Mode session hasn't expired (open the Developer Mode app, check the hours left, press Extend if needed).
- **One app's icon is still blurry:** that app has no file in `icons-custom/` yet, so it's using the TV's 130px icon. Add one per section 5.

## 9. Credits

Original launcher: webos-vibehack (OmkarK97), based on cleanyourtv/tv-vibehack (Gathin). This skin is a presentation layer plus small utilities, shared for the LG webOS community. The wallpaper is Dragon Ball fan art found on Pinterest; app icons belong to their respective brands — personal use only.
