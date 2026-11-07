with open(r'E:\project\club-penguin-browser\gopenguin_bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
# Procura definicao de ud ou mapeamento de rooms
m = re.search(r'(\b[a-zA-Z0-9_$]+\s*=\s*\{[^}]*town[^}]*\})', text)
if m:
    print('Room mapping found:\n', m.group(1)[:500])
else:
    # Procura 'town' no bundle
    for match in re.finditer(r'town', text):
        pos = match.start()
        print('--- Contexto town: ---')
        print(text[max(0, pos-80):min(len(text), pos+80)])
        break
