import urllib.request
import urllib.error
import json
url = 'http://localhost:8000/api/live-locations/update/'
headers = {'Content-Type': 'application/json'}
data = json.dumps({'lat': 12.0001, 'lng': 80.0001}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as f:
        print(f.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('HTTP ERROR', e.code)
    print(e.read().decode('utf-8'))
