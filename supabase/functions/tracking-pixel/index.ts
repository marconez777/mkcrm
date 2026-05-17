// Serves the tracking pixel JS for a given site token.
// Use as <script src="https://.../functions/v1/tracking-pixel?t=TOKEN"></script>
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SCRIPT = (token: string, ingest: string) => `(function(){
try{
var TOKEN=${JSON.stringify(token)};
var INGEST=${JSON.stringify(ingest)};
var STORE_KEY='mk_sid';
function uuid(){return (crypto&&crypto.randomUUID)?crypto.randomUUID():('xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx').replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c=='x'?r:(r&0x3|0x8)).toString(16);});}
var sid,refShort;
function initSid(){sid=(window.lvTrack&&window.lvTrack.sessionId)||localStorage.getItem(STORE_KEY)||uuid();localStorage.setItem(STORE_KEY,sid);refShort=sid.replace(/-/g,'').slice(0,10);}
function getMeta(){var u=new URL(location.href);var p={};['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref'].forEach(function(k){var v=u.searchParams.get(k);if(v)p[k]=v;});if(document.referrer)p.referrer=document.referrer;
var saved=sessionStorage.getItem('mk_meta');if(saved){try{var s=JSON.parse(saved);Object.keys(s).forEach(function(k){if(!p[k])p[k]=s[k];});}catch(e){}}
sessionStorage.setItem('mk_meta',JSON.stringify(p));return p;}
function send(ev){try{var body=JSON.stringify({siteToken:TOKEN,sessionId:sid,meta:getMeta(),event:ev});var isNav=ev&&ev.type==='wa_click';if(isNav&&navigator.sendBeacon){try{var blob=new Blob([body],{type:'application/json'});if(navigator.sendBeacon(INGEST,blob))return;}catch(e){}}fetch(INGEST,{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true,mode:'cors',credentials:'omit'}).catch(function(err){try{console.warn('mk-pixel ingest fail',err);}catch(e){}});}catch(e){try{console.warn('mk-pixel send err',e);}catch(_){}}}
function pageview(){send({type:'pageview',url:location.href,title:document.title,referrer:document.referrer});}
function phoneFromHref(href){try{var u=new URL(href);var m=u.pathname.match(/(\\d{6,20})/);if(m)return m[1];var p=u.searchParams.get('phone');if(p)return String(p).replace(/\\D/g,'');}catch(e){}return null;}
function rewriteWa(a){try{var href=a.getAttribute('href')||'';if(!/^https?:\\/\\/(wa\\.me|api\\.whatsapp\\.com)/i.test(href))return;var url=new URL(href);var text=url.searchParams.get('text')||'';if(text.indexOf('ref=')===-1){text=(text?text+' ':'')+'(ref='+refShort+')';url.searchParams.set('text',text);a.setAttribute('href',url.toString());}}catch(e){}}
function scanLinks(){document.querySelectorAll('a[href*="wa.me"],a[href*="api.whatsapp.com"]').forEach(rewriteWa);}
function start(){
initSid();
pageview();
var lastUrl=location.href;
var origPush=history.pushState;history.pushState=function(){var r=origPush.apply(this,arguments);setTimeout(function(){if(location.href!==lastUrl){lastUrl=location.href;pageview();}},0);return r;};
window.addEventListener('popstate',function(){if(location.href!==lastUrl){lastUrl=location.href;pageview();}});
scanLinks();
var mo=new MutationObserver(function(){scanLinks();});mo.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href*="wa.me"],a[href*="api.whatsapp.com"]');if(a){var hrefV=a.getAttribute('href')||'';send({type:'wa_click',url:location.href,title:document.title,payload:{href:hrefV,phone_e164:phoneFromHref(hrefV)}});}},true);
window.mkTrack=function(name,payload){send({type:'custom',url:location.href,title:document.title,payload:Object.assign({name:name},payload||{})});};
}
var _tries=0;(function wait(){if(window.lvTrack&&window.lvTrack.sessionId)return start();if(_tries++>20)return start();setTimeout(wait,50);})();
}catch(e){console.error('mk-pixel',e);}
})();`;

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const ingest = `${url.origin}/functions/v1/tracking-ingest`;
  return new Response(SCRIPT(token, ingest), {
    headers: {
      ...cors,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});
