import re

with open('frontend/src/pages/Login.jsx', 'r') as f:
    mobile_code = f.read()

with open('old_login_tmp.jsx', 'r') as f:
    desktop_code = f.read()

# Extract logic
logic_match = re.search(r'export default function Login\(\) \{(.*?)\s*return \(', mobile_code, re.DOTALL)
logic = logic_match.group(1)

# Extract mobile JSX
mobile_jsx_match = re.search(r'return \(\s*<div className="min-h-screen bg-\[var\(--bg-app\)\] flex flex-col font-sans">(.*)\s*\);\s*\}', mobile_code, re.DOTALL)
mobile_jsx = mobile_jsx_match.group(1)
mobile_wrapper = '<div className="flex lg:hidden min-h-screen bg-[var(--bg-app)] flex-col w-full font-sans">\n' + mobile_jsx

# Extract desktop JSX
desktop_jsx_match = re.search(r'return \(\s*<div className="min-h-screen bg-\[var\(--bg-app\)\] flex">(.*)\s*\);\s*\}', desktop_code, re.DOTALL)
desktop_jsx = desktop_jsx_match.group(1)
desktop_wrapper = '<div className="hidden lg:flex min-h-screen bg-[var(--bg-app)] w-full">\n' + desktop_jsx

# Reconstruct
imports = "\n".join([line for line in mobile_code.split('\n') if line.startswith('import ')])

final_code = f"""{imports}

export default function Login() {{
{logic}
  return (
    <>
      {desktop_wrapper}
      {mobile_wrapper}
    </>
  );
}}
"""

with open('frontend/src/pages/Login.jsx', 'w') as f:
    f.write(final_code)
