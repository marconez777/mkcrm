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
  const waRedirect = `${SUPABASE_URL}/functions/v1/wa-redirect`;
  return `
(function(){
  var PROJECT_ID=${JSON.stringify(projectId)};
  var ENDPOINT=${JSON.stringify(endpoint)};
  var CONFIG_ENDPOINT=${JSON.stringify(configEndpoint)};
  var WA_REDIRECT=${JSON.stringify(waRedirect)};
  var COOKIE="_mk_vid";
  var STORAGE_VID="_mk_vid";
  var STORAGE_SID="_mk_sid";
  var STORAGE_SID_EXP="_mk_sid_exp";
  var STORAGE_SID_SIG="_mk_sid_sig";
  var DEFAULT_SESSION_MIN=30;
  var ALLOWED_QS=["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid","gbraid","wbraid","fbclid","ttclid","msclkid","li_fat_id"];
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
  function getCampaignSignature(){
    try{
      var p=new URL(window.location.href).searchParams;
      return [p.get("gclid")||"",p.get("gbraid")||"",p.get("wbraid")||"",p.get("fbclid")||"",p.get("ttclid")||"",p.get("msclkid")||"",p.get("li_fat_id")||"",p.get("utm_source")||"",p.get("utm_campaign")||""].join("|");
    }catch(e){return"";}
  }
  function getSid(){
    var now=Date.now();
    var timeout=((cfg&&cfg.session_timeout_minutes)||DEFAULT_SESSION_MIN)*60*1000;
    var s=null,exp=0,lastSig="";
    try{s=sessionStorage.getItem(STORAGE_SID);exp=parseInt(sessionStorage.getItem(STORAGE_SID_EXP)||"0",10);lastSig=sessionStorage.getItem(STORAGE_SID_SIG)||"";}catch(e){}
    var nowSig=getCampaignSignature();
    var hasCampaignSignal=nowSig&&nowSig.replace(/\|/g,"").length>0;
    var campaignChanged=hasCampaignSignal&&lastSig&&nowSig!==lastSig;
    var expired=!s||!exp||now>exp;
    if(expired||campaignChanged){s="s_"+uuid().replace(/-/g,"").slice(0,24);}
    try{
      sessionStorage.setItem(STORAGE_SID,s);
      sessionStorage.setItem(STORAGE_SID_EXP,String(now+timeout));
      if(hasCampaignSignal)sessionStorage.setItem(STORAGE_SID_SIG,nowSig);
    }catch(e){}
    return s;
  }
  function qs(u){
    var p={};
    try{
      var s=(u||window.location.search).split("?").pop().split("#")[0].replace(/^\\?/,"");
      if(!s)return p;
      s.split("&").forEach(function(kv){
        var i=kv.indexOf("=");
        if(i<0)return;
        p[decodeURIComponent(kv.slice(0,i))]=decodeURIComponent(kv.slice(i+1));
      });
    }catch(e){}
    return p;
  }
  function sanitizeUrl(raw){
    if(!raw)return null;
    try{
      var u=new URL(raw, window.location.href);
      var keep=[];
      ALLOWED_QS.forEach(function(k){
        var v=u.searchParams.get(k);
        if(v!=null)keep.push(encodeURIComponent(k)+"="+encodeURIComponent(v));
      });
      var out=u.origin+u.pathname;
      if(keep.length)out+="?"+keep.join("&");
      return out;
    }catch(e){return null;}
  }
  function sanitizeText(s,max){
    if(s==null)return null;
    try{
      var t=String(s).replace(/\\s+/g," ").trim();
      if(!t)return null;
      return t.length>max?t.slice(0,max):t;
    }catch(e){return null;}
  }
  function readCookie(name){
    try{
      var m=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/[.$?*|{}()\\[\\]\\\\+]/g,'\\\\$&')+'=([^;]*)'));
      return m?decodeURIComponent(m[1]):null;
    }catch(e){return null;}
  }
  function collectAllParams(u){
    try{
      var out={};
      u.searchParams.forEach(function(value,key){
        if(key.length>64||value.length>512)return;
        out[key]=value;
      });
      return Object.keys(out).length?out:null;
    }catch(e){return null;}
  }
  function send(payload){
    try{
      var body=JSON.stringify(payload);
      if(navigator.sendBeacon){
        try{
          var blob=new Blob([body],{type:"text/plain;charset=UTF-8"});
          if(navigator.sendBeacon(ENDPOINT,blob))return;
        }catch(e){}
      }
      fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:body,keepalive:true,credentials:"omit"}).catch(function(){});
    }catch(e){}
  }
  function baseEvent(name,extra){
    var p=qs();
    var urlObj;
    try{urlObj=new URL(window.location.href);}catch(e){urlObj=null;}
    var fbclid=p.fbclid||null;
    var fbp=readCookie("_fbp");
    var fbc=readCookie("_fbc");
    if(fbclid&&!fbc){fbc="fb.1."+Date.now()+"."+fbclid;}
    var ttclid=p.ttclid||null;
    var li_fat_id=p.li_fat_id||null;
    var ev={
      project_id:PROJECT_ID,
      visitor_id:getVid(),
      session_id:getSid(),
      event_id:"e_"+uuid().replace(/-/g,"").slice(0,24),
      event_name:name,
      event_type:name==="page_view"?"page_view":(name==="session_start"?"session_start":"custom"),
      event_time:new Date().toISOString(),
      page_url:sanitizeUrl(window.location.href),
      page_path:window.location.pathname,
      page_title:document.title||null,
      referrer:sanitizeUrl(document.referrer||null),
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
      fbp:fbp,
      fbc:fbc,
      ttclid:ttclid,
      li_fat_id:li_fat_id,
      raw_querystring:window.location.search||null,
      raw_referrer:document.referrer||null,
      raw_params:urlObj?collectAllParams(urlObj):null,
      properties:extra||{}
    };
    return ev;
  }
  function track(name,props){try{send(baseEvent(name,props||{}));}catch(e){}}

  // ---- SPA route tracking ----
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

  // ---- Click auto-capture (data-track-event + WhatsApp) ----
  var WA_RE=/^(https?:)?\\/\\/(wa\\.me|api\\.whatsapp\\.com|web\\.whatsapp\\.com)\\//i;
  function isWhatsAppHref(h){if(!h)return false;return WA_RE.test(h)||/^whatsapp:/i.test(h);}
  function closestWithAttr(el,attr){while(el&&el.nodeType===1){if(el.hasAttribute&&el.hasAttribute(attr))return el;el=el.parentElement;}return null;}
  function closestTag(el,tag){while(el&&el.nodeType===1){if(el.tagName&&el.tagName.toLowerCase()===tag)return el;el=el.parentElement;}return null;}

  document.addEventListener("click",function(e){
    try{
      var target=e.target;
      if(!target||target.nodeType!==1)return;
      var tracked=closestWithAttr(target,"data-track-event");
      var anchor=closestTag(target,"a");
      var href=anchor&&anchor.getAttribute("href")||null;
      var isWa=isWhatsAppHref(href);

      if(tracked){
        var name=tracked.getAttribute("data-track-event");
        var props={
          label:sanitizeText(tracked.getAttribute("data-track-label"),120),
          location:sanitizeText(tracked.getAttribute("data-track-location"),120),
          element_text:sanitizeText(tracked.innerText||tracked.textContent,120),
          element_href:sanitizeUrl(href),
          element_tag:(tracked.tagName||"").toLowerCase()
        };
        track(name,props);
        // if it was also a WA link but the explicit event isn't whatsapp_click, also fire whatsapp_click
        if(isWa&&name!=="whatsapp_click"){
          track("whatsapp_click",{
            href:sanitizeUrl(href),
            button_text:sanitizeText(anchor.innerText||anchor.textContent,120),
            page_path:window.location.pathname,
            page_title:document.title||null,
            location:props.location
          });
        }
        return;
      }
      if(isWa&&anchor){
        track("whatsapp_click",{
          href:sanitizeUrl(href),
          button_text:sanitizeText(anchor.innerText||anchor.textContent,120),
          page_path:window.location.pathname,
          page_title:document.title||null,
          location:sanitizeText(anchor.getAttribute("data-track-location"),120)
        });
      }
    }catch(err){}
  },true);

  // ---- Proactive WhatsApp link rewrite ----
  function extractWaPhone(href){
    try{
      var u=new URL(href, window.location.href);
      if(/wa\\.me$/i.test(u.hostname)){
        return (u.pathname||"").replace(/^\\//,"").split("/")[0].replace(/\\D/g,"");
      }
      if(/(api|web)\\.whatsapp\\.com$/i.test(u.hostname)){
        return (u.searchParams.get("phone")||"").replace(/\\D/g,"");
      }
    }catch(_){}
    return "";
  }
  function rewriteWaAnchor(a){
    try{
      if(!a||a.getAttribute("data-mk-rewritten"))return;
      var href=a.getAttribute("href")||"";
      if(!isWhatsAppHref(href))return;
      var phone=extractWaPhone(href);
      if(!phone)return;
      var existingMsg="";
      try{ existingMsg=new URL(href, window.location.href).searchParams.get("text")||""; }catch(_){}
      var qs2=[
        "p="+encodeURIComponent(PROJECT_ID),
        "v="+encodeURIComponent(getVid()),
        "s="+encodeURIComponent(getSid()),
        "to="+encodeURIComponent(phone)
      ];
      if(existingMsg)qs2.push("msg="+encodeURIComponent(existingMsg));
      a.setAttribute("data-mk-original-href",href);
      a.setAttribute("href", WA_REDIRECT+"?"+qs2.join("&"));
      a.setAttribute("data-mk-rewritten","1");
      a.setAttribute("rel","noopener noreferrer");
    }catch(_){}
  }
  function scanWaLinks(root){
    try{
      var nodes=(root||document).querySelectorAll&&(root||document).querySelectorAll("a[href]");
      if(!nodes)return;
      for(var i=0;i<nodes.length;i++)rewriteWaAnchor(nodes[i]);
    }catch(_){}
  }
  if(document.readyState!=="loading")scanWaLinks(document);
  else document.addEventListener("DOMContentLoaded",function(){scanWaLinks(document);});
  try{
    var mo=new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var m=muts[i];
        if(m.type==="childList"){
          m.addedNodes.forEach(function(n){
            if(n.nodeType!==1)return;
            if(n.tagName==="A")rewriteWaAnchor(n);
            else scanWaLinks(n);
          });
        } else if(m.type==="attributes"&&m.target&&m.target.tagName==="A"&&m.attributeName==="href"){
          m.target.removeAttribute("data-mk-rewritten");
          rewriteWaAnchor(m.target);
        }
      }
    });
    mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["href"]});
  }catch(_){}

  // ---- Form auto-capture ----
  var startedForms=new WeakSet();
  function formProps(form){
    return {
      form_id:form.getAttribute("id")||null,
      form_name:form.getAttribute("name")||null,
      form_action:sanitizeUrl(form.getAttribute("action")||window.location.href),
      page_path:window.location.pathname,
      page_title:document.title||null
    };
  }
  function onFormInteract(e){
    try{
      var form=closestTag(e.target,"form");
      if(!form||startedForms.has(form))return;
      startedForms.add(form);
      track("form_start",formProps(form));
    }catch(err){}
  }
  document.addEventListener("focusin",onFormInteract,true);
  document.addEventListener("change",onFormInteract,true);

  document.addEventListener("submit",function(e){
    try{
      var form=e.target;
      if(!form||form.tagName!=="FORM")return;
      track("form_submit_attempt",formProps(form));
    }catch(err){}
  },true);

  // ---- Bootstrap ----
  function start(){track("session_start");track("page_view");}
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
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
});
