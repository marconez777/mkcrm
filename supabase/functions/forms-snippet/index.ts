// Serves the universal forms.js snippet. Public endpoint, CORS open.
const baseCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function buildScript(token: string) {
  const endpoint = `${SUPABASE_URL}/functions/v1/forms-ingest`;
  return `(function(){
  if(!window||!document)return;
  var TOKEN=${JSON.stringify(token)};
  var ENDPOINT=${JSON.stringify(endpoint)};
  function getCookie(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):null;}
  function readVid(){try{return getCookie("_mk_vid")||localStorage.getItem("_mk_vid")||null;}catch(e){return null;}}
  function readSid(){try{return sessionStorage.getItem("_mk_sid")||null;}catch(e){return null;}}
  function formKey(form){
    if(form.getAttribute("data-mk-form"))return form.getAttribute("data-mk-form");
    if(form.id)return "id:"+form.id;
    if(form.name)return "name:"+form.name;
    var action=form.getAttribute("action")||"";
    return "auto:"+(action||location.pathname).slice(0,80);
  }
  function collect(form){
    var fields={};
    var els=form.querySelectorAll("input,textarea,select");
    for(var i=0;i<els.length;i++){
      var el=els[i];
      var name=el.name||el.getAttribute("data-mk-field")||el.id;
      if(!name)continue;
      var type=(el.type||"").toLowerCase();
      if(type==="password"||type==="hidden"&&!/utm_|name|email|phone|tel|message/i.test(name))continue;
      if(type==="checkbox"||type==="radio"){if(!el.checked)continue;}
      var v=el.value;
      if(v==null||v==="")continue;
      if(fields[name]!=null)fields[name]=[].concat(fields[name],v);
      else fields[name]=v;
    }
    return fields;
  }
  function send(form){
    try{
      if(form.hasAttribute("data-mk-ignore"))return;
      var body=JSON.stringify({
        form_key:formKey(form),
        form_name:form.getAttribute("data-mk-name")||document.title||null,
        source_page:location.href,
        fields:collect(form),
        visitor_id:readVid(),
        session_id:readSid()
      });
      var url=ENDPOINT;
      var blob=new Blob([body],{type:"application/json"});
      if(navigator.sendBeacon&&navigator.sendBeacon(url+"?token="+encodeURIComponent(TOKEN),blob))return;
      fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-form-token":TOKEN},body:body,keepalive:true}).catch(function(){});
    }catch(e){}
  }
  document.addEventListener("submit",function(ev){
    var f=ev.target;
    if(!f||f.tagName!=="FORM")return;
    send(f);
  },true);
  window.MKForms={send:send};
})();`;
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: baseCors });
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return new Response("// missing token", { status: 400, headers: { ...baseCors, "Content-Type": "application/javascript" } });
  const script = buildScript(token);
  return new Response(script, {
    headers: { ...baseCors, "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
});
