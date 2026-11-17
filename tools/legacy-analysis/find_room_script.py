with open(r'E:\project\club-penguin-browser\gopenguin_bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
pos = text.find('r,l)});ds.set(i,a)')
if pos != -1:
    print('Trecho ao redor de ds.set:')
    print(text[max(0, pos-400):min(len(text), pos+400)])
