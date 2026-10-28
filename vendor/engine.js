(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TerminalFarm = factory();
})(typeof window !== 'undefined' ? window : this, function () {
'use strict';

/* ======================= utils ======================= */
function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
function toHex(c) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function lum(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function h32(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function hash2(x, y, s) { var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 2147483647)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function d2(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; }

var CUBE = [0, 95, 135, 175, 215, 255];
function lab(c) {
  function f(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  var r = f(c[0]), g = f(c[1]), b = f(c[2]);
  var x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  function t(v) { return v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116; }
  return [116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z))];
}
function dl(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y * 1.4 + z * z * 1.4; }
var PAL256 = null;
function pal256() {
  if (PAL256) return PAL256; PAL256 = [];
  for (var i = 16; i < 256; i++) { var rgb = idx2rgb(i); PAL256.push({ i: i, rgb: rgb, lab: lab(rgb), gray: i >= 232 || (rgb[0] === rgb[1] && rgb[1] === rgb[2]) }); }
  return PAL256;
}
function q256(c) {
  var L = lab(c), chroma = Math.sqrt(L[1] * L[1] + L[2] * L[2]), best = 16, bd = 1e12;
  pal256().forEach(function (p) {
    if (p.gray && chroma > 7) return;               // never turn a coloured pixel into a grey
    var d = dl(L, p.lab); if (d < bd) { bd = d; best = p.i; }
  });
  return best;
}
function idx2rgb(i) {
  if (i >= 232) { var v = 8 + 10 * (i - 232); return [v, v, v]; }
  i -= 16; return [CUBE[Math.floor(i / 36)], CUBE[Math.floor(i / 6) % 6], CUBE[i % 6]];
}

/* ======================= palette ======================= */
var PAL = {
  meadow: ['#2F6B3A', '#2C6637'],
  patch: { working: ['#6CC35A', '#62B852'], idle: ['#3F8350', '#3B7C4B'], unknown: ['#59695F', '#55645B'], fallow: ['#6B5236', '#634B31'] },
  soil: { working: '#4A3524', idle: '#33281E', unknown: '#2E2B28', fallow: '#33281E' },
  plank: { working: '#A8713A', idle: '#6E4A2C', unknown: '#5A4A3A', fallow: '#5A4A3A' },
  plankEnd: '#4A3220',
  plankText: '#F6E9C8',
  sel: '#00ADE4', selText: '#04212D', selTint: '#0C5E7C',
  focus: '#FBBF24',
  st: { working: '#4ADE80', idle: '#9AABCB', unknown: '#8A8F9A' },
  note: '#FFE27A', zz: '#C4D2F0', q: '#B7BDC9',
  ui: { bg: '#15181F', fg: '#CED2DA', dim: '#7A828F', key: '#A9B0BC' },
  nightTint: '#0A1030'
};
var SPECIES = ['sheep', 'pig', 'cow', 'hen'];
var SP_PAL = {
  sheep: { W: '#F2F0E6', w: '#CFCABA', H: '#3E3C45', K: '#23222A', A: '#E9A8A0' },
  pig: { B: '#F4A6B7', b: '#D97E95', P: '#F9C2CE', S: '#E8718C', K: '#4A2A36' },
  cow: { W: '#F6F3EE', w: '#D9D4CC', P: '#4B3B36', M: '#F0B4A6', O: '#E6D79A', K: '#23222A' },
  hen: { W: '#FBFBF5', w: '#DAD7C8', R: '#E5483D', Y: '#F5B83A', K: '#23222A' }
};
var MINI_PAL = {
  sheep: { B: '#F2F0E6', H: '#3E3C45', L: '#23222A' },
  pig: { B: '#F4A6B7', H: '#E8718C', L: '#8A4658' },
  cow: { B: '#F6F3EE', H: '#4B3B36', L: '#23222A' },
  hen: { B: '#FBFBF5', H: '#E5483D', L: '#F5B83A' }
};

/* ======================= sprites (6x6 px; row 0 = top; facing right) ======================= */
var SPR = {
  sheep: {
    stand: ['......', '.WWWA.', 'WWWWHH', 'WWWwHH', '.WWw..', '.K.K..'],
    stand2: ['.WWWA.', 'WWWWHH', 'WWWWHH', '.WWw..', '..K.K.', '..K.K.'],
    lie: ['......', '......', '......', '.WWWW.', 'WWWWWH', '.wwwwH'],
    lie2: ['......', '......', '..WW..', '.WWWW.', 'WWWWWH', '.wwwwH']
  },
  pig: {
    stand: ['......', 'b...b.', 'BBBBPP', 'BBBBKS', 'BBBB..', '.b.b..'],
    stand2: ['b...b.', 'BBBBPP', 'BBBBKS', 'BBBB..', '.b..b.', '.b..b.'],
    lie: ['......', '......', '......', 'b...b.', 'BBBBPP', 'bBBBKS'],
    lie2: ['......', '......', 'b.....', 'b...b.', 'BBBBPP', 'bBBBKS']
  },
  cow: {
    stand: ['....O.', 'WPWWWW', 'WWPWKW', 'PWWWMM', 'WWWW..', 'K.KK..'],
    stand2: ['....O.', 'WPWWWW', 'WWPWKW', 'PWWWMM', 'WWWW..', '.KK.K.'],
    lie: ['......', '......', '......', 'PWW.O.', 'WWWWKW', 'wPwwMM'],
    lie2: ['......', '......', '.PW...', 'PWW.O.', 'WWWWKW', 'wPwwMM']
  },
  hen: {
    stand: ['......', '....R.', '...WKY', 'WWWWW.', '.WWWw.', '..Y.Y.'],
    stand2: ['....R.', '...WKY', 'WWWWW.', 'WWWWw.', '.WWw..', '.Y..Y.'],
    lie: ['......', '......', '......', '....R.', 'WWWWKY', '.wwww.'],
    lie2: ['......', '......', '..WW..', '....R.', 'WWWWKY', '.wwww.']
  }
};
var MINI = {
  stand: ['...H', 'BBBH', 'BBB.', 'L.L.'],
  stand2: ['...H', 'BBBH', 'BBB.', '.L.L'],
  lie: ['....', '....', '.BBH', 'BBBB'],
  lie2: ['....', '.BB.', 'BBBH', 'BBBB']
};
// effect rows for 1x (6 cells) per frame
var FX = {
  working: [{ c: 3, ch: '♪' }, { c: 4, ch: '♫' }, { c: 3, ch: '♪' }, { c: 4, ch: '♫' }],
  idle: [{ c: 3, ch: 'z' }, { c: 3, ch: 'z', c2: 4, ch2: 'z' }, { c: 3, ch: 'z', c2: 4, ch2: 'Z' }, { c: 4, ch: 'Z' }],
  unknown: [{ c: 3, ch: '?' }, { c: 3, ch: '?' }]
};
var ANIM = {
  working: { frames: 4, ms: 250 },
  idle: { frames: 4, ms: 750 },
  unknown: { frames: 2, ms: 1250 }
};

var DECOR = {
  tree: { pal: { G: '#2A7A3A', g: '#3B9A4B', T: '#6B4A2B' }, map: ['...GG....', '..GGgG...', '.GGGGGG..', 'GGgGGGGG.', 'GGGGGGgG.', '.GGGGGG..', '...TT....', '...TT....'] },
  bush: { pal: { G: '#2A7A3A', g: '#3B9A4B', r: '#E4574F' }, map: ['.GGG..', 'GGgGGG', 'GrGGrG', 'GGGGGG'] },
  pond: { pal: { B: '#3D8FCB', b: '#8CCBEE', s: '#2E6F9F' }, map: ['...sBBBBBs...', '.sBBBBBBBBBs.', 'sBBBbBBBBBBBs', 'sBBBBBBBbBBBs', '.sBBBBBBBBBs.', '...sBBBBBs...'] },
  hay: { pal: { Y: '#E3C463', y: '#B9993A' }, map: ['..YYY...', '.YYYYY..', 'YYyYYYY.', 'YYYYYyYY', 'YyYYYYYY', 'yyyyyyyy'] }
};

/* ======================= sky ======================= */
var SKY_KEYS = [
  [0, '#070B1E', '#151F45'], [5, '#0C1233', '#2B3566'], [6, '#2B3F7A', '#E08F6B'], [7.25, '#4E86C8', '#F2C398'],
  [8.5, '#5BA8E8', '#BFE3F5'], [12, '#3E95E0', '#A9DAF7'], [16.5, '#4A9BE0', '#CBE6F2'], [18, '#4A5FA8', '#F2A56A'],
  [19, '#2A2F6B', '#C0587A'], [20, '#141B4A', '#4B3A78'], [21.5, '#070B1E', '#151F45'], [24, '#070B1E', '#151F45']
];
function skyAt(h) {
  for (var i = 0; i < SKY_KEYS.length - 1; i++) {
    var a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
    if (h >= a[0] && h <= b[0]) { var t = (h - a[0]) / (b[0] - a[0]); return [mix(hex(a[1]), hex(b[1]), t), mix(hex(a[2]), hex(b[2]), t)]; }
  }
  return [hex(SKY_KEYS[0][1]), hex(SKY_KEYS[0][2])];
}
function nightness(h) { // 0 day .. 1 night, drives world tint
  if (h < 5) return 1; if (h < 7) return 1 - (h - 5) / 2; if (h < 17) return 0; if (h < 21) return (h - 17) / 4; return 1;
}
function starVis(h) {
  if (h < 4.5) return 1; if (h < 6.5) return 1 - (h - 4.5) / 2; if (h < 18.5) return 0; if (h < 20.5) return (h - 18.5) / 2; return 1;
}
var CLOUDS = [
  ['...ww.....', '.wwwwww...', 'wwwwwwwwww'],
  ['....www.......', '..wwwwwww.ww..', '.wwwwwwwwwwwww', 'wwwwwwwwwwwwww'],
  ['..ww.....', '.wwwww...', 'wwwwwwwww']
];
var MOON = [ // 5x5, lit side right: '#' lit, 'o' dim limb
  ['.ooo.', 'ooooo', 'ooooo', 'ooooo', '.ooo.'],   // new
  ['.oo#.', 'ooo##', 'ooo##', 'ooo##', '.oo#.'],   // crescent
  ['.o##.', 'oo###', 'oo###', 'oo###', '.o##.'],   // half
  ['.###.', 'o####', 'o####', 'o####', '.###.'],   // gibbous
  ['.###.', '#####', '#####', '#####', '.###.']    // full
];
var WINDMILL = [ // sails + tower, 7x8 px; two sail frames
  ['x.....x', '.x...x.', '..x.x..', '...T...', '..x.x..', '.x.T.x.', 'x..T..x', '..TTT..'],
  ['...x...', '...x...', '...x...', 'xxxTxxx', '...x...', '...T...', '...T...', '..TTT..']
];

/* ======================= helpers ======================= */
function fmtDur(s, long) {
  if (s == null || !isFinite(s)) return '?'; // terminal-farm: unknown duration
  s = Math.max(0, Math.floor(s));
  if (s < 60) return s + 's';
  var m = Math.floor(s / 60);
  if (m < 60) return long ? m + 'm' + String(s % 60).padStart(2, '0') + 's' : m + 'm';
  var h = Math.floor(m / 60);
  if (h < 24) return long ? h + 'h' + String(m % 60).padStart(2, '0') + 'm' : h + 'h';
  var d = Math.floor(h / 24);
  return long ? d + 'd' + (h % 24) + 'h' : d + 'd';
}
function ellip(name, n) { // middle ellipsis, 60/40 head/tail
  if (name.length <= n) return name;
  if (n <= 1) return '…'.slice(0, n);
  var keep = n - 1, head = Math.ceil(keep * 0.6), tail = keep - head;
  return name.slice(0, head) + '…' + (tail > 0 ? name.slice(name.length - tail) : '');
}
function speciesOf(id) { return SPECIES[h32(String(id)) % 4]; }

/* ======================= layout ======================= */
var TIERS = {
  big: { id: 'big', scale: 2, ph: 11, wFor: function (n) { return n >= 3 ? 40 : n === 2 ? 28 : 19; } },
  norm: { id: 'norm', scale: 1, ph: 6, wFor: function () { return 19; } },
  mini: { id: 'mini', scale: 0, ph: 4, wFor: function () { return 14; } }
};
function pack(tier, wsList, W, rowGap) {
  var rows = [[]], x = 0, gut = 1;
  var maxW = W;
  wsList.forEach(function (ws) {
    var w = tier.wFor(ws.panes.length);
    if (x > 0 && x + w > maxW) { rows.push([]); x = 0; }
    rows[rows.length - 1].push({ ws: ws, w: w, x: x });
    x += w + gut;
  });
  var maxUsed = 0;
  rows.forEach(function (r) { var last = r[r.length - 1]; var used = last ? last.x + last.w : 0; if (used > maxUsed) maxUsed = used; });
  var off = Math.floor((W - maxUsed) / 2);
  rows.forEach(function (r) { r.forEach(function (p) { p.x += off; }); });
  return rows;
}
function layout(S) {
  var W = S.W, H = S.H, N = S.workspaces.length;
  var minSky = H >= 30 ? 8 : 3;
  var farmMax = H - 1 - minSky;
  var order = S.tier ? [S.tier] : ['big', 'norm', 'mini'];
  var chosen = null, rows = null;
  for (var i = 0; i < order.length; i++) {
    var t = TIERS[order[i]]; var r = pack(t, S.workspaces, W);
    if (r.length * t.ph <= farmMax || i === order.length - 1) { chosen = t; rows = r; if (r.length * t.ph <= farmMax) break; }
  }
  var t = chosen, visRows = Math.floor(farmMax / t.ph), scroll = 0, overflow = rows.length > visRows;
  if (overflow) {
    var selRow = 0;
    rows.forEach(function (r, ri) { r.forEach(function (p) { if (p.ws.panes.some(function (a) { return a.id === S.selected; })) selRow = ri; }); });
    scroll = clamp(selRow - Math.floor(visRows / 2), 0, rows.length - visRows);
  } else visRows = rows.length;
  var farmH = visRows * t.ph;
  // sky takes what is left, capped at 14 rows; extra becomes meadow above plots
  var skyMax = H >= 50 ? 16 : 14;
  var spare = H - 1 - farmH;
  var sky = Math.min(spare, skyMax);
  var meadowTop = spare - sky;
  var y0 = sky + Math.floor(meadowTop * 0.5);
  var plots = [];
  for (var ri = scroll; ri < scroll + visRows; ri++) {
    rows[ri].forEach(function (p) {
      plots.push({ ws: p.ws, x: p.x, y: y0 + (ri - scroll) * t.ph, w: p.w, h: t.ph, row: ri });
    });
  }
  return { tier: t, plots: plots, sky: sky, y0: y0, rows: rows, visRows: visRows, scroll: scroll, overflow: overflow, farmBottom: y0 + farmH };
}
function agentX(tier, w, n, i) {
  var sw = tier.scale === 2 ? 12 : tier.scale === 1 ? 6 : 4;
  var total = n * sw, gap = 0;
  if (tier.scale === 1) { if (n === 1) return Math.floor((w - 6) / 2); if (n === 2) return [3, 10][i]; return i * 6; }
  if (tier.scale === 2) { if (n === 1) return Math.floor((w - 12) / 2); if (n === 2) return [2, 14][i]; return 2 + i * 12; }
  if (n === 1) return Math.floor((w - 4) / 2); if (n === 2) return [2, 7][i]; return i * 5;
}

/* ======================= sprite frames ======================= */
// scale: 0 = mini (4x4 px), 1 = normal (6x6 px), 2 = big (12x12 px, nearest-neighbour x2)
function poseOf(status, fr) { return status === 'working' ? (fr % 2 === 0 ? 'stand' : 'stand2') : status === 'idle' ? (fr % 2 === 0 ? 'lie' : 'lie2') : 'stand'; }
function spriteFrame(status, species, scale, fr) {
  var pose = poseOf(status, fr), map = scale === 0 ? MINI[pose] : SPR[species][pose], pal = scale === 0 ? MINI_PAL[species] : SP_PAL[species];
  var sc = scale === 2 ? 2 : 1, out = [];
  for (var my = 0; my < map.length; my++) for (var mx = 0; mx < map[0].length; mx++) {
    var ch = map[my][mx]; if (ch === '.') continue;
    var col = hex(pal[ch]);
    if (status === 'idle') col = mix(col, hex('#4A5C8F'), 0.16);
    if (status === 'unknown') { if ((mx + my) % 2 === 0) continue; var g = lum(col); col = mix([g, g, g], hex('#8A93A3'), 0.5); }
    for (var ky = 0; ky < sc; ky++) for (var kx = 0; kx < sc; kx++) out.push({ x: mx * sc + kx, y: my * sc + ky, c: col });
  }
  return { w: map[0].length * sc, h: map.length * sc, px: out };
}
function fxColor(status, fr) {
  var c = status === 'working' ? hex(PAL.note) : status === 'idle' ? hex(PAL.zz) : hex(PAL.q);
  if (status === 'unknown' && fr % 2 === 1) c = mix(c, hex('#5A616E'), 0.6);
  return c;
}

/* ======================= renderer ======================= */
function render(S) {
  var W = S.W, H = S.H, hour = S.hour, tick = S.tick || 0;
  var px = [], tx = [];
  for (var y = 0; y < H * 2; y++) px.push(new Array(W).fill(null));
  for (var y2 = 0; y2 < H; y2++) tx.push(new Array(W).fill(null));
  var night = nightness(hour);
  var tint = hex(PAL.nightTint);
  function A(c, lit) { // ambient: world colours darken at night; lit things keep more
    if (night <= 0) return c;
    var t = night * (lit ? 0.22 : 0.58);
    var m = mix(c, tint, t);
    return [m[0] * (1 - 0.22 * night * (lit ? 0.3 : 1)), m[1] * (1 - 0.18 * night * (lit ? 0.3 : 1)), m[2] * (1 - 0.05 * night)];
  }
  function setpx(x, y, c) { if (x >= 0 && x < W && y >= 0 && y < H * 2) px[y][x] = c; }
  function put(x, y, ch, fg, bg) { if (x >= 0 && x < W && y >= 0 && y < H) tx[y][x] = { ch: ch, fg: fg, bg: bg }; }
  function text(x, y, s, fg, bg) { for (var i = 0; i < s.length; i++) put(x + i, y, s[i], fg, bg); }

  var L = layout(S);
  var skyRows = L.sky, skyPx = skyRows * 2;
  var sk = skyAt(hour);
  var meadowC = [hex(PAL.meadow[0]), hex(PAL.meadow[1])];

  // --- sky gradient
  var hillPx = H >= 30 ? 4 : 2;
  for (var yy = 0; yy < skyPx; yy++) {
    var t = skyPx > 1 ? yy / (skyPx - 1) : 0;
    var c = mix(sk[0], sk[1], t);
    for (var xx = 0; xx < W; xx++) px[yy][xx] = c;
  }
  var skyTopAt = function (yy) { return mix(sk[0], sk[1], skyPx > 1 ? yy / (skyPx - 1) : 0); };
  var hillTop = skyPx - hillPx;
  // --- stars
  var sv = starVis(hour);
  if (sv > 0) {
    var nStars = Math.round(W * Math.max(0, hillTop) / 90);
    for (var i = 0; i < nStars; i++) {
      var r1 = hash2(i, 7, 1), r2 = hash2(i, 9, 2), r3 = hash2(i, 11, 3);
      if (i / nStars > sv) continue;
      var sx = Math.floor(r1 * W), sy = Math.floor(r2 * Math.max(1, Math.floor(hillTop / 2)));
      var tw = ((Math.floor(tick / 1500) + i) % 7 === 0);
      var ch = r3 < 0.55 ? '·' : r3 < 0.8 ? (tw ? '·' : '.') : r3 < 0.93 ? (tw ? '+' : '·') : (tw ? '*' : '+');
      var bgc = skyTopAt(sy * 2);
      put(sx, sy, ch, mix(bgc, [235, 238, 255], 0.55 + 0.4 * r3), bgc);
    }
  }
  // --- sun & moon
  function disk(cx, cy, r, col, glow) {
    for (var dy = -r - 1; dy <= r + 1; dy++) for (var dx = -r - 1; dx <= r + 1; dx++) {
      var d = Math.sqrt(dx * dx + dy * dy);
      var X = Math.round(cx + dx), Y = Math.round(cy + dy);
      if (X < 0 || X >= W || Y < 0 || Y >= hillTop + 1) continue;
      if (d <= r + 0.15) setpx(X, Y, col);
      else if (glow && d <= r + 1.2) setpx(X, Y, mix(px[Y][X] || col, col, 0.28));
    }
  }
  if (hour >= 5.5 && hour <= 18.5) {
    var p = (hour - 5.5) / 13, el = Math.sin(Math.PI * p);
    var cx = 5 + p * (W - 10), cy = (hillTop + 1) - (hillTop - 4) * el;
    var col = mix(hex('#FF8F3A'), hex('#FFE066'), smooth(0.05, 0.4, el));
    disk(cx, cy, 2, col, true);
  }
  if (hour >= 17.5 || hour <= 6.5) {
    var q = ((hour - 17.5 + 24) % 24) / 13, el2 = Math.sin(Math.PI * clamp(q, 0, 1));
    var mx = 5 + q * (W - 10), my = (hillTop + 1) - (hillTop - 4) * el2;
    var phase = S.moonPhase != null ? S.moonPhase : 0.37;
    var mi = Math.round(phase * 8) % 8, mk = MOON[mi < 5 ? mi : 8 - mi], flip = mi > 4;
    for (var dy = 0; dy < 5; dy++) for (var dx = 0; dx < 5; dx++) {
      var cm = mk[dy][flip ? 4 - dx : dx]; if (cm === '.') continue;
      var X = Math.round(mx) - 2 + dx, Y = Math.round(my) - 2 + dy;
      if (X < 0 || X >= W || Y < 0 || Y > hillTop) continue;
      setpx(X, Y, cm === '#' ? hex('#E9EDFF') : mix(skyTopAt(Y), hex('#E9EDFF'), 0.14));
    }
  }
  // --- clouds
  var nCl = clamp(Math.round(W * skyRows / 170), 2, 9);
  for (var ci = 0; ci < nCl; ci++) {
    var shp = CLOUDS[ci % 3], cw = shp[0].length;
    var speed = 2600 + (h32('c' + ci) % 3400);
    var x0 = Math.floor(hash2(ci, 3, 5) * (W + 28));
    var cx0 = (x0 + Math.floor(tick / speed)) % (W + 28) - 14;
    var cy0 = 1 + Math.floor(hash2(ci, 4, 6) * Math.max(1, hillTop - shp.length - 4));
    var cc = mix(hex('#FFFFFF'), skyTopAt(cy0), 0.12);
    var tintC = mix(cc, hex('#8B6FA8'), smooth(17, 19.5, hour) * 0.35 * (hour < 21 ? 1 : 0));
    var base = night > 0.5 ? mix(skyTopAt(cy0), hex('#3A4580'), 0.55) : tintC;
    base = mix(base, skyTopAt(cy0), night * 0.25);
    shp.forEach(function (row, ry) {
      for (var rx = 0; rx < row.length; rx++) if (row[rx] === 'w') {
        var sh = ry === shp.length - 1 ? 0.12 : 0;
        setpx(cx0 + rx, cy0 + ry, mix(base, skyTopAt(cy0 + ry), sh + 0.0));
      }
    });
  }
  // --- hills
  var hillFar = mix(meadowC[0], sk[1], 0.45), hillNear = meadowC[0];
  for (var xx = 0; xx < W; xx++) {
    var hf = 2.0 + 1.1 * Math.sin(xx * 0.07 + 1) + 0.7 * Math.sin(xx * 0.19) + (hillPx > 2 ? 0.8 : 0);
    var hn = 0.9 + 0.8 * Math.sin(xx * 0.11 + 2.2) + (hillPx > 2 ? 0.6 : 0);
    for (var k = 0; k < hillPx; k++) {
      var yy2 = hillTop + k, up = hillPx - 1 - k;
      if (up < hn) setpx(xx, yy2, A(hillNear, false));
      else if (up < hf) setpx(xx, yy2, A(hillFar, false));
    }
  }
  // --- windmill (turns slowly; faster while anything is working)
  var anyWorking = S.workspaces.some(function (w) { return w.panes.some(function (a) { return a.status === 'working'; }); });
  if (H >= 30) {
    var wx = Math.floor(W * 0.8), wf = Math.floor(tick / (anyWorking ? 625 : 1500)) % 2; // terminal-farm: always turns, faster while working
    var wm = WINDMILL[wf], wy0 = hillTop - 5;
    wm.forEach(function (row, ry) {
      for (var rx = 0; rx < 7; rx++) {
        var ch = row[rx]; if (ch === '.') continue;
        setpx(wx + rx, wy0 + ry, A(ch === 'T' ? hex('#6B5B4B') : hex('#D9CFC0'), false));
      }
    });
  }
  // --- meadow
  var meadowTop = skyRows;
  for (var yy3 = meadowTop * 2; yy3 < (H - 1) * 2; yy3++) for (var xx2 = 0; xx2 < W; xx2++) {
    var alt = !S.flat && hash2(xx2, yy3, 21) < 0.33;
    var mcol = meadowC[alt ? 1 : 0];
    px[yy3][xx2] = A(mcol, false);
    if (hash2(xx2, yy3, 33) > 0.992 && (yy3 < L.y0 * 2 || yy3 >= L.farmBottom * 2)) {
      var fl = [hex('#F7F3E3'), hex('#F6D44B'), hex('#F29BB5')][Math.floor(hash2(xx2, yy3, 44) * 3)];
      px[yy3][xx2] = A(mix(mcol, fl, 0.8), false);
    }
  }

  // --- plots
  var T = L.tier, sel = S.selected, focus = S.focus;
  var selPlot = null;
  var nameCount = {};
  var dispName = {};
  S.workspaces.forEach(function (ws) { nameCount[ws.name] = (nameCount[ws.name] || 0) + 1; dispName[ws.id] = nameCount[ws.name] > 1 ? { name: ws.name, dup: nameCount[ws.name] } : { name: ws.name, dup: 0 }; });
  var agentsPos = [];
  L.plots.forEach(function (pl) {
    var ws = pl.ws, n = ws.panes.length;
    var agg = 'fallow';
    if (n) { agg = 'idle'; if (ws.panes.some(function (a) { return a.status === 'unknown'; })) agg = 'unknown'; if (ws.panes.some(function (a) { return a.status === 'working'; })) agg = 'working'; }
    var lit = agg === 'working';
    var g0 = hex(PAL.patch[agg][0]), g1 = hex(PAL.patch[agg][1]);
    var isSelPlot = ws.panes.some(function (a) { return a.id === sel; });
    var ph = T.ph;
    // patch pixels (rows after sign)
    for (var cy = pl.y + 1; cy < pl.y + ph; cy++) for (var cx = pl.x; cx < pl.x + pl.w; cx++) {
      for (var sub = 0; sub < 2; sub++) {
        var Y = cy * 2 + sub; var alt = !S.flat && hash2(cx, Y, 5) < 0.34;
        px[Y][cx] = A(alt ? g1 : g0, lit);
      }
    }
    // sign
    var signBg = isSelPlot ? hex(PAL.sel) : hex(PAL.plank[agg]);
    var signFg = isSelPlot ? hex(PAL.selText) : hex(PAL.plankText);
    var nm = dispName[ws.id];
    var avail = pl.w - 2;
    var label = nm.dup ? ellip(nm.name, avail - 3) + ' #' + nm.dup : ellip(nm.name, avail);
    for (var cx2 = 0; cx2 < pl.w; cx2++) put(pl.x + cx2, pl.y, ' ', signFg, (cx2 === 0 || cx2 === pl.w - 1) && !isSelPlot ? A(hex(PAL.plankEnd), lit) : A(signBg, true));
    var lx = pl.x + 1 + Math.floor((avail - label.length) / 2 * 0);
    text(lx, pl.y, label, isSelPlot ? signFg : A(signFg, true), A(signBg, true));
    if (!n) { // fallow: furrows
      for (var cy3 = pl.y + 2; cy3 < pl.y + ph - 1; cy3 += 1) for (var cx3 = pl.x + 1; cx3 < pl.x + pl.w - 1; cx3++) put(pl.x + cx3 - pl.x, cy3, '─', A(hex('#4F3B26'), false), null && 0);
      return;
    }
    // soil strip (bottom row(s))
    var infoRows = T.scale === 2 ? 2 : T.scale === 1 ? 1 : 0;
    var soilCol = A(hex(PAL.soil[agg]), lit);
    for (var ir = 0; ir < infoRows; ir++) for (var cx4 = 0; cx4 < pl.w; cx4++) put(pl.x + cx4, pl.y + ph - 1 - ir, ' ', null, soilCol);
    ws.panes.forEach(function (a, i) {
      var sx = pl.x + agentX(T, pl.w, n, i);
      var sw = T.scale === 2 ? 12 : T.scale === 1 ? 6 : 4;
      var spcs = a.species || speciesOf(a.id);
      var ph0 = h32(a.id);
      var an = ANIM[a.status], fr = (Math.floor(tick / an.ms) + ph0) % an.frames;
      var fxTop = pl.y + 1;                         // first effects row
      var fxRows = T.scale === 2 ? 2 : 1;
      var bodyY = fxTop + fxRows;                   // first body cell row
      var bodyRows = T.scale === 2 ? 6 : T.scale === 1 ? 3 : 2;
      var isSel = a.id === sel;
      agentsPos.push({ id: a.id, cx: sx + sw / 2, cy: bodyY + bodyRows / 2, ws: ws.id });
      // spotlight
      if (isSel) {
        for (var cyy = fxTop; cyy < bodyY + bodyRows; cyy++) for (var cxx = sx; cxx < sx + sw; cxx++) {
          for (var sb = 0; sb < 2; sb++) px[cyy * 2 + sb][cxx] = A(hex(PAL.selTint), true);
        }
      }
      // sprite
      var SF = spriteFrame(a.status, spcs, T.scale, fr);
      var bodyPx = bodyY * 2;
      SF.px.forEach(function (p) { setpx(sx + p.x, bodyPx + p.y, A(p.c, lit)); });
      // effect glyphs
      var fx = (FX[a.status] || FX.unknown)[fr % FX[a.status].length];
      var fxCol = a.status === 'working' ? hex(PAL.note) : a.status === 'idle' ? hex(PAL.zz) : hex(PAL.q);
      if (a.status === 'unknown' && fr === 1) fxCol = mix(fxCol, hex('#5A616E'), 0.6);
      var fxBgAt = function (cxx, cyy) { return px[cyy * 2][cxx]; };
      var fxRowY = fxTop + fxRows - 1;
      function fxPlace(c, ch, rowY, colr) {
        var ccx = sx + (T.scale === 2 ? c * 2 + 1 : T.scale === 0 ? Math.min(c, 3) - (c > 2 ? 1 : 0) : c);
        if (T.scale === 0) ccx = sx + (c === 3 ? 2 : 3);
        put(ccx, rowY, ch, colr, fxBgAt(ccx, rowY));
      }
      fxPlace(fx.c, fx.ch, fxRowY, fxCol);
      if (fx.c2 != null) fxPlace(fx.c2, fx.ch2, fxRowY, fxCol);
      if (T.scale === 2) { // rising trail one row higher, dimmer
        var pf = (FX[a.status])[(fr + FX[a.status].length - 1) % FX[a.status].length];
        fxPlace(pf.c + 1, pf.ch, fxRowY - 1, mix(fxCol, fxBgAt(sx, fxRowY - 1), 0.6));
      }
      // selection corners
      if (isSel) {
        var selc = hex(PAL.sel);
        put(sx, fxTop, '┌', selc, fxBgAt(sx, fxTop)); put(sx + sw - 1, fxTop, '┐', selc, fxBgAt(sx + sw - 1, fxTop));
      }
      // focus marker
      if (focus === a.id) { var fcx = sx + (isSel ? 1 : 0); put(fcx, fxTop, '◆', hex(PAL.focus), fxBgAt(fcx, fxTop)); }
      // info row(s)
      var gl = a.status === 'working' ? '●' : a.status === 'idle' ? '○' : '◌';
      var stc = hex(PAL.st[a.status]);
      if (T.scale === 1) {
        var d = fmtDur(a.secs, false);
        var s = gl + ' ' + d; s = s + ' '.repeat(Math.max(0, 6 - s.length)); s = s.slice(0, 6);
        var rowI = pl.y + ph - 1;
        for (var k2 = 0; k2 < 6; k2++) put(sx + k2, rowI, s[k2], isSel ? hex(PAL.selText) : A(stc, lit), isSel ? hex(PAL.sel) : soilCol);
      } else if (T.scale === 2) {
        var rowA = pl.y + ph - 2, rowB = pl.y + ph - 1;
        var sA = gl + ' ' + fmtDur(a.secs, true); sA = ellip(sA, 11);
        var sB = ellip(a.folder || '', 11);
        for (var k3 = 0; k3 < 12; k3++) {
          put(sx + k3, rowA, sA[k3] && k3 < 11 ? sA[k3] : ' ', isSel ? hex(PAL.selText) : A(stc, lit), isSel ? hex(PAL.sel) : soilCol);
          put(sx + k3, rowB, sB[k3] && k3 < 11 ? sB[k3] : ' ', isSel ? hex(PAL.selText) : A(hex('#B9A68D'), lit), isSel ? hex(PAL.sel) : soilCol);
        }
      } else if (isSel) { // mini: cyan underline bar under the animal
        var rowM = bodyY + bodyRows - 1;
      }
    });
  });

  // --- decor: fills empty slots at the end of the last visible row, and the meadow band above the plots
  function drawDecor(kind, x, baseY) { // baseY = pixel row of the bottom edge (exclusive)
    var d = DECOR[kind], hgt = d.map.length;
    for (var ry = 0; ry < hgt; ry++) for (var rx = 0; rx < d.map[ry].length; rx++) {
      var chd = d.map[ry][rx]; if (chd === '.') continue;
      setpx(x + rx, baseY - hgt + ry, A(hex(d.pal[chd]), false));
    }
  }
  var lastRow = L.rows[L.scroll + L.visRows - 1] || [];
  var lastPl = L.plots.filter(function (p) { return p.row === L.scroll + L.visRows - 1; });
  var endX = 0; lastPl.forEach(function (p) { endX = Math.max(endX, p.x + p.w + 1); });
  var gridLeft = L.plots.length ? Math.min.apply(null, L.plots.map(function (p) { return p.x; })) : 0;
  var gridRight = L.plots.length ? Math.max.apply(null, L.plots.map(function (p) { return p.x + p.w; })) : W;
  var kinds = ['tree', 'pond', 'hay', 'tree', 'bush', 'tree'];
  var lastY = L.y0 + (L.visRows - 1) * T.ph;
  if (L.plots.length && !L.overflow) {
    for (var sx0 = endX, si0 = 0; sx0 + 14 <= gridRight; sx0 += 20, si0++) {
      var kd = kinds[(h32('s' + si0 + ':' + L.plots.length)) % kinds.length];
      var dw = DECOR[kd].map[0].length;
      drawDecor(kd, sx0 + Math.floor((19 - dw) / 2), (lastY + T.ph) * 2 - 2);
    }
    // meadow bands above and below the plots (only when the tier leaves room)
    var band = function (rowStart, rows, seed) {
      if (rows < 4) return;
      for (var bx0 = 3, bi = 0; bx0 < W - 12; bx0 += 17 + Math.floor(hash2(bi, 2, seed) * 14), bi++) {
        var kd2 = ['tree', 'bush', 'tree', 'pond', 'hay'][Math.floor(hash2(bi, 5, seed) * 5)];
        var hgt = DECOR[kd2].map.length;
        var yb = rowStart * 2 + 1 + Math.floor(hash2(bi, 6, seed) * Math.max(1, rows * 2 - 2 - hgt)) + hgt;
        drawDecor(kd2, bx0, Math.min((rowStart + rows) * 2 - 1, yb));
      }
    };
    band(L.sky, L.y0 - L.sky, 9);
    band(L.farmBottom, H - 1 - L.farmBottom, 17);
  }

  // --- status bar
  var counts = { working: 0, idle: 0, unknown: 0 }, hiddenW = 0;
  var visible = {};
  L.plots.forEach(function (pl) { pl.ws.panes.forEach(function (a) { visible[a.id] = 1; }); });
  S.workspaces.forEach(function (ws) { ws.panes.forEach(function (a) { counts[a.status]++; if (a.status === 'working' && !visible[a.id]) hiddenW++; }); });
  var barBg = hex(PAL.ui.bg), fgc = hex(PAL.ui.fg), dim = hex(PAL.ui.dim);
  for (var bx = 0; bx < W; bx++) put(bx, H - 1, ' ', fgc, barBg);
  function leftSegs(words) {
    var s = [{ s: '● ' + counts.working + (words ? ' working' : ''), c: hex(PAL.st.working) }, { s: ' · ', c: dim }, { s: '○ ' + counts.idle + (words ? ' idle' : ''), c: hex(PAL.st.idle) }];
    if (counts.unknown) s.push({ s: ' · ', c: dim }, { s: '◌ ' + counts.unknown + (words ? ' unknown' : ''), c: hex(PAL.st.unknown) });
    if (L.overflow) s.push({ s: ' · ', c: dim }, { s: 'rows ' + (L.scroll + 1) + '–' + (L.scroll + L.visRows) + '/' + L.rows.length, c: hex(PAL.ui.key) });
    if (hiddenW) s.push({ s: ' · ', c: dim }, { s: '▲▼ ' + hiddenW + (words ? ' working off-screen' : ' off'), c: hex(PAL.focus) });
    return s;
  }
  function slen(a) { return a.reduce(function (n, r) { return n + r.s.length; }, 0); }
  var hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  var clock = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  var KEYS = ['hjkl/←↑↓→ move   ⏎ jump   q quit', '←↑↓→ move  ⏎ jump  q quit', '⏎ jump  q quit', ''];
  var pick = null;
  [[true, 0], [true, 1], [false, 1], [false, 2], [false, 3]].some(function (o) {
    var l = leftSegs(o[0]), r = KEYS[o[1]] ? KEYS[o[1]].length + 3 + 5 : 5;
    if (slen(l) + r + 3 <= W - 1) { pick = { l: l, k: o[1] }; return true; } return false;
  });
  if (!pick) pick = { l: leftSegs(false), k: 3 };
  var cx5 = 1;
  pick.l.forEach(function (r) { text(cx5, H - 1, r.s, r.c, barBg); cx5 += r.s.length; });
  var right = (KEYS[pick.k] ? [{ s: KEYS[pick.k], c: hex(PAL.ui.key) }, { s: '   ', c: dim }] : []).concat([{ s: clock, c: fgc }]);
  var rx = W - 1 - slen(right);
  var selInfo = null;
  S.workspaces.forEach(function (ws) { ws.panes.forEach(function (a) { if (a.id === sel) selInfo = { ws: ws, a: a }; }); });
  if (selInfo) {
    var si = '▸ ' + selInfo.ws.name + ' › ' + (selInfo.a.folder || '') + '  ' + selInfo.a.status + ' ' + fmtDur(selInfo.a.secs, true);
    var room = rx - cx5 - 6;
    if (room > 20) { si = ellip(si, room); text(cx5 + 3, H - 1, si, hex(PAL.sel), barBg); }
  }
  var rcx = rx; right.forEach(function (r) { text(rcx, H - 1, r.s, r.c, barBg); rcx += r.s.length; });

  // --- encode
  var cells = [];
  for (var cy4 = 0; cy4 < H; cy4++) {
    var row = [];
    for (var cx6 = 0; cx6 < W; cx6++) {
      var t0 = tx[cy4][cx6];
      if (t0) { var bgc2 = t0.bg || px[cy4 * 2][cx6] || [0, 0, 0]; row.push({ ch: t0.ch, fg: t0.fg, bg: bgc2 }); continue; }
      var top = px[cy4 * 2][cx6] || [0, 0, 0], bot = px[cy4 * 2 + 1][cx6] || [0, 0, 0];
      if (toHex(top) === toHex(bot)) row.push({ ch: ' ', fg: null, bg: top }); else row.push({ ch: '▀', fg: top, bg: bot });
    }
    cells.push(row);
  }
  var out = cells;
  if (S.crop === 'farm') out = cells.slice(L.y0, L.farmBottom);
  else if (S.crop === 'sky') out = cells.slice(0, Math.max(1, S.cropRows || L.y0));
  else if (Array.isArray(S.crop)) out = cells.slice(S.crop[0], S.crop[1]);
  return { cells: out, layout: L, agents: agentsPos, W: W, H: H };
}


/* ======================= sprite atlas (for the spec) ======================= */
function renderSheet(o) {
  o = o || {};
  var scale = o.scale == null ? 1 : o.scale, frames = [['working', 0, 'W0'], ['working', 1, 'W1'], ['working', 2, 'W2'], ['working', 3, 'W3'], ['idle', 0, 'I0'], ['idle', 1, 'I1'], ['idle', 2, 'I2'], ['idle', 3, 'I3'], ['unknown', 0, 'U0'], ['unknown', 1, 'U1']];
  if (o.frames) frames = frames.filter(function (f) { return o.frames.indexOf(f[2]) >= 0; });
  var sw = scale === 2 ? 12 : scale === 1 ? 6 : 4, gap = 2, labelW = 9;
  var species = o.species || SPECIES, fxRows = scale === 2 ? 2 : 1, bodyRows = scale === 2 ? 6 : scale === 1 ? 3 : 2;
  var blockH = fxRows + bodyRows + 1;
  var W = labelW + frames.length * (sw + gap), H = species.length * (blockH + 1) + 1;
  var px = [], tx = [];
  for (var y = 0; y < H * 2; y++) px.push(new Array(W).fill(hex('#15181F')));
  for (var y2 = 0; y2 < H; y2++) tx.push(new Array(W).fill(null));
  function put(x, y, ch, fg, bg) { if (x >= 0 && x < W && y >= 0 && y < H) tx[y][x] = { ch: ch, fg: fg, bg: bg }; }
  species.forEach(function (sp, si) {
    var y0 = 1 + si * (blockH + 1);
    var nm = sp;
    for (var i = 0; i < nm.length && i < labelW - 1; i++) put(i, y0 + fxRows + 1, nm[i], hex('#A9B0BC'), hex('#15181F'));
    frames.forEach(function (f, fi) {
      var x0 = labelW + fi * (sw + gap), st = f[0], fr = f[1];
      var agg = st === 'working' ? 'working' : st === 'idle' ? 'idle' : 'unknown';
      var g0 = hex(PAL.patch[agg][0]);
      for (var cy = y0; cy < y0 + fxRows + bodyRows; cy++) for (var cx = x0; cx < x0 + sw; cx++) { px[cy * 2][cx] = g0; px[cy * 2 + 1][cx] = g0; }
      var SF = spriteFrame(st, sp, scale, fr);
      SF.px.forEach(function (p) { px[(y0 + fxRows) * 2 + p.y][x0 + p.x] = p.c; });
      var fx = FX[st][fr % FX[st].length], col = fxColor(st, fr);
      function place(c, ch, row) { var ccx = x0 + (scale === 2 ? c * 2 + 1 : scale === 0 ? (c === 3 ? 2 : 3) : c); put(ccx, row, ch, col, g0); }
      place(fx.c, fx.ch, y0 + fxRows - 1); if (fx.c2 != null) place(fx.c2, fx.ch2, y0 + fxRows - 1);
      var lab = f[2]; for (var li = 0; li < lab.length; li++) put(x0 + li, y0 + fxRows + bodyRows, lab[li], hex('#7A828F'), hex('#15181F'));
    });
  });
  var cells = [];
  for (var cy2 = 0; cy2 < H; cy2++) {
    var row = [];
    for (var cx2 = 0; cx2 < W; cx2++) {
      var t0 = tx[cy2][cx2];
      if (t0) { row.push({ ch: t0.ch, fg: t0.fg, bg: t0.bg || px[cy2 * 2][cx2] }); continue; }
      var top = px[cy2 * 2][cx2], bot = px[cy2 * 2 + 1][cx2];
      if (toHex(top) === toHex(bot)) row.push({ ch: ' ', fg: null, bg: top }); else row.push({ ch: '▀', fg: top, bg: bot });
    }
    cells.push(row);
  }
  return { cells: cells, W: W, H: H };
}

/* ======================= encoders ======================= */
function sameC(a, b) { if (!a || !b) return a === b; return Math.round(a[0]) === Math.round(b[0]) && Math.round(a[1]) === Math.round(b[1]) && Math.round(a[2]) === Math.round(b[2]); }
function toRuns(cells, mode) { // -> rows of runs {t, f, b} with colours as '#rrggbb'
  var q = mode === '256';
  function C(c) { if (!c) return null; if (q) return toHex(idx2rgb(q256(c))); return toHex(c); }
  return cells.map(function (row) {
    var runs = [], cur = null;
    row.forEach(function (c) {
      var f = c.ch === ' ' ? null : C(c.fg), b = C(c.bg);
      if (cur && cur.f === f && cur.b === b) cur.t += c.ch; else { cur = { t: c.ch, f: f, b: b }; runs.push(cur); }
    });
    return runs;
  });
}
function toAnsi(cells, mode) {
  var out = [];
  cells.forEach(function (row) {
    var s = '', pf = '', pb = '';
    row.forEach(function (c) {
      var f = c.ch === ' ' || !c.fg ? '' : mode === '256' ? '38;5;' + q256(c.fg) : '38;2;' + c.fg.map(Math.round).join(';');
      var b = !c.bg ? '' : mode === '256' ? '48;5;' + q256(c.bg) : '48;2;' + c.bg.map(Math.round).join(';');
      var codes = [];
      if (f && f !== pf) codes.push(f); if (b && b !== pb) codes.push(b);
      if (codes.length) s += '\x1b[' + codes.join(';') + 'm';
      if (f) pf = f; if (b) pb = b; s += c.ch;
    });
    out.push(s + '\x1b[0m');
  });
  return out.join('\n');
}
function toText(cells) { return cells.map(function (r) { return r.map(function (c) { return c.ch; }).join('').replace(/\s+$/, ''); }).join('\n'); }

/* ======================= navigation ======================= */
function move(agents, cur, dir) {
  var c = agents.filter(function (a) { return a.id === cur; })[0]; if (!c) return agents[0] ? agents[0].id : null;
  var best = null, bs = 1e9;
  agents.forEach(function (a) {
    if (a.id === cur) return;
    var dx = a.cx - c.cx, dy = (a.cy - c.cy) * 2;
    var main, perp;
    if (dir === 'right') { main = dx; perp = Math.abs(dy); } else if (dir === 'left') { main = -dx; perp = Math.abs(dy); }
    else if (dir === 'down') { main = dy; perp = Math.abs(dx); } else { main = -dy; perp = Math.abs(dx); }
    if (main <= 0.5) return;
    var s = main + 2.5 * perp;
    if (s < bs) { bs = s; best = a; }
  });
  return best ? best.id : cur;
}

/* ======================= sample data + scenes (for mockups) ======================= */
var NAMES = ['auth-refactor', 'metrics-dash', 'release-notes', 'flaky-tests', 'search-index', 'api-gateway', 'api-gateway', 'dark-mode', 'db-migrations', 'rate-limiter', 'ci-pipeline', 'docs-site', 'image-resize', 'sso-login', 'email-digest', 'feature-flags', 'theme-tokens', 'cache-warmup', 'billing-export', 'backup-jobs', 'onboarding-flow', 'perf-tuning', 'sdk-python', 'audit-log', 'log-shipping'];
var TWO = { 5: 1, 2: 1, 11: 1, 16: 1, 21: 1 };
var WORKING = { 'w0:0': 252, 'w1:0': 41, 'w5:1': 731, 'w30:0': 18, 'w37:1': 3700 };
var UNKNOWN = { 'w12:0': 95 };
var IDLE_SECS = [120, 3400, 620, 15, 7300, 9000, 86400 * 2, 300, 44, 1800, 5400, 260, 880, 12000, 700, 95, 2100, 30000, 410, 66, 3000, 1500, 18000, 840, 7];
function sample(n, opts) {
  opts = opts || {};
  var ws = [], k = 0;
  for (var i = 0; i < n; i++) {
    var name = NAMES[i % NAMES.length];
    if (i >= NAMES.length) name = NAMES[(i * 7) % NAMES.length] + (i % 3 === 0 ? '' : '-' + (i % 9));
    var cnt = opts.agentsPer ? opts.agentsPer[i % opts.agentsPer.length] : ((n > 25 ? i % 7 === 2 : TWO[i]) ? 2 : 1);
    var panes = [];
    for (var j = 0; j < cnt; j++) {
      var id = 'w' + i + ':' + j;
      var st = 'idle', secs = IDLE_SECS[(k + j) % IDLE_SECS.length] + j * 37;
      if (WORKING[id] != null) { st = 'working'; secs = WORKING[id]; }
      if (UNKNOWN[id] != null) { st = 'unknown'; secs = UNKNOWN[id]; }
      panes.push({ id: id, folder: (j === 1 ? 'api-gateway' : name.replace(/-\d$/, '')), status: st, secs: secs });
    }
    k += cnt;
    ws.push({ id: 'w' + i, name: name, panes: panes });
  }
  return ws;
}
function P(id, sp, st, secs, folder) { return { id: id, species: sp, status: st, secs: secs, folder: folder }; }
var SCENES = {
  day: { W: 120, H: 40, hour: 13.5, n: 25, sel: 'w4:0', focus: 'w3:0' },
  night: { W: 120, H: 40, hour: 23, n: 25, sel: 'w4:0', focus: 'w3:0' },
  dusk: { W: 120, H: 40, hour: 18.7, n: 25, sel: 'w4:0', focus: 'w3:0' },
  compact: { W: 80, H: 24, hour: 10, n: 25, sel: 'w4:0', focus: 'w3:0' },
  overflow: { W: 120, H: 40, hour: 13.5, n: 44, sel: 'w10:0', focus: 'w3:0' },
  wide: { W: 200, H: 60, hour: 15, n: 25, sel: 'w3:0', focus: 'w0:0' },
  sparse: { W: 120, H: 40, hour: 10, sel: 'a1:0', focus: 'a0:0', ws: [
    { id: 'a0', name: 'auth-refactor', panes: [P('a0:0', 'sheep', 'working', 252, 'auth-refactor')] },
    { id: 'a1', name: 'metrics-dash', panes: [P('a1:0', 'cow', 'idle', 3400, 'metrics-dash')] },
    { id: 'a2', name: 'release-notes', panes: [P('a2:0', 'pig', 'idle', 620, 'release')] }] },
  anat1: { W: 60, H: 14, hour: 12, tier: 'norm', crop: 'farm', sel: 'a2:1', focus: 'a0:0', ws: [
    { id: 'a0', name: 'auth-refactor', panes: [P('a0:0', 'sheep', 'working', 252, 'auth-refactor')] },
    { id: 'a1', name: 'api-gateway', panes: [P('a1:0', 'pig', 'idle', 620, 'api-gateway'), P('a1:1', 'cow', 'working', 38, 'api-gateway')] },
    { id: 'a2', name: 'search-index', panes: [P('a2:0', 'hen', 'idle', 3400, 'search'), P('a2:1', 'sheep', 'idle', 9000, 'search'), P('a2:2', 'pig', 'unknown', 95, 'scratch')] }] },
  anat2: { W: 90, H: 20, hour: 12, tier: 'big', crop: 'farm', sel: 'a2:1', focus: 'a0:0', ws: [
    { id: 'a0', name: 'auth-refactor', panes: [P('a0:0', 'cow', 'working', 252, 'auth-refactor')] },
    { id: 'a1', name: 'api-gateway', panes: [P('a1:0', 'pig', 'idle', 620, 'api-gateway'), P('a1:1', 'hen', 'working', 38, 'gateway')] },
    { id: 'a2', name: 'search-index', panes: [P('a2:0', 'sheep', 'idle', 3400, 'search'), P('a2:1', 'cow', 'idle', 9000, 'search'), P('a2:2', 'pig', 'unknown', 95, 'scratch')] }] },
  anat0: { W: 45, H: 10, hour: 12, tier: 'mini', crop: 'farm', sel: 'a2:1', focus: 'a0:0', ws: [
    { id: 'a0', name: 'auth-refactor', panes: [P('a0:0', 'sheep', 'working', 252, 'x')] },
    { id: 'a1', name: 'api-gateway', panes: [P('a1:0', 'pig', 'idle', 620, 'x'), P('a1:1', 'hen', 'working', 38, 'x')] },
    { id: 'a2', name: 'search-index', panes: [P('a2:0', 'cow', 'idle', 3400, 'x'), P('a2:1', 'sheep', 'idle', 9000, 'x'), P('a2:2', 'pig', 'unknown', 95, 'x')] }] },
  sky: { W: 60, H: 14, hour: 12, tier: 'mini', crop: 'sky', ws: [] },
  demo: { W: 60, H: 14, hour: 12, tier: 'norm', crop: 'farm', sel: null, focus: null, ws: [
    { id: 'd0', name: 'working', panes: [P('d0:0', 'sheep', 'working', 252, 'x')] },
    { id: 'd1', name: 'idle', panes: [P('d1:0', 'pig', 'idle', 620, 'x')] },
    { id: 'd2', name: 'unknown', panes: [P('d2:0', 'cow', 'unknown', 95, 'x')] }] },
  demo2: { W: 60, H: 14, hour: 12, tier: 'norm', crop: 'farm', sel: null, focus: null, ws: [
    { id: 'd0', name: 'working', panes: [P('d0:0', 'hen', 'working', 38, 'x')] },
    { id: 'd1', name: 'idle', panes: [P('d1:0', 'sheep', 'idle', 620, 'x')] },
    { id: 'd2', name: 'unknown', panes: [P('d2:0', 'hen', 'unknown', 95, 'x')] }] }
};
function scene(name, o) {
  o = o || {};
  var b = SCENES[name] || SCENES.day;
  var S = { W: o.W || b.W, H: o.H || b.H, hour: o.hour != null ? o.hour : b.hour, tick: o.tick || 0, selected: b.sel === undefined ? null : b.sel, focus: b.focus || null, tier: o.tier || b.tier || null, crop: b.crop || null, flat: !!o.flat };
  S.workspaces = b.ws ? b.ws : sample(o.n || b.n);
  if (o.n && b.ws) S.workspaces = b.ws.slice(0, o.n);
  return S;
}

return { render: render, renderSheet: renderSheet, spriteFrame: spriteFrame, toRuns: toRuns, toAnsi: toAnsi, toText: toText, move: move, layout: layout, scene: scene, sample: sample, SCENES: SCENES, TIERS: TIERS, PAL: PAL, SPR: SPR, MINI: MINI, SP_PAL: SP_PAL, MINI_PAL: MINI_PAL, FX: FX, ANIM: ANIM, SKY_KEYS: SKY_KEYS, DECOR: DECOR, hex: hex, toHex: toHex, q256: q256, idx2rgb: idx2rgb, speciesOf: speciesOf, fmtDur: fmtDur, ellip: ellip, skyAt: skyAt, nightness: nightness, starVis: starVis, h32: h32, mix: mix, lab: lab };
});
