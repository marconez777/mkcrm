import urllib.request, json

url = "https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/pipeline-classify"
headers = {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ",
    "Content-Type": "application/json"
}
data = json.dumps({"action": "tick"}).encode("utf-8")

req = urllib.request.Request(url, data=data, headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as response:
        print("Response:", response.read().decode())
except urllib.error.HTTPError as e:
    print(f"Error: {e.code} {e.reason}")
    print(e.read().decode())
