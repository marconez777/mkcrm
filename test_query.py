import urllib.request, json
url = "https://hrbhmqckzjxjbhpzpqeo.supabase.co/rest/v1/whatsapp_instances?select=id,name,evolution_instance,connection_state,is_default,webhook_ok,last_health_check,last_inbound_webhook_at,last_auto_restart_at,last_reconnect_at,last_backfill_at,last_backfill_imported,session_stale_since,last_auto_logout_at&limit=1"
req = urllib.request.Request(url, headers={"apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ"})
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
