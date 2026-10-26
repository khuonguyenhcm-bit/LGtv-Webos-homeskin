/*
 * tvOS style home for webOS: black, a pinned dock row, an app grid, and one glass highlight that
 * springs between tiles. A port of the Android launcher in ../../launcher.
 *
 * webOS does not let third-party apps list installed apps, so sync-apps.py writes them into apps.js.
 */
(function () {
  'use strict';

  var COLUMNS = Math.max(1, CONFIG.columns || 4);
  var TILE_W = 168, TILE_H = 168;
  var PITCH = 228;              // tile width + gap in the single dock row
  var ROW_LEFT = 96;
  var ROW_TOP = 786;            // the dock hugs the bottom; labels sit below the tiles
  var FOCUS_SCALE = 1.16;
  var GLASS_PAD = 12;           // room for the glass glow around the scaled tile
  var INPUTS_ID = 'com.gathin.tvhome.inputs';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, ESC: 27 };

  var GREETINGS = [[5, 'Good night'], [12, 'Good morning'], [17, 'Good afternoon'], [22, 'Good evening'], [24, 'Good night']];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'];

  var ICON_INPUT = 'M18,7V4c0,-1.1 -0.9,-2 -2,-2H8C6.9,2 6,2.9 6,4v3H5v6l3,6v3h8v-3l3,-6V7H18zM8,4h8v3h-2V5h-1v2h-2V5h-1v2H8V4z';
  var ICON_LIVETV = 'M21,6h-7.59l3.29,-3.29L16,2l-4,4l-4,-4l-0.71,0.71L10.59,6H3c-1.1,0 -2,0.89 -2,2v12c0,1.1 0.9,2 2,2h18c1.1,0 2,-0.89 2,-2V8C23,6.89 22.1,6 21,6zM21,20H3V8h18V20zM9,10v8l7,-4L9,10z';

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), tilesEl = $('tiles'), glass = $('glass'), hero = $('hero');
  var ambients = [$('ambientA'), $('ambientB')], ambientFront = 0, ambientColor = null;
  var pills = [$('btnInputs'), $('btnWifi'), $('btnSettings')];
  var panel = $('inputsPanel');

  var items = [];               // {app, el, color}
  var zone = 'grid';            // 'grid' | 'top' | 'inputs'
  var focused = 0, pillFocus = 0, inputFocus = 0, inputRows = [];
  var offset = 0, heroShown = false, glassShown = false;
  var editing = null;           // {item, snapshot} while a tile is being moved

  // ---- luna bus ------------------------------------------------------------------------------

  var bridges = [];   // keep a reference: a collected bridge drops its callback

  function luna(uri, params, cb) {
    try {
      var b = new PalmServiceBridge();
      b.onservicecallback = function (msg) {
        var res;
        try { res = JSON.parse(msg); } catch (e) { res = { returnValue: false }; }
        if (cb) cb(res);
        if (!params || !params.subscribe) bridges.splice(bridges.indexOf(b), 1);
      };
      bridges.push(b);
      b.call(uri, JSON.stringify(params || {}));
    } catch (e) {
      if (cb) cb({ returnValue: false, errorText: String(e) });   // not on a TV (desktop preview)
    }
  }

  function launch(id, title, params) {
    luna('luna://com.webos.applicationManager/launch', { id: id, params: params || {} }, function (res) {
      if (res.returnValue === false) toast("Can't open " + (title || id));
    });
  }

  var toastTimer;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.classList.add('shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('shown'); }, 2200);
  }

  // ---- apps ----------------------------------------------------------------------------------

  function orderedApps() {
    var all = (window.TV_APPS && TV_APPS.apps) || [];
    var byId = {};
    all.forEach(function (a) { byId[a.id] = a; });
    var hidden = {};
    (CONFIG.hiddenApps || []).forEach(function (id) { hidden[id] = true; });
    var byTitle = function (a, b) { return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1; };

    // An order arranged on the TV wins, until dockApps in config.js changes.
    var saved = loadOrder();
    if (saved) {
      var placed = [];
      saved.forEach(function (id) {
        if (byId[id] && !hidden[id]) { placed.push(byId[id]); hidden[id] = true; }
      });
      return placed.concat(all.filter(function (a) { return !hidden[a.id]; }).sort(byTitle));
    }

    var dock = [];
    (CONFIG.dockApps || []).forEach(function (id) {
      if (byId[id] && !hidden[id] && dock.length < COLUMNS) { dock.push(byId[id]); hidden[id] = true; }
    });
    var rest = all.filter(function (a) { return !hidden[a.id]; });
    rest.sort(byTitle);
    var pinned = [];
    (CONFIG.pinFirst || []).forEach(function (id) {
      var i = rest.findIndex(function (a) { return a.id === id; });
      if (i >= 0) pinned.push(rest.splice(i, 1)[0]);
    });
    return dock.concat(pinned, rest);
  }

  var ORDER_KEY = 'tvhome.order';

  function loadOrder() {
    try {
      var s = JSON.parse(localStorage.getItem(ORDER_KEY));
      return s && s.dock === (CONFIG.dockApps || []).join(',') ? s.ids : null;
    } catch (e) {
      return null;
    }
  }

  function saveOrder() {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify({
        dock: (CONFIG.dockApps || []).join(','),
        ids: items.map(function (it) { return it.app.id; })
      }));
    } catch (e) { /* storage unavailable: the order lasts until the app restarts */ }
  }

  function rowOf(i) { return 0; }
  function tileLeft(i) { return ROW_LEFT + i * PITCH; }
  function tileTop(i) { return ROW_TOP; }

  function build() {
    tilesEl.innerHTML = '';
    items = orderedApps().map(function (app) {
      var el = document.createElement('div');
      el.className = 'item';
      var card = document.createElement('div');
      card.className = 'card';
      var img = document.createElement('img');
      var item = { app: app, el: el, card: card, color: null };
      img.onload = function () { paintTile(item, img); };
      img.src = app.icon;
      card.appendChild(img);
      el.appendChild(card);
      var name = document.createElement('div');
      name.className = 'name';
      name.textContent = app.title;
      el.appendChild(name);
      el.addEventListener('mouseover', function () {
        if (zone !== 'inputs' && zone !== 'settings' && !editing) focusTile(items.indexOf(item));
      });
      el.addEventListener('click', function () {
        if (editing) finishEdit(true);
        else if (app.id === INPUTS_ID) showInputs();
        else if (isSettingsTile(app)) showSettings();
        else launch(app.id, app.title);
      });
      tilesEl.appendChild(el);
      return item;
    });
    layout();
  }

  /** Places every tile by its position in items; tiles glide when the order changes. */
  function layout() {
    items.forEach(function (it, i) {
      it.el.style.left = tileLeft(i) + 'px';
      it.el.style.top = tileTop(i) + 'px';
    });

    $('dockBand').style.display = 'none';
  }

  function animateIn() {
    items.forEach(function (it, i) {
      it.el.classList.remove('shown');
      setTimeout(function () { it.el.classList.add('shown'); }, 60 + Math.min(i, 16) * 40);
    });
  }

  /**
   * Store icons are square logos on a solid colour: fill the wide tile with that colour so the logo
   * reads as a banner. LG's system icons are glyphs on transparent: use the app's own colour.
   */
  function paintTile(item, img) {
    var px = null, edge = null;
    try {
      var c = document.createElement('canvas');
      c.width = 12; c.height = 12;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, 12, 12);
      px = g.getImageData(0, 0, 12, 12).data;
      edge = edgeColor(img);
    } catch (e) { /* tainted canvas: fall back to the app's colour */ }

    var glyphColor = null;
    if (edge && edge[3] > 200) {
      item.card.style.background = 'rgb(' + edge[0] + ',' + edge[1] + ',' + edge[2] + ')';
    } else {
      item.card.classList.add('glyph');
      item.card.style.background = glyphBackground(item.app.iconColor);
      glyphColor = glyphBackground(item.app.iconColor) === '#2c2c2e' ? null : parseColor(item.app.iconColor);
    }
    // A white glyph says nothing about the app: glow in the tile's colour instead.
    item.color = glyphColor || (px ? vividColor(px) : parseColor(item.app.iconColor));
    if (items[focused] === item) setAmbient(item.color);
  }

  /**
   * The icon's background at full size: a corner pixel, or the middle of the left edge for rounded
   * icons whose corners are transparent. A downscaled sample would blend in the logo.
   */
  function edgeColor(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    var corner = g.getImageData(2, 2, 1, 1).data;
    return corner[3] > 200 ? corner : g.getImageData(2, Math.floor(h / 2), 1, 1).data;
  }

  function glyphBackground(hex) {
    var c = parseColor(hex);
    if (!c) return '#2c2c2e';
    var hsv = rgbToHsv(c);
    if (hsv[1] < 0.15 && (hsv[2] > 0.85 || hsv[2] < 0.1)) return '#2c2c2e';   // white or black glyph colour
    return 'rgb(' + c.join(',') + ')';
  }

  /** A vivid colour from the icon: the most saturated, not too dark pixel, or the lifted average. */
  function vividColor(px) {
    var best = null, bestScore = -1, sum = [0, 0, 0], n = 0;
    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      var p = [px[i], px[i + 1], px[i + 2]];
      sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; n++;
      var hsv = rgbToHsv(p);
      var score = hsv[1] * Math.min(1, hsv[2] * 1.4);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!n) return [68, 68, 68];
    if (bestScore < 0.25) {   // nearly monochrome icon (e.g. white): its average, lifted
      var avg = rgbToHsv([sum[0] / n, sum[1] / n, sum[2] / n]);
      avg[2] = Math.max(avg[2], 0.55);
      return hsvToRgb(avg);
    }
    var h = rgbToHsv(best);
    h[1] = Math.min(1, h[1] * 1.1);
    h[2] = Math.max(0.5, h[2]);
    return hsvToRgb(h);
  }

  function parseColor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    var v = parseInt(m[1], 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  }

  function rgbToHsv(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
  }

  function hsvToRgb(hsv) {
    var h = hsv[0], s = hsv[1], v = hsv[2];
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map(function (k) { return Math.round((k + m) * 255); });
  }

  // ---- launcher settings -----------------------------------------------------------------------
  //
  // Three layers, lowest first: config.js defaults, the config.json served by the art server
  // (edited from the phone page at the art server's /settings), and this TV's own panel choices
  // in localStorage. A layer wins over the ones below when its `rev` is newer, so a change made
  // on the phone reaches the TV at the next launch and a change made on the TV is pushed back.

  var SETTINGS_KEY = 'tvhome.settings';
  var SETTINGS_TILE_ID = 'com.palm.app.settings';
  var DOCK_SIZES = { S: 144, M: 168, L: 192 };
  var WEATHER_CITIES = [
    { name: 'Ho Chi Minh City', lat: 10.8231, lon: 106.6297 },
    { name: 'Ha Noi', lat: 21.0278, lon: 105.8342 },
    { name: 'Da Nang', lat: 16.0544, lon: 108.2022 },
    { name: 'Da Lat', lat: 11.9404, lon: 108.4583 },
    { name: 'Nha Trang', lat: 12.2388, lon: 109.1967 },
    { name: 'Can Tho', lat: 10.0452, lon: 105.7469 }
  ];

  function defaultSettings() {
    return {
      wallpaper: 'bundled',   // 'bundled', or a photo/GIF file name on the art server
      dockSize: 'M',
      artEnabled: true,
      artIdleMinutes: CONFIG.artIdleMinutes || 3,
      artSlideSeconds: CONFIG.artSlideSeconds || 60,
      weatherCity: (CONFIG.weather && CONFIG.weather.name) || 'Ho Chi Minh City',
      rev: 0
    };
  }

  var SETTINGS = defaultSettings();

  function mergeSettings(dst, src) {
    if (!src) return dst;
    ['wallpaper', 'dockSize', 'artEnabled', 'artIdleMinutes', 'artSlideSeconds', 'weatherCity', 'rev']
      .forEach(function (k) { if (src[k] !== undefined) dst[k] = src[k]; });
    return dst;
  }

  function loadLocalSettings() {
    try { mergeSettings(SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY))); } catch (e) {}
  }

  function saveSettings(push) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) {}
    if (push !== false) pushServerConfig();
  }

  function pushServerConfig() {
    if (!ART_SERVER) return;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ART_SERVER + '/config.json', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(SETTINGS));
    } catch (e) { /* server offline: the local copy still applies */ }
  }

  function pullServerConfig(done) {
    if (!ART_SERVER) { if (done) done(false); return; }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', ART_SERVER + '/config.json', true);
      xhr.timeout = 5000;
      xhr.onload = function () {
        var adopted = false;
        try {
          var cfg = JSON.parse(xhr.responseText);
          if (cfg && (cfg.rev || 0) > (SETTINGS.rev || 0)) {
            SETTINGS = mergeSettings(defaultSettings(), cfg);
            saveSettings(false);
            adopted = true;
          }
        } catch (e) {}
        if (done) done(adopted);
      };
      xhr.onerror = function () { if (done) done(false); };
      xhr.ontimeout = function () { if (done) done(false); };
      xhr.send();
    } catch (e) { if (done) done(false); }
  }

  function weatherCity() {
    for (var i = 0; i < WEATHER_CITIES.length; i++) {
      if (WEATHER_CITIES[i].name === SETTINGS.weatherCity) return WEATHER_CITIES[i];
    }
    if (CONFIG.weather) return CONFIG.weather;
    return WEATHER_CITIES[0];
  }

  function applySettings() {
    // Wallpaper: a server photo/GIF replaces the bundled image; a missing file falls back to it.
    if (SETTINGS.wallpaper && SETTINGS.wallpaper !== 'bundled' && ART_SERVER) {
      var url = ART_SERVER + '/photos/' + encodeURIComponent(SETTINGS.wallpaper);
      var probe = new Image();
      probe.onload = function () { document.body.style.backgroundImage = 'url("' + url + '")'; };
      probe.onerror = function () { document.body.style.backgroundImage = ''; };
      probe.src = url;
    } else {
      document.body.style.backgroundImage = '';
    }

    // Dock size: tile geometry is all in the TILE_/PITCH/ROW_TOP vars the layout code reads.
    var px = DOCK_SIZES[SETTINGS.dockSize] || 168;
    TILE_W = px; TILE_H = px; PITCH = px + 60; ROW_TOP = 954 - px;
    items.forEach(function (it) {
      it.el.style.width = px + 'px';
      it.card.style.width = px + 'px';
      it.card.style.height = px + 'px';
    });
    if (items.length) {
      layout();
      // While a panel is open, focusTile would steal the zone back to the grid
      // (it calls setZone('grid')) and the arrows would move home tiles behind
      // the panel. The panel's close path refocuses the tile itself.
      if (zone !== 'settings' && zone !== 'inputs') focusTile(focused);
    }

    // Photo Frame timing.
    ART_IDLE_MS = SETTINGS.artEnabled ? (SETTINGS.artIdleMinutes || 0) * 60000 : 0;
    ART_SLIDE_MS = (SETTINGS.artSlideSeconds || 60) * 1000;
    if (artOn && !SETTINGS.artEnabled) stopArt();
    resetIdle();
  }

  // ---- settings panel --------------------------------------------------------------------------

  var setPanel = $('settingsPanel'), setRowsEl = $('settingsRows');
  var setRows = [], setFocus = 0, setSwallowOk = false;
  var wallpaperOptions = [{ value: 'bundled', label: 'Kame House (built-in)' }];

  function cycleOptions(values, labels) {
    return values.map(function (v, i) { return { value: v, label: labels[i] }; });
  }

  function settingDefs() {
    return [
      { key: 'wallpaper', label: 'Wallpaper', type: 'cycle', options: wallpaperOptions },
      { key: 'dockSize', label: 'Dock size', type: 'cycle',
        options: cycleOptions(['S', 'M', 'L'], ['Small', 'Medium', 'Large']) },
      { key: 'artEnabled', label: 'Photo Frame', type: 'cycle',
        options: cycleOptions([true, false], ['On', 'Off']) },
      { key: 'artIdleMinutes', label: 'Frame starts after', type: 'cycle',
        options: cycleOptions([1, 3, 5, 10], ['1 min', '3 min', '5 min', '10 min']) },
      { key: 'artSlideSeconds', label: 'Each photo shows', type: 'cycle',
        options: cycleOptions([30, 60, 120], ['30 sec', '60 sec', '2 min']) },
      { key: 'weatherCity', label: 'Weather city', type: 'cycle',
        options: WEATHER_CITIES.map(function (c) { return { value: c.name, label: c.name }; }) },
      { key: 'tvSettings', label: 'TV settings', type: 'action',
        run: function () { launch('com.palm.app.settings', 'Settings'); } },
      { key: 'netSettings', label: 'Network settings', type: 'action',
        run: function () { launch('com.palm.app.settings', 'Settings', { target: 'network' }); } },
      { key: 'reset', label: 'Reset launcher settings', type: 'action',
        run: function () {
          var rev = (SETTINGS.rev || 0) + 1;
          SETTINGS = defaultSettings();
          SETTINGS.rev = rev;
          saveSettings();
          applySettings();
          renderSetRows();
          toast('Launcher settings reset');
        } }
    ];
  }

  function renderSetRows() {
    setRowsEl.innerHTML = '';
    setRows = settingDefs().map(function (def, idx) {
      var row = document.createElement('div');
      row.className = 'setRow';
      var lab = document.createElement('span');
      lab.textContent = def.label;
      var val = document.createElement('span');
      val.className = 'val';
      row.appendChild(lab);
      row.appendChild(val);
      row.addEventListener('mouseover', function () { focusSet(idx); });
      row.addEventListener('click', function () {
        focusSet(idx);
        if (def.type === 'action') runSetAction();
        else changeSetting(1);
      });
      setRowsEl.appendChild(row);
      return { def: def, el: row, valEl: val };
    });
    renderSetValues();
    focusSet(setFocus);
  }

  function renderSetValues() {
    setRows.forEach(function (r) {
      if (r.def.type !== 'cycle') { r.valEl.textContent = '\u203A'; return; }
      var cur = SETTINGS[r.def.key];
      var label = '';
      r.def.options.forEach(function (o) { if (o.value === cur) label = o.label; });
      if (!label && r.def.key === 'wallpaper' && cur) label = String(cur).replace(/\.[a-z0-9]+$/i, '');
      r.valEl.textContent = '\u2039 ' + (label || String(cur)) + ' \u203A';
    });
  }

  function focusSet(i) {
    if (!setRows.length) return;
    if (setRows[setFocus]) setRows[setFocus].el.classList.remove('focused');
    setFocus = Math.max(0, Math.min(i, setRows.length - 1));
    setRows[setFocus].el.classList.add('focused');
  }

  function changeSetting(dir) {
    var r = setRows[setFocus];
    if (!r || r.def.type !== 'cycle') return;
    var opts = r.def.options, idx = -1;
    opts.forEach(function (o, i) { if (o.value === SETTINGS[r.def.key]) idx = i; });
    idx = (idx + dir + opts.length) % opts.length;
    SETTINGS[r.def.key] = opts[idx].value;
    SETTINGS.rev = (SETTINGS.rev || 0) + 1;
    applySettings();
    saveSettings();
    renderSetValues();
    if (r.def.key === 'weatherCity') fetchWeather();
  }

  function runSetAction() {
    var r = setRows[setFocus];
    if (!r || r.def.type !== 'action') return;
    setSwallowOk = true;   // the OK keyup that follows must not also open the focused tile
    hideSettings();
    r.def.run();
  }

  function showSettings() {
    if (ART_SERVER) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', ART_SERVER + '/list.json', true);
        xhr.timeout = 4000;
        xhr.onload = function () {
          try {
            var names = JSON.parse(xhr.responseText).photos || [];
            wallpaperOptions = [{ value: 'bundled', label: 'Kame House (built-in)' }].concat(
              names.map(function (n) { return { value: n, label: n.replace(/\.[a-z0-9]+$/i, '') }; }));
            if (zone === 'settings') renderSetRows();
          } catch (e) {}
        };
        xhr.send();
      } catch (e) {}
    }
    renderSetRows();
    setPanel.classList.remove('hidden');
    pills[pillFocus].classList.remove('focused');
    if (items[focused]) items[focused].el.classList.remove('focused');
    hideGlass();
    setFocus = 0;
    focusSet(0);
    zone = 'settings';
  }

  function hideSettings() {
    setPanel.classList.add('hidden');
    zone = 'none';
    focusTile(focused);
  }

  function isSettingsTile(app) { return app && app.id === SETTINGS_TILE_ID; }

  // ---- focus & glass -------------------------------------------------------------------------

  function focusTile(i) {
    if (!items.length) return;
    i = Math.max(0, Math.min(i, items.length - 1));
    setZone('grid');
    if (items[focused]) items[focused].el.classList.remove('focused');
    focused = i;
    items[i].el.classList.add('focused');

    var top = tileTop(i);
    // Scroll sideways just enough to keep the focused tile comfortably on screen.
    var maxOff = Math.max(0, ROW_LEFT + (items.length - 1) * PITCH + TILE_W + 60 - 1920);
    if (tileLeft(i) - offset + TILE_W > 1800) offset = tileLeft(i) + TILE_W - 1800;
    if (tileLeft(i) - offset < 60) offset = tileLeft(i) - 60;
    offset = Math.max(0, Math.min(offset, maxOff));
    stage.style.transform = 'translateX(' + (-offset) + 'px)';

    var w = TILE_W * FOCUS_SCALE + 2 * GLASS_PAD, h = TILE_H * FOCUS_SCALE + 2 * GLASS_PAD;
    var x = tileLeft(i) + TILE_W / 2 - w / 2, y = top + TILE_H / 2 - h / 2;
    glass.style.width = w + 'px';
    glass.style.height = h + 'px';
    glass.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    if (!glassShown) {
      // First show: jump there without the spring, then fade in.
      glass.style.transition = 'none';
      glass.offsetWidth;   // flush the jump before restoring the transition
      glass.style.transition = '';
      glass.style.opacity = '1';
      glassShown = true;
    }

    hideHero();
    setAmbient(items[i].color);
  }

  function hideGlass() {
    glassShown = false;
    glass.style.opacity = '0';
  }

  function showHero(item) {
    var label = item.app.title;
    hero.style.top = (DOCK_TOP - 28 - 52 - 96) + 'px';
    if (!heroShown) {
      hero.textContent = label;
      hero.style.transform = 'none';
      hero.style.opacity = '1';
      heroShown = true;
    } else if (hero.textContent !== label) {
      hero.style.opacity = '0';
      hero.style.transform = 'translateX(-24px)';
      clearTimeout(hero.swap);
      hero.swap = setTimeout(function () {
        hero.textContent = label;
        hero.style.transition = 'none';
        hero.style.transform = 'translateX(24px)';
        hero.offsetWidth;
        hero.style.transition = '';
        hero.style.transform = 'none';
        hero.style.opacity = '1';
      }, 120);
    }
    setAmbient(item.color);
  }

  function hideHero() {
    if (!heroShown) return;
    heroShown = false;
    hero.style.opacity = '0';
  }

  /** Crossfades the glow to a new colour by swapping between two layers. */
  function setAmbient(color) {
    if (!color) return;
    var key = color.join(',');
    if (key === ambientColor) return;
    ambientColor = key;
    var back = ambients[1 - ambientFront];
    back.style.background = 'radial-gradient(circle 1190px at 32% 42%, rgba(' + key + ',0.36) 0%, rgba(' +
      key + ',0.15) 50%, rgba(' + key + ',0) 100%)';
    back.style.opacity = '1';
    ambients[ambientFront].style.opacity = '0';
    ambientFront = 1 - ambientFront;
  }

  function focusPill(i) {
    setZone('top');
    document.body.classList.remove('scrolled');
    pills[pillFocus].classList.remove('focused');
    pillFocus = Math.max(0, Math.min(i, pills.length - 1));
    pills[pillFocus].classList.add('focused');
  }

  function setZone(z) {
    if (zone === z) return;
    if (zone === 'top') pills[pillFocus].classList.remove('focused');
    if (zone === 'grid') {
      if (items[focused]) items[focused].el.classList.remove('focused');
      hideGlass();
    }
    zone = z;
  }

  /** The pill straight above a dock tile, by horizontal distance. */
  function pillAbove(i) {
    var cx = tileLeft(i) + TILE_W / 2, best = 0, bestD = Infinity;
    pills.forEach(function (p, k) {
      var r = p.getBoundingClientRect();
      var d = Math.abs(r.left + r.width / 2 - cx);
      if (d < bestD) { bestD = d; best = k; }
    });
    return best;
  }

  // ---- top bar -------------------------------------------------------------------------------

  function updateClock() {
    var now = new Date(), h = now.getHours();
    for (var k = 0; k < GREETINGS.length; k++) {
      if (h < GREETINGS[k][0]) { $('greeting').textContent = GREETINGS[k][1]; break; }
    }
    var m = now.getMinutes();
    $('clock').textContent = ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m;
    $('ampm').textContent = h < 12 ? 'am' : 'pm';
    $('date').textContent = DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
  }

  /** Shows the Wi-Fi network name when the TV reports it, otherwise the connection type. */
  function watchNetwork() {
    luna('luna://com.palm.connectionmanager/getStatus', { subscribe: true }, function (res) {
      if (res.returnValue === false && !res.wifi && !res.wired) return;
      var text = 'Wi-Fi';
      if (res.wired && res.wired.state === 'connected') text = 'Ethernet';
      else if (res.wifi && res.wifi.state === 'connected') text = res.wifi.ssid || 'Wi-Fi';
      else if (res.isInternetConnectionAvailable === false) text = 'Offline';
      $('wifiLabel').textContent = text;
    });
  }

  var WMO_TEXT = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
    51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain',
    67: 'Freezing rain', 71: 'Snow', 73: 'Snow', 75: 'Snow', 77: 'Snow', 80: 'Showers', 81: 'Showers',
    82: 'Showers', 85: 'Snow', 86: 'Snow', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm' };

  /** Current weather + today's high/low for the configured city; silent if the TV is offline. */
  function fetchWeather() {
    var city = weatherCity();
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
        '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min' +
        '&timezone=auto', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || xhr.status !== 200) return;
        try {
          var d = JSON.parse(xhr.responseText);
          var label = WMO_TEXT[d.current.weather_code] || '';
          $('weatherText').textContent = city.name + ' \u00B7 ' + Math.round(d.current.temperature_2m) +
            '\u00B0 ' + label + ' \u00B7 H ' + Math.round(d.daily.temperature_2m_max[0]) +
            '\u00B0 L ' + Math.round(d.daily.temperature_2m_min[0]) + '\u00B0';
        } catch (e) { /* keep the line empty */ }
      };
      xhr.send();
    } catch (e) { /* no network: no weather line */ }
  }

  function activatePill(i) {
    if (i === 0) showInputs();
    else if (i === 1) launch('com.palm.app.settings', 'Settings', { target: 'network' });
    else launch('com.palm.app.settings', 'Settings');
  }

  // ---- inputs dropdown -----------------------------------------------------------------------

  function showInputs() {
    panel.innerHTML = '';
    inputRows = [];
    var inputs = (window.TV_APPS && TV_APPS.inputs) || [];
    inputs.forEach(function (inp) { addInputRow(ICON_INPUT, inp.label, inp.appId); });
    if (CONFIG.liveTvApp) {
      if (inputRows.length) panel.appendChild(Object.assign(document.createElement('div'), { className: 'separator' }));
      addInputRow(ICON_LIVETV, 'Live TV', CONFIG.liveTvApp);
    }
    if (!inputRows.length) { toast('No inputs found'); return; }

    // Hang above the dock row, left-aligned.
    panel.style.left = '112px';
    panel.style.top = 'auto';
    panel.style.bottom = (1080 - ROW_TOP + 44) + 'px';
    panel.style.minWidth = '380px';
    panel.classList.remove('hidden');
    pills[pillFocus].classList.remove('focused');
    zone = 'inputs';
    focusInput(0);
  }

  function addInputRow(icon, label, appId) {
    var row = document.createElement('div');
    row.className = 'inputRow';
    row.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + icon + '"/></svg>';
    row.appendChild(document.createTextNode(label));
    var idx = inputRows.length;
    row.addEventListener('mouseover', function () { focusInput(idx); });
    row.addEventListener('click', function () { hideInputs(); launch(appId, label); });
    row.appId = appId;
    row.label = label;
    inputRows.push(row);
    panel.appendChild(row);
  }

  function focusInput(i) {
    if (inputRows[inputFocus]) inputRows[inputFocus].classList.remove('focused');
    inputFocus = Math.max(0, Math.min(i, inputRows.length - 1));
    inputRows[inputFocus].classList.add('focused');
  }

  function hideInputs() {
    panel.classList.add('hidden');
    zone = 'none';
    focusTile(focused);
  }

  // ---- rearranging ---------------------------------------------------------------------------

  /** Hold OK on a tile: it wiggles, the arrows move it, OK places it, Back puts everything back. */
  function startEdit() {
    var it = items[focused];
    if (!it) return;
    editing = { item: it, snapshot: items.slice() };
    it.el.classList.add('moving');
    document.body.classList.add('editing');
    toast('Arrows to move  ·  OK to place  ·  Back to cancel');
  }

  function moveTo(to) {
    if (to < 0 || to >= items.length || to === focused) return;
    items.splice(to, 0, items.splice(focused, 1)[0]);
    focused = to;
    layout();
    focusTile(to);
  }

  function finishEdit(keep) {
    var it = editing.item;
    if (!keep) {
      items = editing.snapshot;
      layout();
    }
    editing = null;
    it.el.classList.remove('moving');
    document.body.classList.remove('editing');
    if (keep) saveOrder();
    focused = items.indexOf(it);
    focusTile(focused);
  }

  // ---- keys ----------------------------------------------------------------------------------

  var LONG_PRESS_MS = 600;
  var okDown = false, okTimer = null;

  // On tiles OK acts on release, so a held OK can start rearranging instead of opening the app.
  document.addEventListener('keyup', function (e) {
    if (artSwallowed) { artSwallowed = false; return; }
    if (e.keyCode !== KEY.OK) return;
    okDown = false;
    if (setSwallowOk) { setSwallowOk = false; return; }
    if (!okTimer) return;
    clearTimeout(okTimer);
    okTimer = null;
    var it = items[focused];
    if (zone === 'grid' && it && !editing) {
      if (it.app.id === INPUTS_ID) showInputs();
      else if (isSettingsTile(it.app)) showSettings();
      else launch(it.app.id, it.app.title);
    }
  });

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (artOn) { stopArt(); artSwallowed = true; resetIdle(); e.preventDefault(); return; }
    resetIdle();
    if (k === KEY.OK && okDown) { e.preventDefault(); return; }   // key repeat while held
    if (k === KEY.OK) okDown = true;
    if (editing) {
      if (k === KEY.LEFT) moveTo(focused - 1);
      else if (k === KEY.RIGHT) moveTo(focused + 1);
      else if (k === KEY.OK) finishEdit(true);
      else if (k === KEY.BACK || k === KEY.ESC) finishEdit(false);
      else return;
    } else if (zone === 'inputs') {
      if (k === KEY.UP) focusInput(inputFocus - 1);
      else if (k === KEY.DOWN) focusInput(inputFocus + 1);
      else if (k === KEY.OK) { var row = inputRows[inputFocus]; hideInputs(); launch(row.appId, row.label); }
      else if (k === KEY.BACK || k === KEY.ESC || k === KEY.LEFT || k === KEY.RIGHT) hideInputs();
      else return;
    } else if (zone === 'top') {
      if (k === KEY.LEFT) focusPill(pillFocus - 1);
      else if (k === KEY.RIGHT) focusPill(pillFocus + 1);
      else if (k === KEY.DOWN) focusTile(rowOf(focused) === 0 ? focused : 0);
      else if (k === KEY.OK) activatePill(pillFocus);
      else if (k === KEY.BACK) { /* home screen: Back goes nowhere */ }
      else return;
    } else if (zone === 'settings') {
      if (k === KEY.UP) focusSet(setFocus - 1);
      else if (k === KEY.DOWN) focusSet(setFocus + 1);
      else if (k === KEY.LEFT) changeSetting(-1);
      else if (k === KEY.RIGHT) changeSetting(1);
      else if (k === KEY.OK) {
        var sr = setRows[setFocus];
        if (sr && sr.def.type === 'action') runSetAction();
        else changeSetting(1);
      }
      else if (k === KEY.BACK || k === KEY.ESC) hideSettings();
      else return;
    } else {
      var last = items.length - 1;
      if (k === KEY.LEFT) { if (focused > 0) focusTile(focused - 1); }
      else if (k === KEY.RIGHT) { if (focused < last) focusTile(focused + 1); }
      else if (k === KEY.OK) {
        okTimer = setTimeout(function () { okTimer = null; startEdit(); }, LONG_PRESS_MS);
      } else if (k === KEY.BACK) { /* home screen: Back goes nowhere */ }
      else return;
    }
    e.preventDefault();
  });

  pills.forEach(function (p, i) {
    p.addEventListener('mouseover', function () { if (zone !== 'inputs' && zone !== 'settings') focusPill(i); });
    p.addEventListener('click', function () { activatePill(i); });
  });

  // ---- Art Mode: idle slideshow fed by the art server (see config.js) ------------------------

  var ART_SERVER = (CONFIG.artServer || '').replace(/\/$/, '');
  var ART_IDLE_MS = (CONFIG.artIdleMinutes || 0) * 60000;
  var ART_SLIDE_MS = (CONFIG.artSlideSeconds || 20) * 1000;
  var artEl = document.getElementById('art');
  var artLayers = [document.getElementById('artA'), document.getElementById('artB')];
  var artClockEl = document.getElementById('artClock');
  var artOn = false, artSwallowed = false;
  var artTimer = null, slideTimer = null, artClockTimer = null, artGen = 0;
  var artList = [], artIdx = 0, artLayer = 0;

  function resetIdle() {
    artGen++;
    clearTimeout(artTimer);
    if (ART_SERVER && ART_IDLE_MS > 0 && !artOn) artTimer = setTimeout(startArt, ART_IDLE_MS);
  }

  function artClockTick() {
    var d = new Date(), h = d.getHours();
    artClockEl.textContent = (h % 12 || 12) + ':' + ('0' + d.getMinutes()).slice(-2) + (h >= 12 ? ' PM' : ' AM');
  }

  function artShow(img, name, onShown) {
    img.onload = function () {
      img.classList.add('vis');
      if (onShown) onShown();
    };
    img.onerror = function () { if (onShown) onShown(); };
    img.src = ART_SERVER + '/photos/' + encodeURIComponent(name);
  }

  function startArt() {
    if (artOn || !ART_SERVER) return;
    if (zone === 'settings' || zone === 'inputs') { resetIdle(); return; }   // menus open: stay put
    var gen = artGen;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', ART_SERVER + '/list.json', true);
    xhr.timeout = 6000;
    xhr.onload = function () {
      if (gen !== artGen) return;   // the user pressed something meanwhile
      var names = [];
      try { names = JSON.parse(xhr.responseText).photos || []; } catch (e) {}
      if (!names.length) { resetIdle(); return; }
      for (var i = names.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = names[i];
        names[i] = names[j]; names[j] = t;
      }
      artList = names; artIdx = 0; artLayer = 0;
      artOn = true;
      artClockTick();
      artClockTimer = setInterval(artClockTick, 20000);
      artShow(artLayers[0], artList[0], null);
      artEl.classList.add('on');
      slideTimer = setInterval(nextArt, ART_SLIDE_MS);
    };
    xhr.onerror = function () { resetIdle(); };
    xhr.ontimeout = function () { resetIdle(); };
    xhr.send();
  }

  function nextArt() {
    if (!artList.length) return;
    artIdx = (artIdx + 1) % artList.length;
    var next = artLayers[1 - artLayer];
    var prev = artLayers[artLayer];
    artShow(next, artList[artIdx], function () {
      prev.classList.remove('vis');
      artLayer = 1 - artLayer;
    });
    // Safety: if the photo fails silently, still swap after the fade window.
    setTimeout(function () {
      if (artOn && !next.classList.contains('vis')) {
        next.classList.add('vis');
        prev.classList.remove('vis');
        artLayer = 1 - artLayer;
      }
    }, 2500);
  }

  function stopArt() {
    artOn = false;
    artGen++;
    clearInterval(slideTimer);
    clearInterval(artClockTimer);
    artEl.classList.remove('on');
    setTimeout(function () {
      artLayers.forEach(function (img) { img.classList.remove('vis'); });
    }, 900);
  }

  artEl.addEventListener('click', function () { if (artOn) { stopArt(); resetIdle(); } });

  // ---- lifecycle -----------------------------------------------------------------------------

  /** Back from another app (or opened again from the shortcut): replay the entrance, keep the tile. */
  function resume() {
    if (artOn) stopArt();
    if (editing) finishEdit(false);
    updateClock();
    fetchWeather();
    if (zone === 'inputs') panel.classList.add('hidden');
    if (zone === 'settings') setPanel.classList.add('hidden');
    pills.forEach(function (p) { p.classList.remove('focused'); });
    zone = 'none';
    animateIn();
    focusTile(focused);
  }

  document.addEventListener('webOSRelaunch', resume);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) resume(); });

  build();
  loadLocalSettings();
  applySettings();
  updateClock();
  fetchWeather();
  setInterval(updateClock, 10000);
  setInterval(fetchWeather, 1800000);
  watchNetwork();
  animateIn();
  zone = 'none';
  focusTile(0);
  resetIdle();
  pullServerConfig(function (adopted) {
    if (adopted) { applySettings(); fetchWeather(); }
  });
})();
