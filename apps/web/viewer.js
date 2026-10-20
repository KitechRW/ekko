const byId=id=>document.getElementById(id);
const dom=Object.fromEntries([
  "program-title","church-name","church-avatar-image","status-chip",
  "event-clock","stage-eyebrow","stage-title","stage-description","poster-stage",
  "poster-image","player-host","status-chip","status-signal","status-text",
  "countdown","count-days","count-hours","count-minutes","count-seconds"
].map(id=>[id,byId(id)]));
let previousFingerprint=null;
let lastPlayerId=null;
let currentEvent=null;
const formatDate=iso=>{
  if(!iso)return "";
  const time=new Date(iso);
  if(!Number.isFinite(time.getTime()))return "";
  const options=window.matchMedia("(max-width: 700px)").matches?
    {weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}:
    {dateStyle:"full",timeStyle:"short"};
  return new Intl.DateTimeFormat(undefined,options).format(time);
};
function updateCountdown(){
  const target=currentEvent?.status==="scheduled" ? Date.parse(currentEvent.scheduledStartAt) : NaN;
  const valid=Number.isFinite(target);
  dom.countdown.hidden=!valid;
  if(!valid)return;
  const diff=Math.max(0,target-Date.now());
  const parts=[Math.floor(diff/86400000),Math.floor(diff/3600000)%24,
    Math.floor(diff/60000)%60,Math.floor(diff/1000)%60];
  ["count-days","count-hours","count-minutes","count-seconds"].forEach((id,i)=>{
    dom[id].textContent=String(parts[i]).padStart(2,"0");
  });
  if(diff===0)dom["stage-description"].textContent="The scheduled time has arrived. Waiting for YouTube to confirm the stream is live.";
}
function image(url){
  const valid=typeof url==="string" && /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\//.test(url);
  dom["poster-image"].hidden=!valid;
  if(valid)dom["poster-image"].src=url;else dom["poster-image"].removeAttribute("src");
}
const fallbackChannelAvatar="/assets/icon.svg";
const channelAvatarHosts=new Set(["yt3.googleusercontent.com","yt3.ggpht.com","yt3.google.com"]);
function showChannelAvatar(url){
  let safeUrl="";
  if(typeof url==="string"){
    try{
      const candidate=new URL(url);
      if(candidate.protocol==="https:"&&channelAvatarHosts.has(candidate.hostname))safeUrl=candidate.href;
    }catch{}
  }
  dom["church-avatar-image"].src=safeUrl||fallbackChannelAvatar;
}
dom["church-avatar-image"].addEventListener("error",()=>{
  if(dom["church-avatar-image"].getAttribute("src")!==fallbackChannelAvatar){
    dom["church-avatar-image"].src=fallbackChannelAvatar;
  }
});
function video(id){
  if(id===lastPlayerId)return;
  const iframe=document.createElement("iframe");
  iframe.title="EKKO YouTube Live player";
  iframe.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(id)+"?playsinline=1&rel=0&autoplay=1";
  iframe.allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen=true;
  iframe.referrerPolicy="strict-origin-when-cross-origin";
  iframe.loading="eager";
  dom["player-host"].replaceChildren(iframe);
  lastPlayerId=id;
}
function render(event) {
  currentEvent=event;
  document.body.classList.toggle("has-event",Boolean(event));
  byId("cinema-title").textContent=event?.title||"Faith Through Hearing.";
  const live=event?.status==="live" && /^[A-Za-z0-9_-]{11}$/.test(event.youtubeVideoId||"");
  dom["poster-stage"].hidden=live;
  dom["player-host"].hidden=!live;
  byId("share-anchor").hidden=!event||!["scheduled","live"].includes(event.status);
  if(!event||!["scheduled","live"].includes(event.status))closeShareMenu();
  if(live)video(event.youtubeVideoId);
  else if(lastPlayerId){
    dom["player-host"].replaceChildren();lastPlayerId=null;
  }
  dom["status-chip"].classList.toggle("live",live);
  dom["status-chip"].classList.toggle("ended",event?.status==="ended");
  if(!event){
    dom["stage-eyebrow"].textContent="EKKO LIVE EXPERIENCE";
    dom["stage-title"].textContent="Every moment has a place.";
    dom["stage-description"].textContent="Your next shared live experience will appear here.";
    dom["program-title"].textContent="The next moment starts here.";
    dom["church-name"].textContent="EKKO · Faith Through Hearing.";
    showChannelAvatar(null);
    dom["status-text"].textContent="AWAITING NEXT EVENT";
    dom["status-text"].hidden=false;
    dom["status-signal"].hidden=true;
    dom["status-chip"].setAttribute("aria-label","Awaiting next broadcast");
    dom["event-clock"].textContent="";
    image(null);
    updateCountdown();
    return;
  }
  dom["program-title"].textContent=event.title;
  dom["church-name"].textContent=event.churchName||"EKKO";
  showChannelAvatar(event.channelAvatarUrl);
  dom["event-clock"].textContent=!live&&event.scheduledStartAt?formatDate(event.scheduledStartAt):"";
  dom["status-text"].textContent=live?"":event.status==="ended"?"EVENT ENDED":"UPCOMING";
  dom["status-text"].hidden=live;
  dom["status-signal"].hidden=!live;
  dom["status-chip"].setAttribute("aria-label",live?"Live broadcast":event.status==="ended"?"Broadcast ended":"Upcoming broadcast");
  if(event.status==="ended"){
    dom["stage-eyebrow"].textContent="THANK YOU FOR JOINING US";
    dom["stage-title"].textContent="Until we gather again.";
    dom["stage-description"].textContent="This live moment has ended. Stay close for the next gathering.";
  }else if(live){
    dom["stage-eyebrow"].textContent="FAITH THROUGH HEARING";
  }else{
    dom["stage-eyebrow"].textContent="COMING UP ON EKKO";
    dom["stage-title"].textContent="We gather soon.";
    dom["stage-description"].textContent=event.scheduledStartAt?
      "You're invited. The broadcast will begin here when YouTube confirms it is live.":
      "We're getting ready. Stay close for the next live moment.";
  }
  image(event.thumbnailUrl);
  updateCountdown();
}
async function refresh(){
  try{
    const res=await fetch("/api/event",{cache:"no-store"});
    if(!res.ok)throw new Error("Unavailable");
    const {event}=await res.json();
    const fingerprint=JSON.stringify(event||null);
    if(fingerprint!==previousFingerprint){previousFingerprint=fingerprint;render(event);}
  }catch{
    if(previousFingerprint===null){
      dom["status-chip"].textContent="RECONNECTING";
      dom["stage-title"].textContent="We'll be right back.";
      dom["stage-description"].textContent="The EKKO connection is temporarily unavailable.";
    }
  }
}
let toastTimer;
function notify(text){
  const toast=byId("toast");toast.textContent=text;toast.classList.add("visible");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("visible"),3500);
}
function shareContent(event, url) {
  const title=String(event?.title||"EKKO — Faith Through Hearing.").trim();
  const church=String(event?.churchName||"EKKO").trim();
  let timing="Upcoming";
  if(event?.status==="live") timing="🔴 Live now";
  else if(event?.scheduledStartAt){
    const starts=new Date(event.scheduledStartAt);
    if(Number.isFinite(starts.getTime())){
      timing="Starts: "+new Intl.DateTimeFormat(undefined,{
        weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"
      }).format(starts);
    }
  }
  const text=title+"\n"+church+"\n"+timing;
  return {title,church,timing,text,url,copied:text+"\n"+url};
}
const shareButton=byId("share-button");
const shareMenu=byId("share-menu");
// Portal the menu to the document so narrow video cards cannot clip its contents.
document.body.append(shareMenu);
function closeShareMenu(returnFocus=false){
  const wasOpen=!shareMenu.hidden;
  shareMenu.hidden=true;
  shareButton.setAttribute("aria-expanded","false");
  if(returnFocus&&wasOpen)shareButton.focus({preventScroll:true});
}
function openShareMenu(){
  if(!currentEvent||!["scheduled","live"].includes(currentEvent.status))return;
  const url=location.origin+location.pathname;
  const content=shareContent(currentEvent,url);
  byId("share-whatsapp").href="https://wa.me/?text="+encodeURIComponent(content.copied);
  byId("share-x").href="https://twitter.com/intent/tweet?text="+encodeURIComponent(content.text)+"&url="+encodeURIComponent(url);
  // Facebook Share Dialog uses the EKKO page metadata for the event and church.
  // Facebook intentionally does not support prefilling an arbitrary post message.
  byId("share-facebook").href="https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(url);
  shareMenu.hidden=false;
  shareMenu.style.visibility="hidden";
  const rect=shareButton.getBoundingClientRect(),panel=shareMenu.getBoundingClientRect();
  const gap=10,margin=10;
  const left=Math.min(Math.max(margin,rect.right-panel.width),Math.max(margin,innerWidth-panel.width-margin));
  let top=rect.top-panel.height-gap;
  if(top<margin)top=rect.bottom+gap;
  if(top+panel.height>innerHeight-margin)top=Math.max(margin,innerHeight-panel.height-margin);
  shareMenu.style.left=left+"px";
  shareMenu.style.top=top+"px";
  shareMenu.style.visibility="";
  shareButton.setAttribute("aria-expanded","true");
  byId("share-whatsapp").focus({preventScroll:true});
}
async function copyShareContent(){
  if(!currentEvent||!["scheduled","live"].includes(currentEvent.status))return;
  const message=shareContent(currentEvent,location.origin+location.pathname).copied;
  try {
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(message);
    else {
      const input=document.createElement("textarea");
      input.value=message;input.readOnly=true;
      input.style.position="fixed";input.style.opacity="0";
      document.body.append(input);input.select();
      const ok=document.execCommand("copy");
      input.remove();
      if(!ok)throw new Error("Copy unsupported");
    }
    notify("Event, church and EKKO link copied.");
  } catch {
    notify("Couldn't copy automatically. Try your browser's sharing tools.");
  } finally { closeShareMenu(true); }
}
shareButton.addEventListener("click",()=>{
  if(!shareMenu.hidden)closeShareMenu(true);else openShareMenu();
});
for(const id of ["share-whatsapp","share-x","share-facebook"]){
  byId(id).addEventListener("click",()=>closeShareMenu());
}
byId("share-copy").addEventListener("click",copyShareContent);
document.addEventListener("pointerdown",event=>{
  if(!shareMenu.hidden&&!byId("share-anchor").contains(event.target)&&!shareMenu.contains(event.target))closeShareMenu();
});
window.addEventListener("resize",()=>{if(!shareMenu.hidden)closeShareMenu();});
window.addEventListener("scroll",()=>{if(!shareMenu.hidden)closeShareMenu();},{passive:true});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&!shareMenu.hidden){
    event.preventDefault();closeShareMenu(true);
  }
});

