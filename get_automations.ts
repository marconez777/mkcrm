import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from("automations")
    .select("name, trigger_type, trigger_config, action_type, action_config, enabled, cooldown_hours")
    .eq("clinic_id", "cf038458-457d-4c1a-9ac4-c88c3c8353a1");

  if (error) {
    console.error("DB Error:", error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

run();
