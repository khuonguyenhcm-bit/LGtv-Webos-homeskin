# Install guide — LG webOS Home Skin (all-in-one, one install)

This repo is **fully self-contained**: download just this repo, run one command, and your TV gets the new home screen — **no need to install the original repo first, no manual file copying**.

What you get:

- A full-screen scenic wallpaper
- A big clock + date + **weather** in the top-left corner
- **One bottom row of square icons** with the app name under each tile, side-scrolling with Left/Right
- Sharp 1024×1024 icons instead of the blurry 130px ones the TV serves
- Built-in **Settings** and **Inputs** tiles right in the row

Battle-tested on an LG QNED 55" running webOS 25.

> ⚠️ **Use at your own risk:** this is community software running on Developer Mode. In particular, a **TV firmware upgrade** can wipe Developer Mode, remove sideloaded apps, or break the launcher — think before upgrading, and if the launcher is gone after an upgrade, reinstall from scratch with this guide.

## 0. One-command install (recommended)

On a Mac on the same Wi-Fi as the TV, with Developer Mode already on (section 1):

```bash
curl -fsSL https://raw.githubusercontent.com/khuonguyenhcm-bit/LGtv-Webos-homeskin/main/setup.sh | bash
```

The script asks for the TV IP, asks whether ares is already paired (first run: it asks for the passphrase), then downloads the repo and installs the launcher in one run. No upstream webos-vibehack install first, no file copying, no git needed. Already have the repo? Open a terminal in it and run `TV_HOST=<TV IP> bash setup.sh` (download step skipped).

Two manual steps remain — both are LG's own gates: type the passphrase when asked, and accept the connection prompt on the TV during sync. Install takes 1–2 minutes.

## 1. Setup

**On the TV — enable Developer Mode (one time):**

1. Open the LG Content Store, install the **Developer Mode** app, open it and sign in with an LG account (free).
2. Turn on **Dev Mode Status** and **Key Server**. The TV reboots once.
3. Note the two values shown in the Developer Mode app: the **TV's IP address** and the **Passphrase** (6 characters). Dev Mode sessions expire — open the app and press **Extend** when the remaining time runs low.

**On your computer (Mac, or any machine with Node.js + Python 3), same Wi-Fi as the TV:**

- You need **Node.js** (to run LG's `ares` tools via `npx`) and **Python 3**. If Node is missing, get the LTS build from nodejs.org.
- Pair the computer with the TV (one time). Run these three commands in a terminal, replacing `192.168.1.6` with your TV's IP and `<passphrase>` with the code from above:

```bash
npx -y -p @webos-tools/cli ares-setup-device -a lgtv -i "{'host':'192.168.1.6','port':'9922','username':'prisoner'}"
npx -y -p @webos-tools/cli ares-novacom --device lgtv --getkey   # type the passphrase when asked
npx -y -p @webos-tools/cli ares-setup-device -m lgtv -i "{'privatekey':'lgtv_webos','passphrase':'<passphrase>'}"
```

## 2. Download this repo

You can skip this step if you use section 0 — `setup.sh` downloads the repo itself. This section is only for those who want the repo on their machine ahead of time (to customise first, or to reinstall often):

```bash
git clone https://github.com/khuonguyenhcm-bit/LGtv-Webos-homeskin.git
cd LGtv-Webos-homeskin
```

Or use **Code → Download ZIP** on GitHub, unzip it, and open a terminal in that folder.

## 3. Install to the TV — one command

TV on, showing its home screen. From inside the repo folder, run:

```bash
TV_HOST=192.168.1.6 bash setup.sh    # use your TV's IP
```

- `setup.sh` also handles ares pairing: on the first run it asks for the passphrase (6 characters, shown in the Developer Mode app) before installing; if this machine is already paired it skips that part — no more running the 3 ares commands separately.
- Under the hood, `setup.sh` calls `install.sh`: on the first run the script creates its own Python environment (`venv`) and installs what it needs — nothing else for you to do.
- The first connection shows an **SSAP pairing prompt on the TV — accept it**, otherwise the app sync step times out.
- The `ares install` step usually takes 1–2 minutes — that is not a hang. You're done when the log shows `Success` and `Launched application com.gathin.tvhome` — the new launcher opens on the TV right away.

## 4. (Optional) Make the Home button open this launcher

By default the remote's Home button goes to LG's own home screen. To make Home open this launcher instead, install the watcher on your computer (the computer must stay on/awake):

```bash
bash home-watch-mac.sh install "$(pwd)" 192.168.1.6
```

Remove it with `bash home-watch-mac.sh uninstall`. Pressing Home twice within 3 seconds still takes you to LG's home (handy for apps that aren't in the launcher).

