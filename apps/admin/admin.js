const get=id=>document.getElementById(id);
let current=null;
let ready=false;
let busy=false;
let channelEditing=false;
let channelSearching=false;
let channelResults=[];
let latestQuery="";
const fullDate=iso=>iso?new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(iso)):"Not scheduled";
const statusName=s=>s==="live"?"LIVE NOW":s==="ended"?"ENDED":"UPCOMING";
function feedback(msg,failed=false) {
  const target=get(ready?"admin-feedback":"login-feedback");
  target.textContent=msg;
  target.classList.toggle("error",failed);
}
async function request(url,options={}) {
  const response=await fetch(url,{cache:"no-store",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"Unable to complete request.");
  return result;
}
function thumbnail(img,url) {
  const safe=typeof url==="string" && /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\//.test(url);
  img.hidden=!safe;
  if(safe)img.src=url;else img.removeAttribute("src");
}
function statusTag(s) {
  const span=document.createElement("span");
  span.className="broadcast-tag "+(s==="live"?"live":s==="ended"?"ended":"");
  span.textContent=statusName(s);
  return span;
}
function card(item,featured) {
  const article=document.createElement("article");
  article.className="candidate-card"+(featured?" is-featured":"");
  const cover=document.createElement("div"); cover.className="candidate-cover";
  const img=document.createElement("img");img.alt="Broadcast thumbnail";thumbnail(img,item.thumbnailUrl);
  const badges=document.createElement("div");badges.className="candidate-badges";badges.append(statusTag(item.status));
  if(featured){const tag=document.createElement("span");tag.className="approved-marker";tag.textContent="ON EKKO";badges.append(tag);}
  cover.append(img,badges);
  const body=document.createElement("div");body.className="candidate-content";
  const h=document.createElement("h3");h.textContent=item.title||"Untitled event";
  const time=document.createElement("p");time.className="muted-text";
  time.textContent=item.status==="ended"?"Broadcast ended":fullDate(item.scheduledStartAt);
  const row=document.createElement("div");row.className="candidate-actions";
  const link=document.createElement("a");link.href=item.youtubeUrl;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Preview ↗";link.className="studio-outline";
  const action=document.createElement("button");action.type="button";action.className="studio-button "+(featured?"secondary":"primary");
  action.textContent=featured?"Approved ✓":"Approve for EKKO →";action.disabled=featured;
  action.addEventListener("click",()=>approve(item.youtubeVideoId));
  row.append(link,action);body.append(h,time,row);article.append(cover,body);
  return article;
}
function validChannelImage(url){
  if(typeof url!=="string")return false;
  try{
    const parsed=new URL(url);
    return parsed.protocol==="https:" &&
      ["yt3.googleusercontent.com","yt3.ggpht.com","yt3.google.com"].includes(parsed.hostname);
  }catch{return false;}
}
function channelAvatar(holder,url) {
  const img=holder.querySelector("img"),placeholder=holder.querySelector("span");
  const safe=validChannelImage(url);
  img.hidden=!safe;placeholder.hidden=safe;
  if(safe)img.src=url;else img.removeAttribute("src");
}
function updateChannelMode(){
  const connected=!!current?.channelId;
  get("channel-connected").hidden=!connected;
  get("channel-search-panel").hidden=connected&&!channelEditing;
  get("cancel-channel-change").hidden=!connected||!channelEditing;
}
function renderChannelResults(){
  const root=get("channel-search-results");
  root.replaceChildren();
  for(const channel of channelResults){
    const article=document.createElement("article");
    article.className="channel-result";
    const avatar=document.createElement("div");avatar.className="channel-avatar";
    const img=document.createElement("img");img.alt="";img.hidden=true;
    const placeholder=document.createElement("span");placeholder.textContent="▶";
    avatar.append(img,placeholder);channelAvatar(avatar,channel.avatarUrl);
    const details=document.createElement("div");details.className="channel-result-info";
    const name=document.createElement("strong");name.textContent=channel.title;
    const handle=document.createElement("small");handle.textContent=channel.handle||"YouTube channel";
    details.append(name,handle);
    const select=document.createElement("button");
    select.type="button";select.className="studio-button "+(channel.channelId===current?.channelId?"secondary":"primary");
    select.textContent=channel.channelId===current?.channelId?"Already connected":"Connect →";
    select.disabled=channel.channelId===current?.channelId||busy;
    select.addEventListener("click",()=>connectChannel(channel));
    article.append(avatar,details,select);
    root.append(article);
  }
}
function render(data) {
  const oldChannel=current?.channelId;
  current=data;
  get("channel-state").textContent=data.channelId?"CONNECTED":"NOT CONNECTED";
  get("channel-state").classList.toggle("connected",!!data.channelId);
  get("connected-name").textContent=data.churchName||"YouTube channel";
  get("connected-handle").textContent=data.channelHandle||data.channelId||"";
  channelAvatar(get("connected-avatar"),data.channelAvatarUrl);
  if(oldChannel && oldChannel!==data.channelId){
    channelEditing=false;channelResults=[];latestQuery="";
    get("channel-search").value="";
    get("channel-search-status").textContent="";
    renderChannelResults();
  }
  updateChannelMode();
  get("connection-details").textContent=data.channelId?
    "Monitoring "+(data.channelHandle||data.channelId)+". Broadcasts remain private until approved.":
    "Find your YouTube channel to start discovering broadcasts.";
  get("no-api").hidden=!!data.apiConfigured;
  get("last-check").textContent=data.lastDiscoveryAt?
    "Scanned "+new Date(data.lastDiscoveryAt).toLocaleString():"Not scanned yet";
  const event=data.event;
  get("featured-empty").hidden=!!event;
  get("featured-active").hidden=!event;
  get("featured-status").textContent=event?statusName(event.status):"NONE APPROVED";
  get("featured-status").classList.toggle("connected",event?.status==="live");
  if(event) {
    get("featured-title").textContent=event.title;
    get("featured-time").textContent=event.scheduledStartAt?"Scheduled · "+fullDate(event.scheduledStartAt):"Live event";
    get("featured-live-badge").textContent=statusName(event.status);
    get("featured-live-badge").className="broadcast-tag "+(event.status==="live"?"live":event.status==="ended"?"ended":"");
    thumbnail(get("featured-thumbnail"),event.thumbnailUrl);
  }
  get("manual-status").value=data.overrideStatus||"auto";
  const candidates=data.candidates||[];
  get("candidate-count").textContent=String(candidates.length);
  get("candidate-empty").hidden=candidates.length>0;
  const grid=get("candidate-list");
  const fingerprint=JSON.stringify([candidates.map(c=>[c.youtubeVideoId,c.status,c.title]),data.approvedVideoId]);
  if(grid.dataset.version!==fingerprint) {
    grid.replaceChildren(...candidates.map(item=>card(item,item.youtubeVideoId===data.approvedVideoId)));
    grid.dataset.version=fingerprint;
  }
}
async function loadDashboard(){
  if(busy)return;
  try{render(await request("/api/admin/dashboard"));}
  catch(e){feedback(e.message,true);}
}
async function initialize(){
  const session=await request("/api/admin/session");
  ready=session.authenticated;
  get("login-screen").hidden=ready;
  get("studio-dashboard").hidden=!ready;
  if(!session.configured)feedback("Studio access is not configured. Set EKKO_ADMIN_PASSWORD and EKKO_SESSION_SECRET on your server.",true);
  if(ready)await loadDashboard();
}
async function perform(action,success) {
  busy=true;feedback("Working...");
  try{await action();busy=false;await loadDashboard();feedback(success);}
  catch(e){busy=false;feedback(e.message,true);}
}
async function approve(videoId) {
  if(current?.event?.status==="live" && current?.approvedVideoId!==videoId &&
      !confirm("A live broadcast is already playing. Replacing it will interrupt viewers. Continue?"))return;
  await perform(()=>request("/api/admin/approve",{method:"POST",body:JSON.stringify({videoId})}),
    "Approved. This event is now visible on EKKO.");
}
get("toggle-password").addEventListener("click",()=>{
  const input=get("password"); input.type=input.type==="password"?"text":"password";
  get("toggle-password").textContent=input.type==="password"?"Show":"Hide";
});
get("login-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const button=e.submitter;button.disabled=true;
  try {
    await request("/api/admin/login",{method:"POST",body:JSON.stringify({password:get("password").value})});
    get("password").value="";
    await initialize();
  }catch(error){feedback(error.message,true);}
  finally{button.disabled=false;}
});
async function connectChannel(channel){
  if(busy)return;
  if(current?.channelId===channel.channelId){
    feedback("This YouTube channel is already connected.");
    return;
  }
  if(current?.channelId){
    const warning=current.event?.status==="live"?
      "A live broadcast is currently playing. Replacing the channel will stop it on EKKO and clear all previous video approvals. Connect "+channel.title+" instead?":
      "Replace the connected channel with "+channel.title+"? Previous discoveries and the approved broadcast will be cleared. You can still connect another channel later.";
    if(!confirm(warning))return;
  }
  await perform(()=>request("/api/admin/channel",{
    method:"PUT",body:JSON.stringify({channelId:channel.channelId})
  }),"Connected to "+channel.title+". EKKO is discovering its public live and upcoming videos.");
  if(current?.channelId===channel.channelId){
    channelEditing=false;channelResults=[];latestQuery="";
    get("channel-search").value="";
    get("channel-search-status").textContent="";
    renderChannelResults();
    updateChannelMode();
  }
}
get("change-channel").addEventListener("click",()=>{
  channelEditing=true;channelResults=[];latestQuery="";
  get("channel-search").value="";get("channel-search-status").textContent="";
  renderChannelResults();updateChannelMode();
  get("channel-search").focus();
});
get("cancel-channel-change").addEventListener("click",()=>{
  channelEditing=false;channelResults=[];latestQuery="";
  get("channel-search").value="";
  get("channel-search-status").textContent="";
  renderChannelResults();updateChannelMode();
});
get("channel-search").addEventListener("input",()=>{
  if(get("channel-search").value.trim()!==latestQuery){
    channelResults=[];renderChannelResults();
    get("channel-search-status").textContent="";
  }
});
get("channel-form").addEventListener("submit",async e=>{
  e.preventDefault();
  if(channelSearching||busy)return;
  const query=get("channel-search").value.trim();
  if(query.length<2){get("channel-search-status").textContent="Enter a channel name or @handle.";return;}
  channelSearching=true;
  const button=get("find-channel");
  button.disabled=true;button.textContent="Searching…";
  get("channel-search-status").textContent="Searching YouTube for matching channels…";
  channelResults=[];renderChannelResults();
  try{
    const result=await request("/api/admin/channel/search?q="+encodeURIComponent(query));
    if(get("channel-search").value.trim()!==query)return;
    latestQuery=query;
    channelResults=result.channels||[];
    renderChannelResults();
    get("channel-search-status").textContent=channelResults.length?
      "Select the correct channel below. Nothing is connected until you confirm.":
      "No matching public YouTube channel was found. Check the spelling or try its @handle.";
  }catch(error){get("channel-search-status").textContent=error.message;}
  finally{channelSearching=false;button.disabled=false;button.textContent="Search →";}
});
get("refresh-button").addEventListener("click",()=>perform(
  ()=>request("/api/admin/scan",{method:"POST"}),
  "YouTube discovery check completed. Recent scans may be rate-limited to protect API quota."
));
get("manual-status").addEventListener("change",()=>perform(
  ()=>request("/api/admin/status",{method:"PUT",body:JSON.stringify({status:get("manual-status").value})}),
  "Broadcast status preference saved."
));
get("withdraw-button").addEventListener("click",async()=>{
  if(!confirm("Remove the approved broadcast from the public EKKO page?"))return;
  await perform(()=>request("/api/admin/withdraw",{method:"POST"}),
    "Broadcast removed. The public page is back to its welcome experience.");
});
get("logout-button").addEventListener("click",async()=>{
  try{await request("/api/admin/logout",{method:"POST"});current=null;ready=false;await initialize();}
  catch(e){feedback(e.message,true);}
});
initialize().catch(e=>{get("login-screen").hidden=false;feedback(e.message,true);});
setInterval(()=>{if(ready && !document.hidden)loadDashboard();},15000);
document.addEventListener("visibilitychange",()=>{if(ready && !document.hidden)loadDashboard();});