import urllib.request, json
url = "https://hrbhmqckzjxjbhpzpqeo.supabase.co/rest/v1/leads?select=id,name,phone,ai_summary,tags,custom_fields,stage_id,pipeline_stages(name)&limit=1000"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ"
}
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read())

filtered = []
for l in data:
    stage_name = l.get("pipeline_stages", {}).get("name") if l.get("pipeline_stages") else None
    if stage_name not in ["Paciente antigo", "Nutrição inativa"]:
        filtered.append({
            "name": l.get("name"),
            "stage": stage_name,
            "summary": l.get("ai_summary"),
            "tags": l.get("tags"),
            "custom_fields": l.get("custom_fields")
        })

with open("C:/Users/win/Desktop/leads_analysis.json", "w", encoding="utf-8") as f:
    json.dump(filtered, f, ensure_ascii=False, indent=2)

print(f"Exported {len(filtered)} leads out of {len(data)} total.")
