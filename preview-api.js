/* EKKO interactive design review — simulated, entirely local data.
   No network API, authentication, livestream or actual church credentials. */
(()=>{
  "use strict";
  const KEY="ekko-pages-demo-state-v2", LOGIN="ekko-pages-studio-session";
  const videos=["DemoLiveA01","DemoLiveB02","DemoLiveC03"];
  const channelId="UC"+"E".repeat(22);
  const secondChannel="UC"+"Z".repeat(22);
  const profiles=[{channelId,title:"EKKO Demo Church",handle:"@ekkodemo",description:"Demo church channel",avatarUrl:"",url:"https://www.youtube.com/channel/"+channelId},{channelId:secondChannel,title:"Sample Worship Community",handle:"@sampleworship",description:"Another sample channel",avatarUrl:"",url:"https://www.youtube.com/channel/"+secondChannel}];
  const isoFromNow=hours=>new Date(Date.now()+hours*3600000).toISOString();
  const candidate=(i,title,status,when)=>({
    id:"featured",channelId,youtubeVideoId:videos[i],youtubeUrl:"https://www.youtube.com/",
    title,description:"A shared moment of faith, prayer and worship. Join us together wherever you are.",
    churchName:"EKKO Demo Church",thumbnailUrl:"",status,
    scheduledStartAt:when,updatedAt:new Date().toISOString()
  });
  const fresh=()=> {
    const a=candidate(0,"Sunday Worship Celebration","scheduled",isoFromNow(2));
    const b=candidate(1,"Evening of Prayer","scheduled",isoFromNow(52));
    const c=candidate(2,"Last Sunday's Gathering","ended",isoFromNow(-160));
    return {churchName:"EKKO Demo Church",channelId,channelHandle:"@ekkodemo",channelAvatarUrl:"",approvedVideoId:videos[0],event:a,candidates:[a,b,c],
      apiConfigured:true,lastDiscoveryAt:new Date().toISOString(),overrideStatus:null};
  };
  function load(){
    try{
      const value=JSON.parse(localStorage.getItem(KEY));
      if(value && Array.isArray(value.candidates)) return value;
    }catch{}
    const s=fresh();localStorage.setItem(KEY,JSON.stringify(s));return s;
  }
  function save(s) {
    localStorage.setItem(KEY,JSON.stringify(s));
    window.dispatchEvent(new Event("ekko-preview-update"));
  }
  const active=()=>load();
  const approveCandidate=(s,id)=>{
    const found=s.candidates.find(v=>v.youtubeVideoId===id);
    if(!found)return false;
    s.approvedVideoId=id;
    s.overrideStatus=null;
    s.event={...found,updatedAt:new Date().toISOString()};
    save(s);
    return true;
  };
  const publicEvent=s=>s.event&&s.event.youtubeVideoId===s.approvedVideoId?
    {...s.event,status:s.overrideStatus||s.event.status}:null;
  const response=(body,status=200)=>new Response(JSON.stringify(body),{
    status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  });
  const originalFetch=window.fetch.bind(window);
  window.fetch=async (input,options={})=>{
    const path=typeof input==="string"?input:input.url;
    if(!/^\/api\//.test(path))return originalFetch(input,options);
    const s=load();
    const method=(options.method||"GET").toUpperCase();
    let data={};
    try{data=options.body?JSON.parse(options.body):{};}catch{}
    const auth=sessionStorage.getItem(LOGIN)==="yes";
    if(path==="/api/event"&&method==="GET")return response({event:publicEvent(s)});
    if(path==="/api/admin/session"&&method==="GET")return response({configured:true,authenticated:auth});
    if(path==="/api/admin/login"&&method==="POST"){
      sessionStorage.setItem(LOGIN,"yes");
      return response({authenticated:true});
    }
    if(path==="/api/admin/logout"&&method==="POST"){
      sessionStorage.removeItem(LOGIN);return response({authenticated:false});
    }
    if(!auth)return response({error:"Open the Studio preview to explore the dashboard."},401);
    if(path==="/api/admin/dashboard")return response({...s,event:publicEvent(s)});
    if(path.startsWith("/api/admin/channel/search?")&&method==="GET"){
      const search=new URLSearchParams(path.split("?")[1]||"").get("q")||"";
      const clean=search.toLowerCase().trim();
      if(!clean)return response({error:"Enter a channel name or @handle."},400);
      let matches=profiles.filter(p=>p.title.toLowerCase().includes(clean)||
        p.handle.toLowerCase().includes(clean)||clean===p.channelId.toLowerCase()||
        clean.endsWith("/"+p.handle.toLowerCase())||
        clean.endsWith("/"+p.channelId.toLowerCase()));
      // The demo remains explorable even when visitors type a real channel name.
      if(matches.length===0 && !clean.startsWith("@"))matches=profiles;
      return response({channels:matches,queryType:clean.startsWith("@")?"handle":"name"});
    }
    if(path==="/api/admin/channel"&&method==="PUT"){
      const selected=profiles.find(p=>p.channelId===data.channelId);
      if(!selected)return response({error:"Choose a sample YouTube channel from search results."},404);
      if(selected.channelId!==s.channelId){
        save({churchName:selected.title,channelId:selected.channelId,channelHandle:selected.handle,
          channelAvatarUrl:selected.avatarUrl,approvedVideoId:null,event:null,candidates:[],
          apiConfigured:true,lastDiscoveryAt:null,overrideStatus:null});
      }else{
        s.churchName=selected.title;s.channelHandle=selected.handle;
        s.channelAvatarUrl=selected.avatarUrl;
        if(s.event)s.event.churchName=selected.title;save(s);
      }
      return response({ok:true,channel:selected});
    }
    if(path==="/api/admin/scan"&&method==="POST"){
      s.lastDiscoveryAt=new Date().toISOString();
      if(s.channelId&&!s.candidates.length){
        const d=candidate(0,"Newly scheduled demo event","scheduled",isoFromNow(3));
        d.channelId=s.channelId;d.churchName=s.churchName;
        s.candidates=[d];
      }else if(s.candidates.length===3){
        const d=candidate(1,"Wednesday Prayer Gathering","scheduled",isoFromNow(80));
        d.youtubeVideoId="DemoLiveD04";s.candidates.push(d);
      }
      save(s);return response({candidates:s.candidates.length,discovered:1});
    }
    if(path==="/api/admin/approve"&&method==="POST"){
      if(!approveCandidate(s,data.videoId))return response({error:"No sample broadcast matches this selection."},404);
      return response({event:publicEvent(s)});
    }
    if(path==="/api/admin/withdraw"&&method==="POST"){
      s.approvedVideoId=null;s.event=null;s.overrideStatus=null;save(s);return response({ok:true});
    }
    if(path==="/api/admin/status"&&method==="PUT"){
      if(!s.event)return response({error:"Approve a sample event first."},409);
      s.overrideStatus=data.status==="auto"?null:data.status;
      s.event.updatedAt=new Date().toISOString();save(s);return response({event:publicEvent(s)});
    }
    return response({error:"Unknown demo request."},404);
  };
  function state(mode){
    if(!["scheduled","live","ended"].includes(mode))return;
    const s=load();
    if(!s.approvedVideoId||!s.event){
      const video=s.candidates[0];
      if(video)approveCandidate(s,video.youtubeVideoId);
    }
    const d=load();if(!d.event)return;
    const actual=mode==="live"?isoFromNow(-.4):null;
    d.event={...d.event,status:mode,
      actualStartAt:actual,actualEndAt:mode==="ended"?new Date().toISOString():null,
      updatedAt:new Date().toISOString()};
    d.overrideStatus=null;
    d.candidates=d.candidates.map(v=>v.youtubeVideoId===d.approvedVideoId?{...d.event}:v);
    save(d);
  }
  function updateControls(){
    const s=load();
    const current=publicEvent(s)?.status||"scheduled";
    document.querySelectorAll("[data-preview-state]").forEach(button=>{
      button.setAttribute("aria-pressed",String(button.dataset.previewState===current));
    });
  }
  document.addEventListener("DOMContentLoaded",()=>{
    load();updateControls();
    document.querySelectorAll("[data-preview-state]").forEach(button=>{
      button.addEventListener("click",()=>{state(button.dataset.previewState);updateControls();});
    });
    window.addEventListener("storage",updateControls);
    window.addEventListener("ekko-preview-update",updateControls);
  });
})();
