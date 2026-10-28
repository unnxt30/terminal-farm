// pi extension: records this pi process's state and when it entered it,
// so `coffee` can show real "working for 4m" / "idle for 2h" durations.
// Writes ~/.coffee/state/<pid>.json; removes it on shutdown.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const dir = join(homedir(), ".coffee", "state");
const file = join(dir, `${process.pid}.json`);

export default function (pi: ExtensionAPI) {
  let sessionFile: string | undefined;
  const write = (status: "working" | "idle") => {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, JSON.stringify({ pid: process.pid, status, since: Date.now(), sessionFile }));
    } catch {} // never break pi over a status file
  };
  pi.on("session_start", (_ev, ctx) => {
    try { sessionFile = ctx.sessionManager.getSessionFile(); } catch {}
    write("idle");
  });
  pi.on("agent_start", () => write("working"));
  pi.on("agent_settled", () => write("idle"));
  pi.on("session_shutdown", () => { try { rmSync(file, { force: true }); } catch {} });
}
