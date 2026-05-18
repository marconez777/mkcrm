// Serves the first-party tracker.js. Public endpoint.
const baseCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function buildScript(projectId: string) {
  const endpoint = `${SUPABASE_URL}/functions/v1/tracking-event`;
  const configEndpoint = `${SUPABASE_URL}/functions/v1/tracking-config?project_id=${encodeURIComponent(projectId)}`;
  // Minimal pixel — page_view + SPA route changes + mkTrack() API.
  return `
(function(){
  var PROJECT_ID=${JSON.stringify(projectId)};
  var ENDPOINT=${JSON.stringify(endpoint)};
  var CONFIG_ENDPOINT=${JSON.stringify(configEndpoint)};
  var COOKIE="_mk_vid";
  var STORAGE_VID="_mk_vid";
  var STORAGE_SID="_mk_sid";
  var STORAGE_SID_EXP="_mk_sid_exp";
  var DEFAULT_SESSION_MIN=30;
  var cfg=null;

  function uuid(){
    if(crypto&&crypto.randomUUID)return crypto.randomUUID();
    return"xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c=="x"?r:(r&0x3|0x8);return v.toString(16);});
  }
  function getCookie(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):null;}
  function setCookie(n,v,days){var d=new Date();d.setTime(d.getTime()+days*864e5);document.cookie=n+"="+encodeURIComponent(v)+"; expires="+d.toUTCString()+"; path=/; SameSite=Lax";}
  function getVid(){
    var v=getCookie(COOKIE);
    if(!v){try{v=localStorage.getItem(STORAGE_VID);}catch(e){}}
    if(!v){v="v_"+uuid().replace(/-/g,"").slice(0,24);}
    setCookie(COOKIE,v,365);
    try{localStorage.setItem(STORAGE_VID,v);}catch(e){}
    return v;
  }
  function getSid(){
    var now=Date.now();
    var timeout=((cfg&&cfg.session_timeout_minutes)||DEFAULT_SESSION_MIN)*60*1000;
    var s=null,exp=0;
    try{s=sessionStorage.getItem(STORAGE_SID);exp=parseInt(sessionStorage.getItem(STORAGE_SID_EXP)||"0",10);}catch(e){}
    if(!s||!exp||now>exp){s="s_"+uuid().replace(/-/g,"").slice(0,24);}
    try{sessionStorage.setItem(STORAGE_SID,s);sessionStorage.setItem(STORAGE_SID_EXP,String(now+timeout));}catch(e){}
    return s;
  }
  function qs(){
    var p={};
    try{
      var s=window.location.search.replace(/^\\?/,"");
      if(!s)return p;
      s.split("&").forEach(function(kv){
        var i=kv.indexOf("=");
        if(i<0)return;
        p[decodeURIComponent(kv.slice(0,i))]=decodeURIComponent(kv.slice(i+1));
      });
    }catch(e){}
    return p;
  }
  function send(payload){
    try{
      var body=JSON.stringify(payload);
      if(navigator.sendBeacon){
        var blob=new Blob([body],{type:"application/json"});
        if(navigator.sendBeacon(ENDPOINT,blob))return;
      }
      fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:body,keepalive:true,credentials:"omit"}).catch(function(){});
    }catch(e){}
  }
  function baseEvent(name,extra){
    var p=qs();
    var ev={
      project_id:PROJECT_ID,
      visitor_id:getVid(),
      session_id:getSid(),
      event_id:"e_"+uuid().replace(/-/g,"").slice(0,24),
      event_name:name,
      event_type:name==="page_view"?"page_view":(name==="session_start"?"session_start":"custom"),
      event_time:new Date().toISOString(),
      page_url:window.location.href,
      page_path:window.location.pathname,
      page_title:document.title||null,
      referrer:document.referrer||null,
      utm_source:p.utm_source||null,
      utm_medium:p.utm_medium||null,
      utm_campaign:p.utm_campaign||null,
      utm_content:p.utm_content||null,
      utm_term:p.utm_term||null,
      gclid:p.gclid||null,
      gbraid:p.gbraid||null,
      wbraid:p.wbraid||null,
      fbclid:p.fbclid||null,
      msclkid:p.msclkid||null,
      user_agent:navigator.userAgent,
      language:navigator.language||null,
      timezone:(Intl&&Intl.DateTimeFormat&&Intl.DateTimeFormat().resolvedOptions().timeZone)||null,
      screen_width:window.screen&&window.screen.width||null,
      screen_height:window.screen&&window.screen.height||null,
      properties:extra||{}
    };
    return ev;
  }
  function track(name,props){send(baseEvent(name,props||{}));}

  // SPA route tracking
  var lastPath=window.location.pathname+window.location.search;
  function onRoute(){
    var p=window.location.pathname+window.location.search;
    if(p===lastPath)return;
    lastPath=p;
    track("page_view");
  }
  ["pushState","replaceState"].forEach(function(m){
    var orig=history[m];
    history[m]=function(){var r=orig.apply(this,arguments);setTimeout(onRoute,0);return r;};
  });
  window.addEventListener("popstate",onRoute);

  // Bootstrap
  function start(){
    track("session_start");
    track("page_view");
  }
  try{
    fetch(CONFIG_ENDPOINT,{credentials:"omit"}).then(function(r){return r.json();}).then(function(c){
      cfg=c||{};
      if(cfg.enabled===false)return;
      start();
    }).catch(function(){start();});
  }catch(e){start();}

  window.mkTrack=track;
})();
`.trim();
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: baseCors });
  const url = new URL(req.url);
  const projectId = url.searchParams.get("project_id") || "";
  if (!projectId) {
    return new Response("// missing project_id", {
      status: 400,
      headers: { ...baseCors, "Content-Type": "application/javascript" },
    });
  }
  return new Response(buildScript(projectId), {
    status: 200,
    headers: {
      ...baseCors,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
