const byId=id=>document.getElementById(id);
const dom=Object.fromEntries([
  "event-title","event-description","program-title","church-name","status-chip",
  "event-clock","stage-eyebrow","stage-title","stage-description","poster-stage",
  "poster-image","player-host","video-badge","youtube-link","header-status",
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
  const live=event?.status==="live" && /^[A-Za-z0-9_-]{11}$/.test(event.youtubeVideoId||"");
  dom["poster-stage"].hidden=live;
  dom["player-host"].hidden=!live;
  dom["video-badge"].hidden=!live;
  dom["youtube-link"].hidden=!event?.youtubeUrl;
  if(event?.youtubeUrl)dom["youtube-link"].href=event.youtubeUrl;
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
byId("share-button").addEventListener("click",async()=>{
  const url=location.href;
  try{
    if(navigator.share)await navigator.share({title:currentEvent?.title||"EKKO — Faith Through Hearing.",url});
    else if(navigator.clipboard){await navigator.clipboard.writeText(url);notify("Link copied. Share this moment.");}
    else notify("Share this link: "+url);
  }catch(e){if(e.name!=="AbortError")notify("Sharing wasn't available. Please try again.");}
});
render(null);
refresh();
setInterval(updateCountdown,1000);
setInterval(()=>{if(!document.hidden)refresh();},15000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
window.addEventListener("online",refresh);