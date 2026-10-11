import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createApp } from "../src/server.mjs";
import { interpretChannelQuery, lookupYouTubeChannels } from "../src/youtube.mjs";
const a="UC"+"a".repeat(22), b="UC"+"b".repeat(22);

test("single input detects channel handles, names and URLs",async()=>{
  assert.deepEqual(interpretChannelQuery("@mychurch"),{type:"handle",value:"@mychurch"});
  assert.deepEqual(interpretChannelQuery("My Church"),{type:"name",value:"My Church"});
  assert.deepEqual(interpretChannelQuery("https://youtube.com/@mychurch"),{type:"handle",value:"@mychurch"});
  assert.equal(interpretChannelQuery("https://example.com/@mychurch"),null);
  const urls=[];
  const youtube=async input=>{
    const url=new URL(input);urls.push(url);
    if(url.pathname.endsWith("/search"))return {ok:true,json:async()=>({items:[{id:{channelId:b}}]})};
    return {ok:true,json:async()=>({items:[{id:b,snippet:{title:"My Church",customUrl:"@mychurch"}}]})};
  };
  assert.equal((await lookupYouTubeChannels(youtube,"key","@mychurch"))[0].channelId,b);
  assert.equal(urls[0].searchParams.get("forHandle"),"@mychurch");
  urls.length=0;
  assert.equal((await lookupYouTubeChannels(youtube,"key","My Church"))[0].handle,"@mychurch");
  assert.equal(urls[0].searchParams.get("q"),"My Church");
});

test("replacing channel clears previously published and approved video",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ekko-replace-"));
  const file=join(dir,"data.json"),videoId="oldVideo123";
  await writeFile(file,JSON.stringify({churchName:"Old Church",channelId:a,
    approvedVideoId:videoId,candidates:[{youtubeVideoId:videoId,channelId:a,status:"live"}],
    event:{youtubeVideoId:videoId,channelId:a,title:"Old live",status:"live"}}));
  const youtube=async input=>{
    const url=new URL(input);
    if(url.hostname==="pubsubhubbub.appspot.com")return {ok:true};
    if(url.pathname.endsWith("/channels"))return {ok:true,json:async()=>({
      items:[{id:b,snippet:{title:"New Church",customUrl:"@newchurch"}}]})};
    return {ok:true,json:async()=>({items:[]})};
  };
  const app=createApp({dataFile:file,adminPassword:"long-password-1234",
    sessionSecret:"abcdefghijklmnopqrstuvwxyz1234567890",
    youtubeApiKey:"key",youtubeFetch:youtube,secureCookies:false});
  app.listen(0,"127.0.0.1");await once(app,"listening");
  const url="http://127.0.0.1:"+app.address().port;
  try{
    const login=await fetch(url+"/api/admin/login",{method:"POST",
      headers:{"Content-Type":"application/json"},body:JSON.stringify({password:"long-password-1234"})});
    const cookie=login.headers.get("set-cookie").split(";")[0];
    const old=await (await fetch(url+"/api/event")).json();
    assert.equal(old.event.status,"live");
    const put=await fetch(url+"/api/admin/channel",{method:"PUT",
      headers:{"Content-Type":"application/json",Cookie:cookie},
      body:JSON.stringify({channelId:b})});
    assert.equal(put.status,200);
    assert.equal((await (await fetch(url+"/api/event")).json()).event,null);
    const dashboard=await (await fetch(url+"/api/admin/dashboard",{headers:{Cookie:cookie}})).json();
    assert.equal(dashboard.channelId,b);
    assert.equal(dashboard.churchName,"New Church");
    assert.equal(dashboard.channelHandle,"@newchurch");
    assert.equal(dashboard.approvedVideoId,null);
    assert.deepEqual(dashboard.candidates,[]);
  }finally{await new Promise(resolve=>app.close(resolve));await rm(dir,{recursive:true,force:true});}
});
