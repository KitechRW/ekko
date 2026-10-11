import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { makeAutomation } from "./automation.mjs";
import { CHANNEL_ID, VIDEO_ID, parseVideoNotifications, validWebSubSignature, lookupYouTubeChannels, interpretChannelQuery } from "./youtube.mjs";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DEFAULT_DATA_FILE = join(ROOT, "data", "featured-event.json");
const STATIC = new Map([
  ["/", ["apps/web/index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["apps/web/styles.css", "text/css; charset=utf-8"]],
  ["/immersive.css", ["apps/web/immersive.css", "text/css; charset=utf-8"]],
  ["/sw.js", ["apps/web/sw.js", "text/javascript; charset=utf-8"]],
  ["/studio.css", ["apps/admin/studio.css", "text/css; charset=utf-8"]],
  ["/viewer.js", ["apps/web/viewer.js", "text/javascript; charset=utf-8"]],
  ["/admin", ["apps/admin/index.html", "text/html; charset=utf-8"]],
  ["/admin.js", ["apps/admin/admin.js", "text/javascript; charset=utf-8"]],
  ["/assets/logo.svg", ["apps/web/assets/logo.svg", "image/svg+xml"]],
  ["/assets/logo-light.svg", ["apps/web/assets/logo-light.svg", "image/svg+xml"]],
  ["/assets/icon.svg", ["apps/web/assets/icon.svg", "image/svg+xml"]],
  ["/assets/social-card.svg", ["apps/web/assets/social-card.svg", "image/svg+xml"]],
  ["/assets/social-card.png", ["apps/web/assets/social-card.png", "image/png"]],
  ["/assets/icon.png", ["apps/web/assets/icon.png", "image/png"]],
  ["/assets/icon-192.png", ["apps/web/assets/icon-192.png", "image/png"]],
  ["/assets/icon-512.png", ["apps/web/assets/icon-512.png", "image/png"]],
  ["/assets/apple-touch-icon.png", ["apps/web/assets/apple-touch-icon.png", "image/png"]],
  ["/assets/logo-light.png", ["apps/web/assets/logo-light.png", "image/png"]],
  ["/assets/site.webmanifest", ["apps/web/assets/site.webmanifest", "application/manifest+json"]]
]);
const eq = (x, y) => {
  const a = Buffer.isBuffer(x) ? x : Buffer.from(x);
  const b = Buffer.isBuffer(y) ? y : Buffer.from(y);
  return a.length === b.length && timingSafeEqual(a,b);
};
const escapeMeta = value => String(value||"")
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;")
  .replace(/[\r\n]+/g," ").slice(0,250);
function viewerShareMetadata(event){
  if(!event||!["scheduled","live"].includes(event.status))
    return {title:"EKKO — Faith Through Hearing.",
      description:"Experience church services and Christian live events together, from wherever you are."};
  const title=String(event.title||"Live gathering").trim();
  const church=String(event.churchName||"EKKO").trim();
  let timing=event.status==="live"?"Live now":"Upcoming broadcast";
  if(event.status==="scheduled" && event.scheduledStartAt){
    const date=new Date(event.scheduledStartAt);
    if(Number.isFinite(date.getTime())){
      timing="Starts: "+new Intl.DateTimeFormat("en",{weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:"UTC",timeZoneName:"short"}).format(date);
    }
  }
  return {title:title+" — "+church+" | EKKO",
    description:title+" with "+church+". "+timing+". Join on EKKO."};
}
const send = (res, status, data, headers = {}) => {
  res.writeHead(status, { "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store", ...headers });
  res.end(JSON.stringify(data));
};
async function collect(req, limit=16384) {
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>limit) { const error=new Error("Request is too large."); error.status=413; throw error; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function jsonBody(req) {
  let body;
  try { body=JSON.parse((await collect(req)).toString("utf8")); }
  catch { const error=new Error("Invalid JSON request."); error.status=400; throw error; }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error=new Error("A JSON object is required."); error.status=400; throw error;
  }
  return body;
}
function blank() {
  return {churchName:"", channelId:null, channelHandle:"", channelAvatarUrl:"", candidates:[], approvedVideoId:null, event:null,
    overrideStatus:null, lastDiscoveryAt:null, lastVideoCheckAt:null, searchUsage:null, websubRequestedAt:null, websubLeaseExpiresAt:null};
}
export function createApp(options={}) {
  const dataFile=resolve(options.dataFile || process.env.EKKO_DATA_FILE || DEFAULT_DATA_FILE);
  const password=options.adminPassword ?? process.env.EKKO_ADMIN_PASSWORD;
  const secret=options.sessionSecret ?? process.env.EKKO_SESSION_SECRET;
  const youtubeApiKey=options.youtubeApiKey ?? process.env.YOUTUBE_API_KEY;
  const youtubeFetch=options.youtubeFetch || fetch;
  const publicOrigin=options.publicOrigin || process.env.EKKO_PUBLIC_ORIGIN || "https://ekko.rw";
  let siteOrigin="https://ekko.rw";
  try { const parsed=new URL(publicOrigin); if(["http:","https:"].includes(parsed.protocol)) siteOrigin=parsed.origin; } catch {}
  const secureCookies=options.secureCookies ?? process.env.NODE_ENV === "production";
  const configured=typeof password==="string" && password.length>=12 &&
    typeof secret==="string" && secret.length>=32;
  const failures=new Map();
  const channelLookups=new Map();
  let pending=Promise.resolve();

  async function readState() {
    try {
      const data=JSON.parse(await readFile(dataFile,"utf8"));
      if(data && Array.isArray(data.candidates)) return {...blank(),...data};
      return {...blank(),churchName:data?.churchName || "",
        approvedVideoId:data?.youtubeVideoId || null,
        event:data?.youtubeVideoId ? data : null};
    } catch(error) { if(error.code==="ENOENT") return blank(); throw error; }
  }
  async function mutate(transform) {
    const operation=pending.catch(()=>{}).then(async()=>{
      const previous=await readState();
      const data=await transform(previous);
      await mkdir(dirname(dataFile),{recursive:true});
      const tmp=dataFile+"."+randomBytes(8).toString("hex")+".tmp";
      await writeFile(tmp,JSON.stringify(data,null,2)+"\n",{mode:0o600});
      await rename(tmp,dataFile);
      return data;
    });
    pending=operation;
    return operation;
  }
  function published(state) {
    if (!state.event || !state.approvedVideoId ||
        state.event.youtubeVideoId!==state.approvedVideoId) return null;
    return {...state.event,status:state.overrideStatus || state.event.status};
  }
  function cookies(req) {
    const fields=(req.headers.cookie||"").split(";").map(x=>x.trim().split(/=(.*)/s).slice(0,2));
    return Object.fromEntries(fields.filter(x=>x.length===2));
  }
  const hmac=data=>createHmac("sha256",secret).update(data).digest("hex");
  function makeSession(){
    const value="v1."+(Date.now()+43200000)+"."+randomBytes(16).toString("hex");
    return value+"."+hmac(value);
  }
  function authenticated(req){
    if(!configured)return false;
    const p=(cookies(req).ekko_session||"").split(".");
    if(p.length!==4||p[0]!=="v1"||!Number.isSafeInteger(Number(p[1]))||Number(p[1])<=Date.now()||
       !/^[0-9a-f]{32}$/.test(p[2])||!/^[0-9a-f]{64}$/.test(p[3]))return false;
    return eq(p[3],hmac(p.slice(0,3).join(".")));
  }
  function sessionCookie(value,seconds=43200){
    return "ekko_session="+value+"; HttpOnly; SameSite=Strict; Path=/; Max-Age="+seconds+
      (secureCookies?"; Secure":"");
  }
  function originAllowed(req) {
    if(!req.headers.origin)return true;
    return [publicOrigin,"http://"+req.headers.host,"https://"+req.headers.host].includes(req.headers.origin);
  }
  const automation=makeAutomation({read:readState,mutate,fetcher:youtubeFetch,
    apiKey:youtubeApiKey,origin:siteOrigin,secret,log:console});

  const app=createServer(async(req,res)=>{
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("X-Frame-Options","DENY");
    res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://i.ytimg.com https://yt3.googleusercontent.com https://yt3.ggpht.com https://yt3.google.com; "+
      "connect-src 'self'; frame-src https://www.youtube-nocookie.com https://www.youtube.com; "+
      "base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    try{
      const url=new URL(req.url,"http://localhost"),path=url.pathname;
      if(req.method==="GET" && path==="/api/health")return send(res,200,{ok:true});
      if(req.method==="GET" && path==="/api/event")return send(res,200,{event:published(await readState())});
      if(req.method==="GET" && path==="/api/admin/session")
        return send(res,200,{configured,authenticated:authenticated(req)});
      if(req.method==="GET" && path==="/api/admin/dashboard"){
        if(!authenticated(req))return send(res,401,{error:"Please sign in first."});
        const data=await readState();
        return send(res,200,{...data,event:published(data),apiConfigured:Boolean(youtubeApiKey)});
      }
      if(path==="/api/webhooks/youtube" && req.method==="GET"){
        const data=await readState();
        const topic="https://www.youtube.com/xml/feeds/videos.xml?channel_id="+data.channelId;
        const challenge=url.searchParams.get("hub.challenge");
        if(data.channelId && url.searchParams.get("hub.mode")==="subscribe" &&
          url.searchParams.get("hub.topic")===topic && challenge && challenge.length<2048){
          const lease=Number(url.searchParams.get("hub.lease_seconds"));
          if(Number.isFinite(lease) && lease>=60 && lease<=30*86400){
            await mutate(state=>state.channelId===data.channelId?
              {...state,websubLeaseExpiresAt:new Date(Date.now()+lease*1000).toISOString()}:state);
          }
          res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});
          return res.end(challenge);
        }
        return send(res,404,{error:"Unknown subscription."});
      }
      if(path==="/api/webhooks/youtube" && req.method==="POST"){
        const data=await readState();
        if(!CHANNEL_ID.test(data.channelId||"")||!secret)
          return send(res,404,{error:"Subscription unavailable."});
        const body=await collect(req,65536);
        const signingSecret=createHash("sha256").update(secret+":"+data.channelId).digest("hex");
        const signature=req.headers["x-hub-signature-256"]||req.headers["x-hub-signature"];
        if(!validWebSubSignature(signingSecret,body,signature))
          return send(res,403,{error:"Unverified notification."});
        const ids=parseVideoNotifications(body.toString("utf8"))
          .filter(item=>item.channelId===data.channelId).map(item=>item.videoId);
        res.writeHead(204); res.end();
        if(ids.length)queueMicrotask(()=>automation.sync({notifiedIds:ids}).catch(e=>console.warn("WebSub:",e.message)));
        return;
      }
      if(["POST","PUT","DELETE"].includes(req.method) && !originAllowed(req))
        return send(res,403,{error:"Untrusted request origin."});
      if(req.method==="POST" && path==="/api/admin/login"){
        if(!configured)return send(res,503,{error:"Administrator credentials are not configured."});
        const ip=req.socket.remoteAddress||"unknown",window=failures.get(ip),now=Date.now();
        if(window && window.until>now && window.count>=8)
          return send(res,429,{error:"Too many attempts. Try again later."});
        const body=await jsonBody(req);
        if(typeof body.password!=="string"||!eq(createHash("sha256").update(body.password).digest(),
            createHash("sha256").update(password).digest())){
          const previous=window && window.until>now ? window.count : 0;
          failures.set(ip,{count:previous+1,until:now+900000});
          return send(res,401,{error:"Incorrect password."});
        }
        failures.delete(ip);
        return send(res,200,{authenticated:true},{"Set-Cookie":sessionCookie(makeSession())});
      }
      if(req.method==="POST" && path==="/api/admin/logout")
        return send(res,200,{authenticated:false},{"Set-Cookie":sessionCookie("",0)});
      if(req.method==="GET" && path==="/api/admin/channel/search"){
        if(!authenticated(req))return send(res,401,{error:"Please sign in first."});
        if(!youtubeApiKey)return send(res,503,{error:"YouTube channel search is not configured. Set YOUTUBE_API_KEY."});
        const query=url.searchParams.get("q")||"";
        const kind=interpretChannelQuery(query);
        if(!kind)return send(res,400,{error:"Enter a channel name, @handle, or YouTube channel URL."});
        const ip=req.socket.remoteAddress||"unknown";
        const now=Date.now(),date=new Date(now).toISOString().slice(0,10);
        const previous=channelLookups.get(ip);
        if(previous?.date===date && previous.count>=25)
          return send(res,429,{error:"Daily channel-search limit reached. Try tomorrow."});
        if(previous && now-previous.at<2500)
          return send(res,429,{error:"Please wait a moment before searching again."});
        channelLookups.set(ip,{date,count:previous?.date===date?previous.count+1:1,at:now});
        try {
          const results=await lookupYouTubeChannels(youtubeFetch,youtubeApiKey,query);
          return send(res,200,{channels:results,queryType:kind.type});
        } catch(error) {
          console.warn("YouTube channel search failed:",error.message);
          return send(res,502,{error:"Could not reach YouTube channel search. Please try again."});
        }
      }
      if(req.method==="PUT" && path==="/api/admin/channel"){
        if(!authenticated(req))return send(res,401,{error:"Please sign in first."});
        if(!youtubeApiKey)return send(res,503,{error:"YouTube channel search is not configured. Set YOUTUBE_API_KEY."});
        const body=await jsonBody(req);
        const channelId=typeof body.channelId==="string"?body.channelId.trim():"";
        if(!CHANNEL_ID.test(channelId))
          return send(res,400,{error:"Select a channel from YouTube search results."});
        let channel;
        try {
          channel=(await lookupYouTubeChannels(youtubeFetch,youtubeApiKey,channelId))
            .find(item=>item.channelId===channelId);
        }catch(error){
          console.warn("YouTube channel verification failed:",error.message);
          return send(res,502,{error:"Could not verify the channel with YouTube. Please try again."});
        }
        if(!channel)return send(res,404,{error:"The selected YouTube channel is unavailable."});
        await mutate(data=>data.channelId===channelId ?
          {...data,churchName:channel.title,channelHandle:channel.handle,
            channelAvatarUrl:channel.avatarUrl,
            event:data.event?{...data.event,churchName:channel.title}:null} :
          {...blank(),channelId,churchName:channel.title,
            channelHandle:channel.handle,channelAvatarUrl:channel.avatarUrl});
        queueMicrotask(()=>automation.sync({forceDiscovery:true}).catch(e=>console.warn("Discovery:",e.message)));
        return send(res,200,{ok:true,channel});
      }
      if(req.method==="POST" && path==="/api/admin/scan"){
        if(!authenticated(req))return send(res,401,{error:"Please sign in first."});
        return send(res,200,await automation.sync({forceDiscovery:true}));
      }
      if(req.method==="POST" && path==="/api/admin/approve"){
        if(!authenticated(req))return send(res,401,{error:"Please sign in first."});
        const body=await jsonBody(req);
        if(!VIDEO_ID.test(body.videoId||""))return send(res,400,{error:"Invalid broadcast."});
        const data=await mutate(state=>{
          const item=state.candidates.find(v=>v.youtubeVideoId===body.videoId && v.channelId===state.channelId);
          return item ? {...state,approvedVideoId:body.videoId,overrideStatus:null,
            event:{...item,churchName:state.churchName,updatedAt:new Date().toISOString()}} : state;
        });
        const event=published(data);
        return event ? send(res,200,{event}) :
          send(res,404,{error:"This broadcast must be discovered from the configured channel before approval."});
      }
      if(req.method==="POST" && path==="/api/admin/withdraw"){
        if(!authenticated(req))return send(res,401,{error:"Please sign in first."});
        await mutate(data=>({...data,approvedVideoId:null,overrideStatus:null,event:null}));
        return send(res,200,{ok:true});
      }
      if(req.method==="PUT" && path==="/api/admin/status"){
        if(!authenticated(req))return send(res,401,{error:"Please sign in first."});
        const body=await jsonBody(req);
        if(!["auto","scheduled","live","ended"].includes(body.status))
          return send(res,400,{error:"Invalid status."});
        if(!published(await readState()))return send(res,409,{error:"Approve a broadcast first."});
        const data=await mutate(state=>({...state,
          overrideStatus:body.status==="auto"?null:body.status,
          event:state.event?{...state.event,updatedAt:new Date().toISOString()}:null}));
        const event=published(data);
        return event?send(res,200,{event}):send(res,409,{error:"Approve an event first."});
      }
      if(req.method==="GET" && STATIC.has(path)){
        const [asset,type]=STATIC.get(path),data=await readFile(join(ROOT,asset));
        res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-cache"});
        if(path==="/"){
          const meta=viewerShareMetadata(published(await readState()));
          return res.end(data.toString("utf8")
            .replaceAll("__EKKO_SITE_URL__",siteOrigin+"/")
            .replaceAll("__EKKO_SOCIAL_IMAGE__",siteOrigin+"/assets/social-card.png")
            .replaceAll("__EKKO_SHARE_TITLE__",escapeMeta(meta.title))
            .replaceAll("__EKKO_SHARE_DESCRIPTION__",escapeMeta(meta.description)));
        }
        return res.end(data);
      }
      return send(res,404,{error:"Not found."});
    }catch(error){
      if(error.status)return send(res,error.status,{error:error.message});
      console.error("EKKO request failed:",error);
      return send(res,500,{error:"Unexpected server error."});
    }
  });
  app.syncYouTube=automation.sync;
  return app;
}

export function start(){
  const app=createApp(),port=Number(process.env.PORT||3000);
  app.listen(port,"0.0.0.0",()=>{
    console.log("EKKO v0.1 listening on port "+port);
    app.syncYouTube().catch(e=>console.warn("Initial sync:",e.message));
  });
  const interval=setInterval(()=>app.syncYouTube().catch(e=>console.warn("Sync:",e.message)),60000);
  interval.unref();
  app.on("close",()=>clearInterval(interval));
  return app;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))start();
