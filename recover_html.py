import json

transcript_path = '/Users/afrojmulani/.gemini/antigravity-ide/brain/f8f666bc-2ce4-4b40-b724-9cb8d5a780db/.system_generated/logs/transcript_full.jsonl'

html_code = ""

with open(transcript_path, 'r') as f:
    for line in f:
        try:
            entry = json.loads(line)
            if entry.get("type") == "USER_INPUT" and "<!DOCTYPE html>" in entry.get("content", ""):
                html_code = entry["content"]
                break
        except json.JSONDecodeError:
            continue

if html_code:
    # Just save the HTML code to a temporary file in the workspace
    with open('/Users/afrojmulani/Scheduling/recovered_3d.html', 'w') as f:
        f.write(html_code)
    print("Recovered HTML to recovered_3d.html")
else:
    print("HTML not found in transcript.")
