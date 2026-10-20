import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createHmac, createHash } from "node:crypto";
import { createApp } from "../src/server.mjs";
import { normalizeBroadcast, parseVideoNotifications, validWebSubSignature, interpretChannelQuery, lookupYouTubeChannels } from "../src/youtube.mjs";

const channelId="UC"+"a".repeat(22);
const videoId="jfKfPfyJRdk";
const channelAvatarUrl="https://yt3.googleusercontent.com/channel-avatar-test";
const sessionSecret="test-secret-with-at-least-thirty-two-characters";
const json={"Content-Type":"application/json"};

test("YouTube state mapping does not publish ordinary videos as broadcasts",()=>{
  const base={id:videoId,snippet:{channelId,title:"Sunday Gathering",liveBroadcastContent:"upcoming",description:"Join us",thumbnails:{high:{url:"https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg"}}},liveStreamingDetails:{scheduledStartTime:"2026-10-20T09:00:00Z"}};
  assert.equal(normalizeBroadcast(base,channelId).status,"scheduled");
  assert.equal(normalizeBroadcast({...base,snippet:{...base.snippet,liveBroadcastContent:"live"},liveStreamingDetails:{actualStartTime:"2026-10-20T09:04:00Z"}},channelId).status,"live");
  assert.equal(normalizeBroadcast({...base,liveStreamingDetails:{actualStartTime:"2026-10-20T09:04:00Z",actualEndTime:"2026-10-20T10:04:00Z"}},channelId).status,"ended");
  assert.equal(normalizeBroadcast(base,"UC"+"b".repeat(22)),null);
  assert.equal(normalizeBroadcast({...base,liveStreamingDetails:undefined},channelId),null);
});

