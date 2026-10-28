// self-check: drive the extension with a fake pi and assert the state file it writes.
const assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const jiti = require(process.env.JITI)(__filename);
const ext = jiti(path.join(__dirname, '../extension/coffee-status.ts')).default;
const h = {}; ext({ on: (e, f) => (h[e] = f) });
const file = path.join(os.homedir(), '.coffee/state', process.pid + '.json');
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
h.session_start({}, { sessionManager: { getSessionFile: () => '/x.jsonl' } });
assert.equal(read().status, 'idle'); assert.equal(read().sessionFile, '/x.jsonl');
h.agent_start(); assert.equal(read().status, 'working');
h.agent_settled(); assert.equal(read().status, 'idle');
h.session_shutdown(); assert.ok(!fs.existsSync(file));
console.log('extension ok');
