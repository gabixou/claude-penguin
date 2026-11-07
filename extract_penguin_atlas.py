import re
import json

header_path = r'E:\project\gopenguin-3ds-main\source\penguin_atlas.h'
with open(header_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Formato: {302,320,37,42,-18,-30},
pattern = re.compile(r'\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\}')
matches = pattern.findall(text)

frames = []
for i, m in enumerate(matches):
    x, y, w, h, left, top = map(int, m)
    frames.append({
        'index': i,
        'frame': {'x': x, 'y': y, 'w': w, 'h': h},
        'rotated': False,
        'trimmed': True,
        'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h},
        'sourceSize': {'w': w, 'h': h},
        'offset': {'left': left, 'top': top}
    })

print(f'Total de frames extraídos de penguin_atlas.h: {len(frames)}')

# Sequências de source/animations.h:
# 1-8: Idle 8 direções
# 9-16: Walk 8 direções (8 frames cada)
# 17-24: Sit 8 direções
# 25: Dance (32 frames)
# 27: Wave / Acenar (28 frames)
# 30: Throw snowball (28 frames)

sequences = {
    'idle': {
        1: {'start': 0, 'count': 1},
        2: {'start': 1, 'count': 1},
        3: {'start': 2, 'count': 1},
        4: {'start': 3, 'count': 1},
        5: {'start': 4, 'count': 1},
        6: {'start': 5, 'count': 1},
        7: {'start': 6, 'count': 1},
        8: {'start': 7, 'count': 1}
    },
    'walk': {
        1: {'start': 8, 'count': 8},
        2: {'start': 16, 'count': 8},
        3: {'start': 24, 'count': 8},
        4: {'start': 32, 'count': 8},
        5: {'start': 40, 'count': 8},
        6: {'start': 48, 'count': 8},
        7: {'start': 56, 'count': 8},
        8: {'start': 64, 'count': 8}
    },
    'sit': {
        1: {'start': 72, 'count': 1},
        2: {'start': 73, 'count': 1},
        3: {'start': 74, 'count': 1},
        4: {'start': 75, 'count': 1},
        5: {'start': 76, 'count': 1},
        6: {'start': 77, 'count': 1},
        7: {'start': 78, 'count': 1},
        8: {'start': 79, 'count': 1}
    },
    'dance': {'start': 80, 'count': 32},
    'wave': {'start': 305, 'count': 28},
    'throw': {'start': 389, 'count': 28}
}

output_data = {
    'frames': frames,
    'sequences': sequences
}

out_file = r'E:\project\club-penguin-browser\client\public\assets\penguin-frames.json'
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, indent=2)

print(f'Salvo com sucesso em {out_file}!')
