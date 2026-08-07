import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function main() {
  console.log("Fetching recent webhook events...");
  const { data, error } = await supabase
    .from("webhook_events")
    .select("id, payload, created_at, source")
    .eq("event_type", "MESSAGES_UPSERT")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching webhooks:", error);
    return;
  }

  let unknownCount = 0;

  for (const row of data) {
    const payload = row.payload;
    const items = Array.isArray(payload?.data) ? payload.data : 
                 (Array.isArray(payload?.data?.messages) ? payload.data.messages : [payload?.data]);
    
    for (const item of items) {
      if (!item) continue;
      const fromMe = item?.key?.fromMe;
      if (fromMe) continue; // Only check inbound

      const msg = item?.message;
      if (!msg) continue;

      let coreMsg = msg;
      if (coreMsg.ephemeralMessage?.message) coreMsg = coreMsg.ephemeralMessage.message;
      if (coreMsg.viewOnceMessage?.message) coreMsg = coreMsg.viewOnceMessage.message;
      if (coreMsg.viewOnceMessageV2?.message) coreMsg = coreMsg.viewOnceMessageV2.message;
      if (coreMsg.documentWithCaptionMessage?.message) coreMsg = coreMsg.documentWithCaptionMessage.message;

      const text = coreMsg.conversation || coreMsg.extendedTextMessage?.text || coreMsg.imageMessage?.caption || coreMsg.videoMessage?.caption || coreMsg.documentMessage?.fileName;
      
      if (!text) {
        console.log("-----------------------------------------");
        console.log(`Found UNKNOWN message at ${row.created_at}`);
        console.log(JSON.stringify(item, null, 2));
        unknownCount++;
      }
    }
  }
  console.log(`Analyzed 100 events. Found ${unknownCount} unknown messages.`);
}

main();
