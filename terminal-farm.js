#!/usr/bin/env node
// terminal-farm: a live farm of your herdr agent panes. Data from herdr, durations from the
// terminal-farm-status pi extension (~/.terminal-farm/state/<pid>.json), drawing from vendor/engine.js.
'use strict';
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const E = require('./vendor/engine.js');

const STATE_DIR = path.join(os.homedir(), '.terminal-farm', 'state');
const MODE = process.argv.includes('--256') || !/truecolor|24bit/i.test(process.env.COLORTERM || '') ? '256' : 'truecolor';
const ONCE = process.argv.includes('--once');
const CAFFEINATE = !process.argv.includes('--no-caffeinate');

const herdr = (...args) => new Promise((res, rej) =>
  execFile('herdr', args, { timeout: 5000 }, (err, out) => {
    if (err) return rej(err);
    try { res(JSON.parse(out).result); } catch (e) { rej(e); }
  }));

// herdr statuses -> the three the design draws. blocked = waiting on you, drawn as the `?` ghost.
const mapStatus = s => s === 'working' ? 'working' : s === 'idle' || s === 'done' ? 'idle' : 'unknown';

const pidOf = new Map();   // pane_id -> { pid, at }
const seen = new Map();    // pane_id -> { status, since|null } as observed by this terminal-farm run
let data = { workspaces: [], focus: null, error: null };

async function piPid(paneId) {
  const c = pidOf.get(paneId);
  if (c && Date.now() - c.at < 10000) return c.pid;
  let pid = null;
  try {
    const r = await herdr('pane', 'process-info', '--pane', paneId);
    const procs = r.process_info.foreground_processes || [];
    const p = procs.find(x => x.argv0 === 'pi') || procs.find(x => fs.existsSync(path.join(STATE_DIR, x.pid + '.json')));
    pid = p ? p.pid : null;
  } catch {}
  pidOf.set(paneId, { pid, at: Date.now() });
  return pid;
}

function readState(pid) {
  if (!pid) return null;
  try { return JSON.parse(fs.readFileSync(path.join(STATE_DIR, pid + '.json'), 'utf8')); } catch { return null; }
}

async function poll() {
  try {
    const [w, a] = await Promise.all([herdr('workspace', 'list'), herdr('agent', 'list')]);
    const now = Date.now();
    const agents = a.agents || [];
    const pids = await Promise.all(agents.map(x => piPid(x.pane_id)));
    const byWs = new Map();
    let focus = null;
    agents.forEach((x, i) => {
      const status = mapStatus(x.agent_status);
      const prev = seen.get(x.pane_id);
      // a transition terminal-farm watched happen is a real timestamp; the first sighting is not
      const obs = !prev ? { status, since: null } : prev.status !== status ? { status, since: now } : prev;
      seen.set(x.pane_id, obs);
      const st = readState(pids[i]);
      const since = st && mapStatus(st.status) === status ? st.since : obs.since;
      if (x.focused) focus = x.pane_id;
      if (!byWs.has(x.workspace_id)) byWs.set(x.workspace_id, []);
      byWs.get(x.workspace_id).push({
        id: x.pane_id, status, folder: path.basename(x.cwd || ''),
        since,
      });
    });
    const workspaces = (w.workspaces || [])
      .slice().sort((p, q) => p.number - q.number)
      .filter(ws => byWs.has(ws.workspace_id))
      .map(ws => ({ id: ws.workspace_id, name: ws.label || ws.workspace_id, panes: byWs.get(ws.workspace_id) }));
    for (const id of seen.keys()) if (!agents.some(x => x.pane_id === id)) seen.delete(id);
    data = { workspaces, focus, error: null };
  } catch (e) {
    data = { ...data, error: 'herdr not reachable: ' + (e.message || e).toString().split('\n')[0] };
  }
}

let selected = null, t0 = Date.now(), last = [], lastAgents = [];
const out = s => process.stdout.write(s);

function frame() {
  const W = process.stdout.columns || 120, H = process.stdout.rows || 40;
  const d = new Date();
  const hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  // live secs keep ticking between polls
  const now = Date.now();
  const ws = data.workspaces.map(w => ({ ...w, panes: w.panes.map(p => ({ ...p, secs: p.since == null ? null : (now - p.since) / 1000 })) }));
  const all = ws.flatMap(w => w.panes);
  if (!all.some(p => p.id === selected)) selected = data.focus || (all[0] && all[0].id) || null;
  const r = E.render({ W, H, hour, tick: now - t0, // engine animates on elapsed ms
    selected, focus: data.focus, tier: null, crop: null, flat: false, workspaces: ws });
  lastAgents = r.agents;
  const bar = r.cells[r.cells.length - 1];
  // ☕ in the gap before the clock; it is 2 cells wide, so the next cell is emptied
  if (CAFFEINATE && !ONCE && W > 10 && [9, 8, 7].every(i => bar[W - i] && bar[W - i].ch === ' ')) {
    bar[W - 8] = { ...bar[W - 8], ch: '\u2615', fg: [230, 200, 150] }; bar[W - 7] = { ...bar[W - 7], ch: '' };
  }
  const rows = E.toAnsi(r.cells, MODE).split('\n');
  if (data.error) rows[0] = '\x1b[0;41;97m ' + data.error.slice(0, W - 2).padEnd(W - 2) + ' \x1b[0m';
  return rows;
}

function draw() {
  const rows = frame();
  let s = '';
  rows.forEach((row, y) => { if (last[y] !== row) s += `\x1b[${y + 1};1H` + row; });
  last = rows;
  if (s) out(s);
}

function quit() {
  out('\x1b[0m\x1b[?25h\x1b[?1049l');
  try { process.stdin.setRawMode(false); } catch {}
  process.exit(0);
}

const KEYS = {
  h: 'left', j: 'down', k: 'up', l: 'right',
  '\x1b[D': 'left', '\x1b[B': 'down', '\x1b[A': 'up', '\x1b[C': 'right',
};

async function main() {
  await poll();
  if (ONCE) { out(frame().join('\n') + '\n'); return; }
  // keep the Mac awake while terminal-farm runs; -w ends caffeinate when this process dies, even on a crash
  if (CAFFEINATE) execFile('caffeinate', ['-dims', '-w', String(process.pid)], () => {});
  out((CAFFEINATE ? '\x1b]0;\u2615 terminal-farm (caffeinated)\x07' : '\x1b]0;terminal-farm\x07') + '\x1b[?1049h\x1b[?25l\x1b[2J');
  process.on('SIGINT', quit); process.on('SIGTERM', quit);
  process.on('uncaughtException', e => { out('\x1b[0m\x1b[?25h\x1b[?1049l'); console.error(e); process.exit(1); });
  process.stdout.on('resize', () => { last = []; out('\x1b[2J'); });
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', k => {
    if (k === 'q' || k === '\x03') return quit();
    if (k === '\r' && selected) { execFile('herdr', ['agent', 'focus', selected], () => {}); return; }
    if (KEYS[k]) { selected = E.move(lastAgents, selected, KEYS[k]); draw(); }
  });
  let polling = false;
  setInterval(async () => { if (polling) return; polling = true; try { await poll(); } finally { polling = false; } }, 1000);
  setInterval(draw, 125);
  draw();
}

main();
