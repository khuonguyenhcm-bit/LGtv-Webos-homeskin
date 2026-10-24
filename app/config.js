// Launcher configuration. Edit this file, then run webos-launcher/install.sh.
// App ids: run `python3 sync-apps.py --list` (or look in app/apps.js after a sync).
window.CONFIG = {
  // Apps pinned to the dock row at the bottom, in this order. Missing apps are skipped.
  dockApps: ['netflix', 'youtube.leanback.v4', 'com.apple.appletv', 'com.apple.applemusic'],

  // Extra tiles placed first in the grid, ahead of the alphabetical rest.
  pinFirst: ['com.palm.app.settings'],

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

  // Tiles per row in the grid; the dock always has this many slots.
  columns: 4
};