## 5. Customising

- **Wallpaper:** replace `app/wallpaper.jpg` with any 16:9 image (≥1920×1080 recommended) and re-run step 3. Very bright images make the text harder to read — the skin already darkens the top and bottom edges to help.
- **Weather city:** open `app/app.js`, find `fetchWeather`, change `latitude`/`longitude` and the city name in the display string. Weather comes from Open-Meteo (free, no API key) and refreshes every 30 minutes. Default: Ho Chi Minh City.
- **App order:** list ids in `dockApps` in `app/config.js` in exactly the order you want (sample: YouTube, Apple Music, Netflix, Apple TV, Inputs, Settings, Apps) and set `columns` to the same count; everything after that is alphabetical. On the TV you can also **hold OK** on a tile to drag it elsewhere — the order is saved on the TV. A tile's name only appears while that tile is focused.
- **Hide an app:** add its id to `hiddenApps` in `app/config.js` (the sample already hides 8 Ball Pool). List ids with `venv/bin/python sync-apps.py <TV IP> --list`.
- **Per-app icons:** drop a square PNG (1024×1024 recommended) into `icons-custom/`, named exactly like the app's icon file in `app/icons/` after your first install. From then on your icon wins on every install.
- **Art Mode (the TV as a picture frame):** leave the home screen untouched for the configured minutes and the launcher turns into a full-screen photo slideshow (each photo stays perfectly still like a real painting, fading only when it changes to the next one, small clock in the corner); any key press exits. To enable:
  1. Run the photo server in this repo's `art-server/` folder on an always-on machine on the same network (Mac: edit the paths in `com.khuong.artserver.plist` and load the LaunchAgent as noted in the file; or just run `python3 art_server.py 8797 ./photos`). Five sample artworks are included.
  2. In `app/config.js` set `artServer` to `http://<that machine's IP>:8797`, adjust `artIdleMinutes` (default 3) and `artSlideSeconds` (default 60), then reinstall to the TV.
  3. Add/remove photos by opening `http://<that machine's IP>:8797/` on a phone or computer — an upload page is built in. Landscape 1920×1080 images look best. The TV fetches a fresh list each time Art Mode starts; if the server is off, Art Mode simply skips and the launcher behaves normally.

## 6. Updating / reinstalling

Download the new version over the old folder (keep two things: `.lgtv-key.json` — your TV's pairing key — and the `venv` folder if you don't want it rebuilt), then re-run step 3.

## 7. How it works (for the curious)

- The base is the webos-vibehack launcher (see credits, section 9); this repo bundles the base and the skin together, so one install is all it takes.
- The TV serves icons at a maximum of 130×130 over its API, so stock icons get upscaled ~3× on a 4K panel and turn to mush. The patched `sync-apps.py` overwrites them with the files in `icons-custom/` after every sync.
- LG's real Settings app (`com.palm.app.settings`) is not in the app list the TV returns, so `sync-apps.py` injects a synthetic Settings tile (and an Inputs tile). Settings opens the TV's own Settings; Inputs opens the HDMI/Live TV list.
- Navigation is built for a single row: Left/Right move, the row scrolls to follow; Up/Down are unused.

## 8. Troubleshooting

- **`Permission denied` running `./install.sh`:** ZIP downloads don't preserve the executable bit — use `bash install.sh` as shown (or `chmod +x install.sh`).
- **`TimeoutError ... opening handshake` during sync:** the TV is off, or the SSAP pairing prompt wasn't accepted on the TV, or the Developer Mode session expired (open the Developer Mode app, check the hours, press Extend). Fix and re-run.
- **ares pairing fails / you changed TVs:** delete `.lgtv-key.json` in this folder and redo the pairing in section 1.
- **Still the old look after installing:** open another app, then press Home to reload the launcher; check the install log shows both `Success` and `Launched`.
- **No weather line:** the TV has no internet route, or Open-Meteo hiccuped — it will appear at the next refresh (30 min) or when the launcher is reopened.
- **One app's icon is still blurry:** that app has no file in `icons-custom/` yet. Add one per section 5.

## 9. Credits

Original launcher: [webos-vibehack](https://github.com/OmkarK97/webos-vibehack) by OmkarK97, based on [cleanyourtv / tv-vibehack](https://github.com/Gathin23/cleanyourtv) by Gathin (see `LICENSE`). This repo is an all-in-one bundle of that launcher plus a skin, an icon set, and small utilities, shared for the LG webOS community. The wallpaper is Dragon Ball fan art (Kame House) found on Pinterest; app icons belong to their respective brands — personal use only.
