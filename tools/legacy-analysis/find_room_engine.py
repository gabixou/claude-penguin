with open(r'E:\project\club-penguin-browser\gopenguin_bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Procura a classe Room ou criação do canvas
import re
room_snippets = re.findall(r'.{0,100}(?:canvas id="room"|new Room|class Room|function Room|roomScript).{0,100}', text)
for s in room_snippets[:10]:
    print('---')
    print(s)
