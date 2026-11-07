with open(r'E:\project\club-penguin-browser\gopenguin_bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'dojo', text)]
print('Ocorrencias de "dojo":', len(matches))
for pos in matches[:5]:
    start = max(0, pos - 150)
    end = min(len(text), pos + 150)
    print('-----------------------')
    print(text[start:end])
