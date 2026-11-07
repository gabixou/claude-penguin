import urllib.request, json
req = urllib.request.Request(
    'http://localhost:11434/api/generate',
    data=json.dumps({
        'model': 'qwen3.5:4b',
        'prompt': 'Write a 3-line javascript function to add two numbers.',
        'stream': False
    }).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
with urllib.request.urlopen(req, timeout=60) as r:
    data = json.loads(r.read().decode('utf-8'))
    print('RAW KEYS:', list(data.keys()))
    print('RESP LEN:', len(data.get('response', '')))
    print('RESP TEXT:\n', data.get('response', ''))
