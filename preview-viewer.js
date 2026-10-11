const byId=id=>document.getElementById(id);
const dom=Object.fromEntries([
  "event-title","event-description","program-title","church-name","status-chip",
  "event-clock","stage-eyebrow","stage-title","stage-description","poster-stage",
  "poster-image","player-host","video-badge","header-status",
  "broadcast-kicker","countdown","count-days","count-hours","count-minutes","count-seconds"
].map(id=>[id,byId(id)]));
let previousFingerprint=null;
let lastPlayerId=null;
let currentEvent=null;
const formatDate=iso=>{
  if(!iso)return "";
  const time=new Date(iso);
  return Number.isFinite(time.getTime())?new Intl.DateTimeFormat(undefined,{dateStyle:"full",timeStyle:"short"}).format(time):"";
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
function video(id){
  if(id===lastPlayerId)return;
  const pane=document.createElement("div");
  pane.className="preview-playback";
  const emblem=document.createElement("img");
  emblem.src="./apps/web/assets/icon.svg";emblem.alt="";
  const label=document.createElement("div");label.className="preview-live-visual-tag";label.textContent="SIMULATED LIVE VISUAL";
  const title=document.createElement("h2");title.textContent="You're part of the moment.";
  const subtitle=document.createElement("p");subtitle.textContent="Real YouTube playback will appear here when EKKO is deployed.";
  const center=document.createElement("div");center.className="preview-playback-center";
  center.append(emblem,label,title,subtitle);pane.append(center);
  dom["player-host"].replaceChildren(pane);
  lastPlayerId=id;
}
function render(event) {
  currentEvent=event;
  document.body.classList.toggle("has-event",Boolean(event));
  byId("cinema-title").textContent=event?.title||"Faith Through Hearing.";
  const live=event?.status==="live" && /^[A-Za-z0-9_-]{11}$/.test(event.youtubeVideoId||"");
  dom["poster-stage"].hidden=live;
  dom["player-host"].hidden=!live;
  dom["video-badge"].hidden=!live;
  byId("share-anchor").hidden=!event||!["scheduled","live"].includes(event.status);
  if(!event||!["scheduled","live"].includes(event.status))closeShareMenu();
  if(live)video(event.youtubeVideoId);
  else if(lastPlayerId){
    dom["player-host"].replaceChildren();lastPlayerId=null;
  }
  dom["header-status"].classList.toggle("onair",live);
  dom["header-status"].lastChild.textContent=live?" ON AIR":" BROADCAST HUB";
  dom["status-chip"].classList.toggle("live",live);
  dom["status-chip"].classList.toggle("ended",event?.status==="ended");
  if(!event){
    dom["event-title"].textContent="A place to experience faith together.";
    dom["event-description"].textContent="Wherever you are, you're part of the moment. Welcome to EKKO.";
    dom["broadcast-kicker"].textContent="SHARED MOMENTS. REAL CONNECTION.";
    dom["stage-eyebrow"].textContent="EKKO LIVE EXPERIENCE";
    dom["stage-title"].textContent="Every moment has a place.";
    dom["stage-description"].textContent="Your next shared live experience will appear here.";
    dom["program-title"].textContent="The next moment starts here.";
    dom["church-name"].textContent="EKKO · Faith Through Hearing.";
    dom["status-chip"].textContent="AWAITING NEXT EVENT";
    dom["event-clock"].textContent="";
    image(null);
    updateCountdown();
    return;
  }
  dom["event-title"].textContent=event.title;
  dom["event-description"].textContent=(event.description||"A shared live experience, wherever you are.")
    .replace(/\s+/g," ").slice(0,235);
  dom["broadcast-kicker"].textContent=live?"WE ARE LIVE / JOIN THE MOMENT":
    event.status==="ended"?"UNTIL WE GATHER AGAIN":"YOUR NEXT LIVE MOMENT";
  dom["program-title"].textContent=event.title;
  dom["church-name"].textContent=event.churchName||"EKKO";
  dom["event-clock"].textContent=event.scheduledStartAt?formatDate(event.scheduledStartAt):"";
  dom["status-chip"].textContent=live?"ON AIR NOW":event.status==="ended"?"EVENT ENDED":"UPCOMING EVENT";
  if(event.status==="ended"){
    dom["stage-eyebrow"].textContent="THANK YOU FOR JOINING US";
    dom["stage-title"].textContent="Until we gather again.";
    dom["stage-description"].textContent="This live moment has ended. Stay close for the next gathering.";
  }else if(live){
    dom["stage-eyebrow"].textContent="LIVE NOW";
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
  const text=title+"\n"+church;
  return {title,church,text,url,copied:text+"\n"+url};
}
const shareButton=byId("share-button");
const shareMenu=byId("share-menu");
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
  if(!shareMenu.hidden&&!byId("share-anchor").contains(event.target))closeShareMenu();
});
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
    Promise.resolve(); // Demo preview does not register a service worker.
  });
}
render(null);
refresh();
setInterval(updateCountdown,1000);
setInterval(()=>{if(!document.hidden)refresh();},15000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
window.addEventListener("online",refresh);
window.addEventListener("ekko-preview-update",refresh);
window.addEventListener("storage",refresh);
