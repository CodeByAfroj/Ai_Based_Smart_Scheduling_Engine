import re

# Read the recovered HTML
with open('recovered_3d.html', 'r') as f:
    html_lines = f.readlines()

# Extract from <style> to just before <script>
start_idx = -1
end_idx = -1
for i, line in enumerate(html_lines):
    if "<style>" in line:
        start_idx = i
    if "<script>" in line:
        end_idx = i
        break

html_content = "".join(html_lines[start_idx:end_idx]).replace("`", "\\`")

# Inject into TaskTreeApp.jsx
with open('frontend/src/components/TaskTreeApp.jsx', 'r') as f:
    jsx = f.read()

jsx = jsx.replace('__REPLACE_ME__', html_content)

with open('frontend/src/components/TaskTreeApp.jsx', 'w') as f:
    f.write(jsx)
