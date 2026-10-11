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

const HANDLE = /^@[A-Za-z0-9_.-]{3,30}$/;

export function interpretChannelQuery(input) {
  if(typeof input!=="string") return null;
  const raw=input.trim();
  if(!raw||raw.length>150)return null;
  if(CHANNEL_ID.test(raw))return {type:"id",value:raw};
  if(raw.startsWith("https://")){
    let url;
    try{url=new URL(raw);}catch{return null;}
    if(!["youtube.com","www.youtube.com","m.youtube.com"].includes(url.hostname.toLowerCase()))return null;
    const parts=url.pathname.split("/").filter(Boolean);
    if(parts.length!==1 && !(parts.length===2 && parts[0]==="channel"))return null;
    if(parts.length===2 && CHANNEL_ID.test(parts[1]))return {type:"id",value:parts[1]};
    if(parts.length===1 && HANDLE.test(parts[0]))return {type:"handle",value:parts[0]};
    return null;
  }
  if(raw.startsWith("http://")||raw.includes("://"))return null;
  if(HANDLE.test(raw))return {type:"handle",value:raw};
  if(raw.startsWith("@"))return null;
  if(raw.length<2||raw.length>80||/[\x00-\x1f<>]/.test(raw))return null;
  return {type:"name",value:raw};
}

const profileImage = value => {
  if(typeof value!=="string")return "";
  try{
    const url=new URL(value);
    return url.protocol==="https:"&&["yt3.googleusercontent.com","yt3.ggpht.com","yt3.google.com"].includes(url.hostname)?url.href:"";
  }catch{return "";}
};
export function normalizeChannel(item) {
  if(!item||!CHANNEL_ID.test(item.id||"")||!item.snippet)return null;
  const title=typeof item.snippet.title==="string"?item.snippet.title.trim().slice(0,100):"";
  if(!title)return null;
  const handle=typeof item.snippet.customUrl==="string" ? item.snippet.customUrl.trim() : "";
  return {
    channelId:item.id,
    title,
    handle:HANDLE.test(handle)?handle:"",
    description:typeof item.snippet.description==="string"?item.snippet.description.slice(0,220):"",
    avatarUrl:profileImage(item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.default?.url||""),
    url:"https://www.youtube.com/channel/"+item.id
  };
}
export async function lookupYouTubeChannels(fetcher,key,input) {
  const q=interpretChannelQuery(input);
  if(!q)throw new Error("Enter a valid channel name, @handle or YouTube channel URL.");
  if(q.type==="handle"||q.type==="id"){
    const result=await ytGet(fetcher,key,"channels",{[q.type==="handle"?"forHandle":"id"]:q.value});
    return (result.items||[]).map(normalizeChannel).filter(Boolean);
  }
  const search=await ytGet(fetcher,key,"search",{type:"channel",q:q.value,maxResults:"8"});
  const ids=[...new Set((search.items||[]).map(item=>item.id?.channelId).filter(id=>CHANNEL_ID.test(id||"")))].slice(0,8);
  if(!ids.length)return [];
  const details=await ytGet(fetcher,key,"channels",{id:ids.join(",")});
  const byId=new Map((details.items||[]).map(normalizeChannel).filter(Boolean).map(item=>[item.channelId,item]));
  return ids.map(id=>byId.get(id)).filter(Boolean);
}
