import re

with open(r'E:\project\club-penguin-browser\gopenguin_bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

paths = re.findall(r'["\'](/[^"\']+\.(?:png|svg|json|ttf|swf|mp3|ogg))["\']', text)
print('Total de assets estáticos encontrados:', len(paths))
sample = sorted(list(set(paths)))
for p in sample[:30]:
    print(' ', p)

# Procura chamadas de rooms
room_matches = re.findall(r'(\b(?:town|dojo|coffee|dance|pizza|plaza|forts|beach|dock|lodge|mine|rink)\b)', text)
print('\nMenções a salas:', len(room_matches))

# Procura URLs completas
urls = re.findall(r'https?://[a-zA-Z0-9.-]+(?:/[^"\']*)?', text)
print('\nURLs encontradas:')
for u in set(urls):
    if 'gopenguin' in u:
        print(' ', u)
