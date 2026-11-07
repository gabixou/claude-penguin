with open(r'E:\project\club-penguin-browser\gopenguin_bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'fetch\([`\'"]([^`\'"]+)[`\'"]\)', text)
print('Chamadas de fetch no bundle:')
for m in set(matches):
    print(' ', m)
