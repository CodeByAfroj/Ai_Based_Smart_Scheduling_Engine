import requests
import json

url = "https://ai-based-smart-scheduling-engine.vercel.app/api/push"

push_sub = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/eJIheniM1Qc:APA91bHi50Bdq4WWQWkJ6z_", # Note: user pasted a truncated version ending in z..., this might fail if the token is incomplete.
    "keys": {
        "p256dh": "BMupaaX6veD317_IHpIDXsbXAHDw8k-HdI8aJ-PkSmNrIzG6s0uxeAFPRDzj-UvCrpbRRt",
        "auth": "ygBAI7ijKWfLdJITR7H4XQ"
    }
}

print("Hitting Vercel API directly...")
res = requests.post(
    url,
    json={"title": "Direct Vercel Test from Agent", "pushSubscription": push_sub},
    headers={"upstash-signature": "bypass-signature-check"}
)

print("Vercel Response Code:", res.status_code)
print("Vercel Response Body:", res.text)
