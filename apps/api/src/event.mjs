const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const STATUSES = new Set(["scheduled", "live", "ended"]);

export function extractYouTubeVideoId(value) {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let id = null;
  if (host === "youtu.be") id = parts.length === 1 ? parts[0] : null;
  else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (["live", "embed"].includes(parts[0]) && parts.length === 2) id = parts[1];
  } else if (host === "www.youtube-nocookie.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "embed" && parts.length === 2) id = parts[1];
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export function validateEvent(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("An event object is required.");
  }
  function text(field, max, required = false) {
    if (body[field] !== undefined && typeof body[field] !== "string") {
      throw new Error(field + " must be text.");
    }
    const value = (body[field] || "").trim();
    if (required && !value) throw new Error(field + " is required.");
    if (value.length > max) throw new Error(field + " is too long.");
    return value;
  }
  const churchName = text("churchName", 100, true);
  const title = text("title", 140, true);
  const description = text("description", 2000);
  const youtubeUrl = text("youtubeUrl", 500, true);
  const youtubeVideoId = extractYouTubeVideoId(youtubeUrl);
  if (!youtubeVideoId) throw new Error("Enter a valid HTTPS YouTube video or live URL.");
  const status = text("status", 20, true);
  if (!STATUSES.has(status)) throw new Error("Invalid broadcast status.");
  const scheduled = text("scheduledStartAt", 50);
  let scheduledStartAt = null;
  if (scheduled) {
    const date = new Date(scheduled);
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid broadcast date.");
    scheduledStartAt = date.toISOString();
  }
  return {
    id: "featured",
    churchName,
    title,
    description,
    status,
    scheduledStartAt,
    youtubeVideoId,
    youtubeUrl: "https://www.youtube.com/watch?v=" + youtubeVideoId,
    updatedAt: new Date().toISOString()
  };
}
