import { createHash } from "node:crypto";
import { CHANNEL_ID, VIDEO_ID, fetchVideos, discover, subscribeWebSub } from "./youtube.mjs";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Each discovery uses two search.list requests. New YouTube projects may have
// a 100-search-call daily bucket distinct from the videos.list unit budget.
export function makeAutomation({ read, mutate, fetcher, apiKey, origin, secret, clock = Date.now, log = console }) {
  let running = null;

  async function verifyVideos(channelId, ids) {
    if (!apiKey || !ids.length) return [];
    return fetchVideos(fetcher, apiKey, ids, channelId);
  }

  async function sync({ forceDiscovery = false, notifiedIds = [] } = {}) {
    if (running) return running;
    running = (async () => {
      const initial = await read();
      const channelId = initial.channelId;
      if (!CHANNEL_ID.test(channelId || "")) return { reason: "Connect a YouTube channel first." };
      if (!apiKey) return { reason: "Set YOUTUBE_API_KEY on the server to enable automatic discovery." };
      const now = clock();
      const today = new Date(now).toISOString().slice(0, 10);
      const lastDiscovery = Date.parse(initial.lastDiscoveryAt || 0) || 0;
      const due = now - lastDiscovery >= HOUR;
      // A manual discovery is allowed every 10 minutes, but still capped by quota.
      const manualAllowed = forceDiscovery && now - lastDiscovery >= 10 * 60 * 1000;
      const usage = initial.searchUsage?.date === today ? initial.searchUsage.count : 0;
      const shouldDiscover = (due || manualAllowed) && usage <= 70;
      const ids = [...new Set([
        initial.approvedVideoId,
        ...(initial.candidates || []).filter(x => x.status !== "ended").map(x => x.youtubeVideoId),
        ...notifiedIds
      ])].filter(x => VIDEO_ID.test(x || "")).slice(0, 45);

      let fresh = [];
      let discoveryFailed = false;
      if (shouldDiscover) {
        // Reserve search calls before making them; prevents an outage burning quota.
        await mutate(data => {
          if (data.channelId !== channelId) return data;
          const old = data.searchUsage?.date === today ? data.searchUsage.count : 0;
          return { ...data, lastDiscoveryAt: new Date(now).toISOString(), searchUsage: { date: today, count: old + 2 } };
        });
        try {
          fresh = await discover(fetcher, apiKey, channelId);
        } catch (error) {
          discoveryFailed = true;
          log.warn("EKKO channel discovery:", error.message);
        }
      }
      let tracked = [];
      try {
        tracked = await verifyVideos(channelId, ids);
      } catch (error) {
        log.warn("EKKO video status check:", error.message);
      }
      if (fresh.length || tracked.length) {
        await mutate(data => {
          if (data.channelId !== channelId) return data;
          const merged = new Map((data.candidates || []).map(x => [x.youtubeVideoId, x]));
          for (const item of [...fresh, ...tracked]) merged.set(item.youtubeVideoId, item);
          const candidates = [...merged.values()]
            .filter(item => item.channelId === channelId)
            .sort((a,b) => {
              const rank = x => x.status === "live" ? 0 : x.status === "scheduled" ? 1 : 2;
              return rank(a) - rank(b) || (Date.parse(a.scheduledStartAt || 0) || 0) - (Date.parse(b.scheduledStartAt || 0) || 0);
            }).slice(0, 24);
          const approved = candidates.find(x => x.youtubeVideoId === data.approvedVideoId);
          const event = approved ? {
            ...approved, churchName: data.churchName, updatedAt: new Date(now).toISOString()
          } : data.event;
          return { ...data, candidates, event, lastVideoCheckAt: new Date(now).toISOString() };
        });
      }
      // The original channel may be deconfigured while a network request is underway.
      const latest = await read();
      if (latest.channelId === channelId && secret && origin.startsWith("https://")) {
        const last = Date.parse(latest.websubRequestedAt || 0) || 0;
        if (now - last >= 5 * DAY) {
          await mutate(data => data.channelId === channelId ?
            { ...data, websubRequestedAt: new Date(now).toISOString() } : data);
          const subscriptionSecret = createHash("sha256").update(secret + ":" + channelId).digest("hex");
          try {
            await subscribeWebSub(fetcher, channelId, origin, subscriptionSecret);
          } catch (error) {
            log.warn("EKKO WebSub subscription:", error.message);
            // Allow a retry at the next scheduled sync after a temporary failure.
            await mutate(data => data.channelId === channelId ? { ...data, websubRequestedAt: null } : data);
          }
        }
      }
      return { candidates: latest.candidates?.length || 0, updated: Boolean(fresh.length || tracked.length),
        discovered: fresh.length, discoveryFailed };
    })().finally(() => { running = null; });
    return running;
  }

  return { sync };
}
