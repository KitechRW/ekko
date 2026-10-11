import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { validateEvent } from "./event.mjs";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DEFAULT_DATA_FILE = join(ROOT, "data", "featured-event.json");
const MAX_BODY = 16384;
const STATIC = new Map([
  ["/", ["apps/web/index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["apps/web/styles.css", "text/css; charset=utf-8"]],
  ["/viewer.js", ["apps/web/viewer.js", "text/javascript; charset=utf-8"]],
  ["/admin", ["apps/admin/index.html", "text/html; charset=utf-8"]],
  ["/admin.js", ["apps/admin/admin.js", "text/javascript; charset=utf-8"]]
]);

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(data));
}

function hash(value) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(a, b) {
  const x = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const y = Buffer.isBuffer(b) ? b : Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function parseCookies(value = "") {
  return Object.fromEntries(
    value.split(";").map(s => s.trim().split(/=(.*)/s).slice(0, 2)).filter(p => p.length === 2)
  );
}

async function jsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const error = new Error("Request is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON request.");
    error.status = 400;
    throw error;
  }
}

export function createApp(options = {}) {
  const dataFile = resolve(options.dataFile || process.env.EKKO_DATA_FILE || DEFAULT_DATA_FILE);
  const password = options.adminPassword ?? process.env.EKKO_ADMIN_PASSWORD;
  const secret = options.sessionSecret ?? process.env.EKKO_SESSION_SECRET;
  const secureCookies = options.secureCookies ?? process.env.NODE_ENV === "production";
  const publicOrigin = options.publicOrigin || process.env.EKKO_PUBLIC_ORIGIN || null;
  const configured = typeof password === "string" && password.length >= 12 &&
    typeof secret === "string" && secret.length >= 32;
  const failures = new Map();
  let writeQueue = Promise.resolve();

  function signature(payload) {
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  function newSession() {
    const expires = Date.now() + 12 * 60 * 60 * 1000;
    const payload = "v1." + expires + "." + randomBytes(16).toString("hex");
    return payload + "." + signature(payload);
  }

  function authenticated(req) {
    if (!configured) return false;
    const token = parseCookies(req.headers.cookie).ekko_session;
    if (!token) return false;
    const parts = token.split(".");
    if (parts.length !== 4 || parts[0] !== "v1") return false;
    const expires = Number(parts[1]);
    if (!Number.isSafeInteger(expires) || expires <= Date.now()) return false;
    if (!/^[a-f0-9]{32}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3])) return false;
    return safeEqual(parts[3], signature(parts.slice(0, 3).join(".")));
  }

  function cookie(token, maxAge = 43200) {
    return "ekko_session=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" +
      maxAge + (secureCookies ? "; Secure" : "");
  }

  function originAllowed(req) {
    if (!req.headers.origin) return true;
    const host = req.headers.host;
    const valid = publicOrigin ? [publicOrigin] : ["http://" + host, "https://" + host];
    return valid.includes(req.headers.origin);
  }

  async function getEvent() {
    try {
      const data = JSON.parse(await readFile(dataFile, "utf8"));
      return data;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  function saveEvent(event) {
    const next = writeQueue.catch(() => {}).then(async () => {
      await mkdir(dirname(dataFile), { recursive: true });
      const temp = dataFile + "." + randomBytes(8).toString("hex") + ".tmp";
      await writeFile(temp, JSON.stringify(event, null, 2) + "\n", { mode: 0o600 });
      await rename(temp, dataFile);
    });
    writeQueue = next;
    return next;
  }

  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
      "connect-src 'self'; frame-src https://www.youtube-nocookie.com https://www.youtube.com; " +
      "base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      if (req.method === "GET" && path === "/api/health") {
        return send(res, 200, { ok: true });
      }
      if (req.method === "GET" && path === "/api/event") {
        return send(res, 200, { event: await getEvent() });
      }
      if (req.method === "GET" && path === "/api/admin/session") {
        return send(res, 200, { configured, authenticated: authenticated(req) });
      }
      if (["POST", "PUT", "DELETE"].includes(req.method) && !originAllowed(req)) {
        return send(res, 403, { error: "Untrusted request origin." });
      }
      if (req.method === "POST" && path === "/api/admin/login") {
        if (!configured) return send(res, 503, { error: "Administrator credentials are not configured." });
        const ip = req.socket.remoteAddress || "unknown";
        const window = failures.get(ip);
        const now = Date.now();
        if (window && window.until > now && window.count >= 8) {
          return send(res, 429, { error: "Too many attempts. Try again later." });
        }
        const body = await jsonBody(req);
        if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.password !== "string" || !safeEqual(hash(body.password), hash(password))) {
          const previous = window && window.until > now ? window.count : 0;
          failures.set(ip, { count: previous + 1, until: now + 15 * 60 * 1000 });
          return send(res, 401, { error: "Incorrect password." });
        }
        failures.delete(ip);
        return send(res, 200, { authenticated: true }, { "Set-Cookie": cookie(newSession()) });
      }
      if (req.method === "POST" && path === "/api/admin/logout") {
        return send(res, 200, { authenticated: false }, { "Set-Cookie": cookie("", 0) });
      }
      if (req.method === "PUT" && path === "/api/admin/event") {
        if (!authenticated(req)) return send(res, 401, { error: "Please sign in first." });
        const input = await jsonBody(req);
        let event;
        try {
          event = validateEvent(input);
        } catch (error) {
          return send(res, 400, { error: error.message });
        }
        await saveEvent(event);
        return send(res, 200, { event });
      }
      if (req.method === "GET" && STATIC.has(path)) {
        const [asset, type] = STATIC.get(path);
        const data = await readFile(join(ROOT, asset));
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
        return res.end(data);
      }
      return send(res, 404, { error: "Not found." });
    } catch (error) {
      if (error.status) return send(res, error.status, { error: error.message });
      console.error("EKKO request failed:", error);
      return send(res, 500, { error: "Unexpected server error." });
    }
  });
}

export function start() {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, "0.0.0.0", () => {
    console.log("EKKO v0.1 listening on port " + port);
    if (!process.env.EKKO_ADMIN_PASSWORD || !process.env.EKKO_SESSION_SECRET) {
      console.warn("Admin is disabled until EKKO_ADMIN_PASSWORD (12+ chars) and EKKO_SESSION_SECRET (32+ chars) are configured.");
    }
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start();
