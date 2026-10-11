// EKKO v0.1: one public YouTube channel, one featured broadcast.
// Search calls are deliberately infrequent: YouTube search has a separate daily call quota.
import { createHmac, timingSafeEqual } from "node:crypto";

export const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export async function ytGet(fetcher, apiKey, endpoint, params = {}) {
  const query = new URLSearchParams({ part: endpoint === "videos" ? "snippet,liveStreamingDetails" : "snippet", ...params, key: apiKey });
  const response = await fetcher("https://www.googleapis.com/youtube/v3/" + endpoint + "?" + query, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("YouTube API returned HTTP " + response.status);
  return response.json();
}

export function normalizeBroadcast(video, channelId) {
  if (!video || !VIDEO_ID.test(video.id) || video.snippet?.channelId !== channelId || !video.liveStreamingDetails) return null;
  const details = video.liveStreamingDetails;
  const liveFlag = video.snippet.liveBroadcastContent;
  const status = details.actualEndTime ? "ended" : liveFlag === "live" || details.actualStartTime ? "live" : "scheduled";
  const thumbnail = video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || "";
  return {
    id: "featured",
    youtubeVideoId: video.id,
    youtubeUrl: "https://www.youtube.com/watch?v=" + video.id,
    title: video.snippet.title || "Live broadcast",
    description: video.snippet.description || "",
    status,
    scheduledStartAt: details.scheduledStartTime || null,
    actualStartAt: details.actualStartTime || null,
    actualEndAt: details.actualEndTime || null,
    thumbnailUrl: /^https:\/\/i\.ytimg\.com\//.test(thumbnail) ? thumbnail : "",
    channelId
  };
}

export function chooseFeatured(candidates, current) {
  const active = candidates.filter(v => v && v.status === "live").sort((a,b) =>
    (Date.parse(a.actualStartAt || a.scheduledStartAt || 0) || 0) - (Date.parse(b.actualStartAt || b.scheduledStartAt || 0) || 0));
  // Never interrupt an active live player for a different event.
  if (current?.status === "live") {
    const stillLive = active.find(v => v.youtubeVideoId === current.youtubeVideoId);
    if (stillLive) return stillLive;
  }
  if (active.length) return active[0];
  const upcoming = candidates.filter(v => v && v.status === "scheduled").sort((a,b) =>
    (Date.parse(a.scheduledStartAt) || Infinity) - (Date.parse(b.scheduledStartAt) || Infinity));
  if (upcoming.length) return upcoming[0];
  return current || null;
}

export async function fetchVideos(fetcher, key, ids, channelId) {
  const valid = [...new Set(ids)].filter(x => VIDEO_ID.test(x));
  if (!valid.length) return [];
  const response = await ytGet(fetcher, key, "videos", { id: valid.slice(0,50).join(",") });
  return (response.items || []).map(item => normalizeBroadcast(item, channelId)).filter(Boolean);
}

export async function discover(fetcher, key, channelId, types = ["live", "upcoming"]) {
  const ids = [];
  for (const eventType of types) {
    const results = await ytGet(fetcher, key, "search", {
      channelId, eventType, type: "video", maxResults: "15", order: "date"
    });
    for (const item of results.items || []) {
      const id = item.id?.videoId;
      if (VIDEO_ID.test(id)) ids.push(id);
    }
  }
  return fetchVideos(fetcher, key, ids, channelId);
}

export function parseVideoNotifications(xml) {
  if (typeof xml !== "string" || xml.length > 65536 || !xml.includes("<feed")) return [];
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].flatMap(([, entry]) => {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const channelId = entry.match(/<yt:channelId>([^<]+)<\/yt:channelId>/)?.[1];
    return VIDEO_ID.test(videoId) && CHANNEL_ID.test(channelId) ? [{ videoId, channelId }] : [];
  });
}

export function validWebSubSignature(secret, payload, header) {
  const match = /^(sha1|sha256)=([a-f0-9]+)$/i.exec(header || "");
  if (!secret || !match) return false;
  const digest = createHmac(match[1].toLowerCase(), secret).update(payload).digest("hex");
  const a = Buffer.from(digest, "hex"), b = Buffer.from(match[2], "hex");
  return a.length === b.length && timingSafeEqual(a,b);
}

export async function subscribeWebSub(fetcher, channelId, origin, secret) {
  const topic = "https://www.youtube.com/xml/feeds/videos.xml?channel_id=" + channelId;
  const body = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.topic": topic,
    "hub.callback": origin + "/api/webhooks/youtube",
    "hub.verify": "async",
    "hub.secret": secret,
    "hub.lease_seconds": "864000"
  });
  const response = await fetcher("https://pubsubhubbub.appspot.com/subscribe", { method:"POST", headers:{"content-type":"application/x-www-form-urlencoded"}, body, signal:AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("YouTube WebSub hub returned HTTP " + response.status);
}
