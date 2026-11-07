with open(r'E:\project\club-penguin-browser\gopenguin_bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
# Procura dojo ou 320 ou o carregamento da sala
m = re.findall(r'.{0,120}(?:/rooms/|/scenes/|/play/v2/content/global/rooms|loadRoom|changeRoom).{0,120}', text)
print('Resultados:', len(m))
for s in m[:10]:
    print('---')
    print(s)
