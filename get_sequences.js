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
  const res1 = await fetch(`${supabaseUrl}/rest/v1/message_sequences?clinic_id=eq.cf038458-457d-4c1a-9ac4-c88c3c8353a1`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  const data1 = await res1.json();
  
  const res2 = await fetch(`${supabaseUrl}/rest/v1/stage_sequence_bindings`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  const data2 = await res2.json();

  console.log("=== Message Sequences ===");
  console.log(JSON.stringify(data1, null, 2));
  console.log("=== Stage Sequence Bindings ===");
  console.log(JSON.stringify(data2, null, 2));
}

run();
