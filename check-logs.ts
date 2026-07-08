import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { config } from "https://deno.land/x/dotenv/mod.ts";
config({ export: true, path: "./supabase/.env" }); // try to load local env if present

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("PUBLIC_SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.log("No Supabase URL/Key found in env.");
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkLogs() {
  const { data, error } = await supabase
    .from("ai_usage")
    .select("created_at, operation, status, error, model")
    .eq("operation", "embed")
    .order("created_at", { ascending: false })
    .limit(5);
  
  if (error) console.error("Error:", error);
  else console.log(JSON.stringify(data, null, 2));
}

checkLogs();