test("approval-gated EKKO discovery, live sync, branded assets, and WebSub signature", async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ekko-channel-"));
  let mode="upcoming",searchCalls=0,videoCalls=0;
  const fakeYoutube=async(url)=>{
    const target=new URL(String(url));
    if(target.hostname==="pubsubhubbub.appspot.com")return {ok:true,status:202};
    if(target.pathname.endsWith("/channels"))return {ok:true,json:async()=>({items:[{id:channelId,snippet:{title:"My Church on YouTube",customUrl:"@mychurch",thumbnails:{high:{url:channelAvatarUrl}}}}]})};
    if(target.pathname.endsWith("/search")){
      if(target.searchParams.get("type")==="channel")return {ok:true,json:async()=>({items:[{id:{channelId}}]})};
      searchCalls++;
      return {ok:true,json:async()=>({items:target.searchParams.get("eventType")===mode ?
        [{id:{videoId}}] : []})};
    }
    if(target.pathname.endsWith("/videos")){
      videoCalls++;
      const event={
        id:videoId,
        snippet:{channelId,title:"Sunday Gathering",description:"Gather in faith",liveBroadcastContent:mode,
          thumbnails:{high:{url:"https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg"}}},
        liveStreamingDetails:mode==="upcoming"?
          {scheduledStartTime:"2026-10-20T09:00:00Z"}:mode==="live"?
          {scheduledStartTime:"2026-10-20T09:00:00Z",actualStartTime:"2026-10-20T09:04:00Z"}:
          {scheduledStartTime:"2026-10-20T09:00:00Z",actualStartTime:"2026-10-20T09:04:00Z",actualEndTime:"2026-10-20T10:05:00Z"}
      };
      return {ok:true,json:async()=>({items:target.searchParams.get("id").split(",").includes(videoId)?[event]:[]})};
    }
    throw new Error("Unexpected mocked request: "+url);
  };
  const dataFile=join(dir,"event.json");
  const app=createApp({dataFile,adminPassword:"correct-horse-battery",
    sessionSecret,secureCookies:false,youtubeApiKey:"test-key",
    youtubeFetch:fakeYoutube,publicOrigin:"https://ekko.rw"});
  app.listen(0,"127.0.0.1");
  await once(app,"listening");
  const base="http://127.0.0.1:"+app.address().port;
  async function req(path,method="GET",data,headers={}){
    return fetch(base+path,{method,headers:{...json,...headers},
      ...(data===undefined?{}:{body:JSON.stringify(data)})});
  }
  try{
    let r=await req("/api/event");
    assert.equal((await r.json()).event,null);
    r=await req("/api/admin/dashboard");
    assert.equal(r.status,401);
    r=await req("/api/admin/channel","PUT",{churchName:"My Church",channelId});
    assert.equal(r.status,401);
    r=await req("/api/admin/login","POST",{password:"wrong"});
    assert.equal(r.status,401);
    r=await req("/api/admin/login","POST",{password:"correct-horse-battery"});
    assert.equal(r.status,200);
    const cookie=r.headers.get("set-cookie").split(";")[0];
    const headers={Cookie:cookie};
    r=await req("/api/admin/channel","PUT",{churchName:"My Church",channelId},headers);
    assert.equal(r.status,200);
    await app.syncYouTube({forceDiscovery:true});
    r=await req("/api/admin/dashboard","GET",undefined,headers);
    const dashboard=await r.json();
    assert.equal(dashboard.channelId,channelId);
    assert.equal(dashboard.churchName,"My Church on YouTube");
    assert.equal(dashboard.channelHandle,"@mychurch");
    assert.equal(dashboard.channelAvatarUrl,channelAvatarUrl);
    assert.ok(dashboard.candidates.some(x=>x.youtubeVideoId===videoId));
    assert.equal(dashboard.approvedVideoId,null);
    assert.equal(searchCalls,2);
    // Discovered items remain PRIVATE until the church administrator approves them.
    r=await req("/api/event");
    assert.equal((await r.json()).event,null);
    r=await req("/api/admin/approve","POST",{videoId:"xxxxxxxxxxx"},headers);
    assert.equal(r.status,404);
    r=await req("/api/admin/approve","POST",{videoId},headers);
    assert.equal(r.status,200);
    r=await req("/api/event");
    const scheduledEvent=(await r.json()).event;
    assert.equal(scheduledEvent.status,"scheduled");
    assert.equal(scheduledEvent.channelAvatarUrl,channelAvatarUrl);
    mode="live";
    await app.syncYouTube();
    r=await req("/api/event");
    const liveEvent=(await r.json()).event;
    assert.equal(liveEvent.status,"live");
    assert.equal(liveEvent.channelAvatarUrl,channelAvatarUrl);
    assert.ok(videoCalls>=2);
    mode="none";
    await app.syncYouTube();
    r=await req("/api/event");
    assert.equal((await r.json()).event.status,"ended");
    // Manual overrides only affect an ALREADY approved event.
    r=await req("/api/admin/status","PUT",{status:"live"},headers);
    assert.equal(r.status,200);
    r=await req("/api/event");
    assert.equal((await r.json()).event.status,"live");
    r=await req("/api/admin/status","PUT",{status:"auto"},headers);
    assert.equal(r.status,200);
    r=await req("/api/event");
    assert.equal((await r.json()).event.status,"ended");
    // Subscription validation and signature validation, both channel-scoped.
    const topic="https://www.youtube.com/xml/feeds/videos.xml?channel_id="+channelId;
    r=await req("/api/webhooks/youtube?hub.mode=subscribe&hub.topic="+encodeURIComponent(topic)+"&hub.challenge=abc123");
    assert.equal(await r.text(),"abc123");
    const xml='<feed><entry><yt:videoId>'+videoId+'</yt:videoId><yt:channelId>'+channelId+'</yt:channelId></entry></feed>';
    assert.equal(parseVideoNotifications(xml)[0].videoId,videoId);
    r=await fetch(base+"/api/webhooks/youtube",{method:"POST",body:xml});
    assert.equal(r.status,403);
    const signingSecret=createHash("sha256").update(sessionSecret+":"+channelId).digest("hex");
    const sig="sha256="+createHmac("sha256",signingSecret).update(xml).digest("hex");
    assert.equal(validWebSubSignature(signingSecret,Buffer.from(xml),sig),true);
    r=await fetch(base+"/api/webhooks/youtube",{method:"POST",body:xml,headers:{"X-Hub-Signature-256":sig}});
    assert.equal(r.status,204);
    // Approved upcoming/live content appears in share metadata for link previews.
    // Both event title and church name are included.
    r=await req("/api/admin/status","PUT",{status:"live"},headers);
    assert.equal(r.status,200);
    r=await req("/");
    let shareHtml=await r.text();
    assert.match(shareHtml,/Sunday Gathering — My Church on YouTube \| EKKO/);
    assert.match(shareHtml,/Live now\. Join on EKKO/);
    r=await req("/api/admin/status","PUT",{status:"scheduled"},headers);
    r=await req("/");
    shareHtml=await r.text();
    assert.match(shareHtml,/Starts: .*UTC\. Join on EKKO/);
    r=await req("/api/admin/status","PUT",{status:"ended"},headers);
    r=await req("/");
    shareHtml=await r.text();
    assert.match(shareHtml,/EKKO — Faith Through Hearing\./);
    assert.doesNotMatch(shareHtml,/Sunday Gathering — My Church on YouTube \| EKKO/);
    r=await req("/api/admin/withdraw","POST",{},headers);
    assert.equal(r.status,200);
    r=await req("/api/event");
    assert.equal((await r.json()).event,null);
    assert.equal((await readFile(dataFile,"utf8")).includes(channelId),true);

    r=await req("/");
    const html=await r.text();
    assert.equal(r.status,200);
    assert.match(html,/Faith Through Hearing/);
    assert.match(html,/https:\/\/ekko\.rw\/assets\/social-card\.png/);
    assert.match(html,/rel="canonical" href="https:\/\/ekko\.rw\/"/);
    assert.match(html,/poster-stage/);
    assert.match(html,/id="share-button"/);
    assert.match(html,/id="status-signal"/);
    assert.match(html,/id="church-avatar-image"/);
    assert.doesNotMatch(html,/ON AIR|LIVE NOW|LIVE MOMENTS, SHARED TOGETHER/);
    for(const id of ["share-whatsapp","share-x","share-facebook","share-copy"])assert.match(html,new RegExp(`id="${id}"`));
    assert.match(html,/aria-haspopup="menu"/);
    assert.doesNotMatch(html,/id="youtube-link"|Watch on YouTube|Share event<\/button>/);
    assert.doesNotMatch(html,/id="dock-share"/);
    assert.match(html,/EKKO — Faith Through Hearing\./);
    r=await req("/admin");
    const adminHtml=await r.text();
    assert.match(adminHtml,/Welcome back/);
    assert.match(adminHtml,/Every gathering deserves/);
    assert.doesNotMatch(adminHtml,/Smart synchronization|Your moments\.|ONE CHURCH · ONE FEATURED EVENT · AUTO-SYNC/);
    assert.match(adminHtml,/class="channel-search-submit"/);
    assert.doesNotMatch(adminHtml,/Search <span aria-hidden="true">/);
    r=await req("/viewer.js");
    const viewerCode=await r.text();
    assert.match(viewerCode,/wa\.me\/\?text=/);
    assert.match(viewerCode,/twitter\.com\/intent\/tweet/);
    assert.match(viewerCode,/facebook\.com\/sharer\/sharer\.php/);
    assert.match(viewerCode,/navigator\.clipboard\.writeText/);
    assert.match(viewerCode,/shareMenu\.style\.top/);
    assert.match(viewerCode,/showChannelAvatar\(event\.channelAvatarUrl\)/);
    assert.match(viewerCode,/fallbackChannelAvatar/);
    r=await req("/admin.js");
    const studioCode=await r.text();
    assert.match(studioCode,/candidate-icon-button/);
    assert.match(studioCode,/aria-label/);
    for(const path of ["/styles.css","/studio.css","/viewer.js","/admin.js"]){
      r=await req(path);assert.equal(r.status,200);
    }
    for(const path of ["/assets/logo.svg","/assets/logo-light.svg","/assets/icon.svg"]){
      r=await req(path);assert.equal(r.status,200);assert.match(await r.text(),/<svg/);
    }
    for(const path of ["/assets/social-card.png","/assets/icon.png","/assets/apple-touch-icon.png"]){
      r=await req(path);assert.equal(r.status,200);
      assert.match(r.headers.get("content-type"),/image\/png/);
      const bytes=new Uint8Array(await r.arrayBuffer());
      assert.deepEqual([...bytes.slice(0,4)],[137,80,78,71]);
    }
    r=await req("/assets/site.webmanifest");
    assert.equal((await r.json()).short_name,"EKKO");
  }finally{
    await new Promise(resolve=>app.close(resolve));
    await rm(dir,{recursive:true,force:true});
  }
});

