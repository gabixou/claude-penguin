// colors.js — mapeamento de colorItemId (items.json type 1) para RGB
// Usado para renderizar a cor do pinguim de forma escalável.
// Tons = player_colors.json do WAND (config original do Club Penguin) —
// confere 1:1 com a tabela ge[] do bundle do gopenguin.lol para ids 1-15.

export const COLOR_ITEM_TO_RGB = {
    1: 0x003366,   // Blue
    2: 0x009900,   // Green
    3: 0xff3399,   // Pink
    4: 0x333333,   // Black
    5: 0xcc0000,   // Red
    6: 0xff6600,   // Orange
    7: 0xffcc00,   // Yellow
    8: 0x660099,   // Dark Purple
    9: 0x996600,   // Brown
    10: 0xff6666,  // Peach
    11: 0x006600,  // Dark Green
    12: 0x0099cc,  // Light Blue
    13: 0x8ae302,  // Lime Green
    14: 0x93a0a4,  // Sensei Gray
    15: 0x02a797,  // Aqua
    16: 0xf0f0d8,  // Arctic White (player_colors.json)
    17: 0xc378d0,  // Dot Lavender (player_colors.json)
};

// Cores para exibição no wardrobe (com nome e custo)
export const PENGUIN_COLORS = [
    { id: 1, name: 'Blue', color: 0x003366, cost: 20 },
    { id: 2, name: 'Green', color: 0x009900, cost: 20 },
    { id: 3, name: 'Pink', color: 0xff3399, cost: 20 },
    { id: 4, name: 'Black', color: 0x333333, cost: 20 },
    { id: 5, name: 'Red', color: 0xcc0000, cost: 20 },
    { id: 6, name: 'Orange', color: 0xff6600, cost: 20 },
    { id: 7, name: 'Yellow', color: 0xffcc00, cost: 20 },
    { id: 8, name: 'Dark Purple', color: 0x660099, cost: 20 },
    { id: 9, name: 'Brown', color: 0x996600, cost: 20 },
    { id: 10, name: 'Peach', color: 0xff6666, cost: 20 },
    { id: 11, name: 'Dark Green', color: 0x006600, cost: 20 },
    { id: 12, name: 'Light Blue', color: 0x0099cc, cost: 20 },
    { id: 13, name: 'Lime Green', color: 0x8ae302, cost: 20 },
    { id: 14, name: 'Sensei Gray', color: 0x93a0a4, cost: 0 },
    { id: 15, name: 'Aqua', color: 0x02a797, cost: 20 },
    { id: 16, name: 'Arctic White', color: 0xf0f0d8, cost: 20 },
    { id: 17, name: 'Dot Lavender', color: 0xc378d0, cost: 0 },
];

// Cor padrão para novos jogadores
export const DEFAULT_COLOR_ITEM_ID = 1; // Blue
export const DEFAULT_COLOR_RGB = COLOR_ITEM_TO_RGB[DEFAULT_COLOR_ITEM_ID];

// Helper para converter colorItemId para RGB
export function colorItemToRgb(itemId) {
    return COLOR_ITEM_TO_RGB[itemId] || DEFAULT_COLOR_RGB;
}

// Helper para obter informações da cor por itemId
export function getColorInfo(itemId) {
    return PENGUIN_COLORS.find(c => c.id === itemId) || null;
}
