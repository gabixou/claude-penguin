with open(r'E:\project\club-penguin-browser\gopenguin_bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'[`\'"](/swf/[^`\'"]+)[\'"`]', text)
print('Rotas /swf/ encontradas:')
for m in list(set(matches))[:30]:
    print(' ', m)
