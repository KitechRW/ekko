import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createApp } from "../src/server.mjs";

test("publishes a single YouTube event, protecting admin changes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ekko-mvp-"));
  const dataFile = join(dir, "event.json");
  const server = createApp({
    dataFile,
    adminPassword: "correct-horse-battery",
    sessionSecret: "test-secret-with-at-least-thirty-two-characters",
    secureCookies: false
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const json = { "Content-Type": "application/json" };
  try {
    let response = await fetch(base + "/api/event");
    assert.deepEqual((await response.json()).event, null);
    response = await fetch(base + "/api/admin/event", {
      method: "PUT", headers: json, body: JSON.stringify({})
    });
    assert.equal(response.status, 401);

    response = await fetch(base + "/api/admin/login", {
      method: "POST", headers: json, body: JSON.stringify({ password: "incorrect" })
    });
    assert.equal(response.status, 401);
    response = await fetch(base + "/api/admin/login", {
      method: "POST", headers: json, body: JSON.stringify({ password: "correct-horse-battery" })
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie").split(";")[0];
    assert.ok(cookie.startsWith("ekko_session="));

    const event = {
      churchName: "Test Church",
      title: "Sunday Live",
      description: "Join the service",
      youtubeUrl: "https://youtube.com/live/jfKfPfyJRdk",
      status: "live",
      scheduledStartAt: "2026-10-11T09:00:00.000Z"
    };
    response = await fetch(base + "/api/admin/event", {
      method: "PUT", headers: { ...json, Cookie: cookie },
      body: JSON.stringify(event)
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).event.status, "live");
    response = await fetch(base + "/api/event");
    const publicEvent = (await response.json()).event;
    assert.equal(publicEvent.title, "Sunday Live");
    assert.equal(publicEvent.youtubeVideoId, "jfKfPfyJRdk");
    assert.equal(JSON.parse(await readFile(dataFile, "utf8")).title, "Sunday Live");

    response = await fetch(base + "/api/admin/event", {
      method: "PUT", headers: { ...json, Cookie: cookie, Origin: "https://attacker.example" },
      body: JSON.stringify(event)
    });
    assert.equal(response.status, 403);

    response = await fetch(base + "/");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /EKKO/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
