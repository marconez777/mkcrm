import urllib.request, json
url = "https://hrbhmqckzjxjbhpzpqeo.supabase.co/rest/v1/messages?status=in.(pending,failed)&order=timestamp.desc&limit=10&select=id,status,content,last_error,retry_count,bot_agent_id"
req = urllib.request.Request(url, headers={"apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ"})
try:
    with urllib.request.urlopen(req) as response:
        print(json.dumps(json.loads(response.read().decode()), indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
