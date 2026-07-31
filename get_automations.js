import fs from "fs";

function getEnv() {
  const content = fs.readFileSync(".env", "utf-8");
  const env = {};
  content.split("\n").forEach(line => {
    const [k, ...v] = line.split("=");
    if (k && v.length) env[k.trim()] = v.join("=").trim().replace(/['"]/g, '');
  });
  return env;
}

const env = getEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const res = await fetch(`${supabaseUrl}/rest/v1/automations?clinic_id=eq.cf038458-457d-4c1a-9ac4-c88c3c8353a1&select=name,trigger_type,trigger_config,action_type,action_config,enabled,cooldown_hours`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  
  if (!res.ok) {
    console.error("HTTP Error", res.status, await res.text());
    return;
  }
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
