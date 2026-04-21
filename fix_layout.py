import os
path = r'c:\Users\jasmi\Downloads\Quick\frontend\src\ui\pages\TimePage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

status_idx = text.find('        {/* Status Card */}')
stats_idx = text.find('        {/* Stats */}')
action_idx = text.find('        {/* Action Card */}')
logs_idx = text.find('        {/* Recent Logs */}')
end_idx = text.find('      </div>\n    </>\n  )\n}')

status_block = text[status_idx:stats_idx]
stats_block = text[stats_idx:action_idx]
action_block = text[action_idx:logs_idx]
logs_block = text[logs_idx:end_idx]

new_layout = f'''<div className="tp-content-grid">
          <div className="tp-content-main">
{status_block}{stats_block}{logs_block}          </div>
          <div className="tp-content-side">
{action_block}          </div>
        </div>
'''

new_text = text[:status_idx] + new_layout + text[end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Success!')