let theater=false;
let theaterReturnFocus=null;
function setTheater(enabled) {
  if (enabled===theater) return;
  theater=enabled;
  document.body.classList.toggle("cinema-mode",enabled);
  byId("theater-exit").hidden=!enabled;
  byId("cinema-caption").hidden=!enabled;
  byId("theater-button").setAttribute("aria-pressed",String(enabled));
  byId("dock-theater").setAttribute("aria-pressed",String(enabled));
  if(enabled){
    // The share popup is portaled outside the player; close it before
    // switching to theater so it cannot float over the fullscreen stage.
    closeShareMenu();
    theaterReturnFocus=document.activeElement;
    byId("theater-exit").focus({preventScroll:true});
    // User gesture permits true browser fullscreen on supported devices; CSS
    // theater remains as a reliable fallback on iOS and restricted browsers.
    const stage=byId("video-stage");
    if(stage.requestFullscreen && !document.fullscreenElement){
      stage.requestFullscreen({navigationUI:"hide"}).catch(()=>{});
    }
  }else{
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    if(theaterReturnFocus?.isConnected)theaterReturnFocus.focus({preventScroll:true});
  }
}
document.addEventListener("fullscreenchange",()=>{
  if(theater && !document.fullscreenElement)setTheater(false);
});
byId("theater-button").addEventListener("click",()=>setTheater(!theater));
byId("dock-theater").addEventListener("click",()=>setTheater(!theater));
byId("theater-exit").addEventListener("click",()=>setTheater(false));
document.addEventListener("keydown",event=>{
  if(event.key==="Escape" && theater){setTheater(false);return;}
  if(event.key.toLowerCase()==="f" && !event.altKey && !event.ctrlKey && !event.metaKey &&
    !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName) &&
    !document.activeElement?.isContentEditable){
    event.preventDefault();setTheater(!theater);
  }
});
byId("dock-watch").addEventListener("click",event=>{
  event.preventDefault();
  if(theater)setTheater(false);
  byId("video-stage").scrollIntoView({block:"start",
    behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
});

// Installability is browser-controlled; Safari on iOS requires Share → Add to Home Screen.
let installPrompt=null;
const installButton=byId("install-button");
const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
function updateInstallUI(){
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  installButton.hidden=isStandalone()||(!installPrompt&&!isIOS);
}
window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();installPrompt=event;updateInstallUI();
});
window.addEventListener("appinstalled",()=>{installPrompt=null;updateInstallUI();});
installButton.addEventListener("click",async()=>{
  if(installPrompt){
    const prompt=installPrompt;installPrompt=null;
    await prompt.prompt();
    await prompt.userChoice;
    updateInstallUI();
  }else notify("In Safari, tap Share, then Add to Home Screen.");
});
updateInstallUI();
if("serviceWorker" in navigator && location.protocol==="https:"){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("/sw.js").catch(()=>{});
  });
}
render(null);
refresh();
setInterval(updateCountdown,1000);
setInterval(()=>{if(!document.hidden)refresh();},15000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
window.addEventListener("online",refresh);