test("installable app shell, theater actions and Studio remain separate",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ekko-pwa-"));
  const app=createApp({dataFile:join(dir,"data.json")});
  app.listen(0,"127.0.0.1");
  await once(app,"listening");
  const base="http://127.0.0.1:"+app.address().port;
  try{
    let response=await fetch(base+"/");
    const page=await response.text();
    assert.match(page,/viewport-fit=cover/);
    assert.match(page,/mobile-dock/);
    assert.match(page,/theater-button/);
    assert.match(page,/theater-exit/);
    assert.match(page,/immersive[.]css/);
    assert.doesNotMatch(page,/We create one beautiful place to experience faith together|Presence is more than proximity|MORE THAN A STREAM|class="viewer-bottom"/);
    assert.match(page,/<footer class="site-footer container">© 2026 EKKO<\/footer>/);
    response=await fetch(base+"/styles.css");
    assert.equal(response.status,200);
    const viewerCss=await response.text();
    assert.match(viewerCss,/\.site-footer\{border-top:0;/);
    response=await fetch(base+"/viewer.js");
    const viewer=await response.text();
    assert.match(viewer,/requestFullscreen/);
    assert.match(viewer,/lastPlayerId/);
    assert.match(viewer,/closeShareMenu\(\);\s*theaterReturnFocus=/);
    assert.match(viewer,/beforeinstallprompt/);
    assert.match(viewer,/serviceWorker\.register/);
    response=await fetch(base+"/immersive.css");
    assert.equal(response.status,200);
    const immersiveCss=await response.text();
    assert.match(immersiveCss,/cinema-mode/);
    // Theater displays a single caption, never the compact event/action bar.
    assert.match(immersiveCss,/\.viewer-body\.cinema-mode \.broadcast-bar\{display:none!important\}/);
    // Guard against the blank side gutters and mobile player stretching.
    assert.match(immersiveCss,/not\(\.cinema-mode\) \.experience-frame/);
    assert.match(immersiveCss,/not\(\.cinema-mode\) \.video-stage/);
    assert.match(immersiveCss,/max-height:none/);
    assert.match(immersiveCss,/aspect-ratio:16\/9/);
    response=await fetch(base+"/sw.js");
    assert.equal(response.status,200);
    const worker=await response.text();
    assert.match(worker,/ekko-public-shell-v1/);
    assert.match(worker,/url\.pathname\.startsWith\("\/api\/"\)/);
    assert.match(worker,/url\.pathname\.startsWith\("\/admin"\)/);
    const manifest=await (await fetch(base+"/assets/site.webmanifest")).json();
    assert.equal(manifest.display,"standalone");
    assert.ok(manifest.icons.find(icon=>icon.sizes==="192x192"));
    assert.ok(manifest.icons.find(icon=>icon.sizes==="512x512"));
    for(const name of ["icon-192.png","icon-512.png"]){
      response=await fetch(base+"/assets/"+name);
      assert.equal(response.status,200);
      assert.match(response.headers.get("content-type"),/image\/png/);
      const b=new Uint8Array(await response.arrayBuffer());
      assert.deepEqual([...b.slice(0,4)],[137,80,78,71]);
    }
    response=await fetch(base+"/admin");
    const admin=await response.text();
    assert.match(admin,/EKKO Studio/);
    assert.doesNotMatch(admin,/\/sw\.js/);
  }finally{
    await new Promise(resolve=>app.close(resolve));
    await rm(dir,{recursive:true,force:true});
  }
});
