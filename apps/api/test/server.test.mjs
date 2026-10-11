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
    const html = await response.text();
    assert.match(html, /EKKO/);
    assert.match(html, /Faith Through Hearing/);
    assert.match(html, /\/assets\/social-card\.svg/);
    assert.doesNotMatch(html, /__EKKO_SOCIAL_IMAGE__/);
    for (const asset of ["/assets/logo.svg", "/assets/logo-light.svg", "/assets/icon.svg", "/assets/social-card.svg"]) {
      const image = await fetch(base + asset);
      assert.equal(image.status, 200);
      assert.match(image.headers.get("content-type"), /image\/svg\+xml/);
      assert.match(await image.text(), /<svg/);
    }
    const manifest = await fetch(base + "/assets/site.webmanifest");
    assert.equal(manifest.status, 200);
    assert.equal((await manifest.json()).short_name, "EKKO");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test("renders absolute social image URLs from the configured public origin", async () => {
  const server = createApp({ publicOrigin: "https://ekko.example", dataFile: join(tmpdir(), "ekko-test-do-not-touch.json") });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/");
    const page = await response.text();
    assert.match(page, /https:\/\/ekko\.example\/assets\/social-card\.svg/);
    assert.match(page, /property="og:url" content="https:\/\/ekko\.example\/"/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
