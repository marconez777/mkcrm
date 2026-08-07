import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabaseUrl = "https://hrbhmqckzjxjbhpzpqeo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ";
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("ai_usage")
    .select("*")
    .eq("agent_id", "907eb5e2-cb19-4d54-a9d3-97821374cd84")
    .neq("status", "success")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error querying ai_usage:", error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

main();
