// Launcher configuration. Edit this file, then run webos-launcher/install.sh.
// App ids: run `python3 sync-apps.py --list` (or look in app/apps.js after a sync).
window.CONFIG = {
  // The front of the row, in this exact order. Missing apps are skipped.
  // Everything after these is alphabetical. Raise `columns` to match the count.
  dockApps: ['youtube.leanback.v4', 'com.apple.applemusic', 'netflix', 'com.apple.appletv', 'com.gathin.tvhome.inputs', 'com.palm.app.settings', 'com.webos.app.discovery'],

  // Extra tiles placed right after the dockApps, ahead of the alphabetical rest.
  pinFirst: [],

  // Apps never shown as tiles (inputs and Live TV are already in the Inputs menu).
  hiddenApps: [
    'com.gathin.tvhome',
    'com.webos.app.livetv',
    'com.webos.app.hdmi1', 'com.webos.app.hdmi2', 'com.webos.app.hdmi3', 'com.webos.app.hdmi4',
    'com.webos.app.lgchannels',   // LG Channels
    'shortcutcopilot',            // Copilot
    'com.miniclip.eightballpool'  // 8 Ball Pool (hidden at user request)
  ],

  // The Live TV app, offered at the end of the Inputs menu. Leave empty to omit.
  liveTvApp: 'com.webos.app.livetv',

  // Art Mode: after artIdleMinutes with no remote input on the home screen,
  // show a full-screen photo slideshow served by the art server (art-server/
  // folder in this repo) running on a computer on the same network.
  // Set artServer to that computer's address, or '' to disable Art Mode.
  artServer: 'http://192.168.1.50:8797',
  artIdleMinutes: 3,
  artSlideSeconds: 60,

  // How many dockApps the row takes before the alphabetical rest (see above).
  columns: 7
};
