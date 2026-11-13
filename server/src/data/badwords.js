// badwords.js - blacklist PT-BR + EN para filtro de chat/username.
// Escopo fase 1 do plano-moderacao: block/warn apenas, sem mute/ban.
// ATENCAO: so termos inequivocos — palavras comuns (preto, nego, sexo)
// ficam de fora para nao gerar falso positivo em chat legitimo.
export const BADWORDS = [
    // EN — profanidade/insultos
    'fuck', 'fucker', 'fucking', 'shit', 'bullshit', 'bitch', 'asshole',
    'bastard', 'dickhead', 'cunt', 'whore', 'slut', 'retard', 'retarded',
    'rape', 'rapist', 'raped', 'molest', 'molester', 'pedophile', 'pedo',
    'nazi', 'hitler', 'kys', 'kill yourself', 'kys', 'cum', 'jizz',
    'porn', 'porno', 'nude', 'nudes', 'boob', 'boobs', 'tits', 'dildo',
    'cock', 'dick', 'pussy', 'jerk off', 'jack off', 'suck my dick',
    'motherfucker', 'motherfuck', 'wtf', 'stfu', 'gtfo', 'ur mom',
    'your mom', 'ur mom', 'go die', 'i hate you',
    // EN — slurs raciais/homofobicos
    'nigger', 'nigga', 'niglet', 'faggot', 'fag', 'dyke', 'tranny',
    'kike', 'spic', 'chink', 'gook', 'wetback', 'beaner', 'raghead',
    'towelhead', 'cameljockey', 'retard', 'retarded',
    // PT-BR — profanidade/insultos
    'caralho', 'porra', 'puta', 'puto', 'putaria', 'viado', 'buceta',
    'bct', 'fdp', 'fodase', 'merda', 'arrombado', 'arrombada', 'cornho',
    'cuzao', 'cuza', 'rola', 'piroca', 'pica', 'bunda', 'xota',
    'perereca', 'safada', 'safado', 'traveco', 'piranha', 'maconheiro',
    'maconha', 'cocaina', 'heroina', 'droga', 'viciado', 'viciada',
    'estupro', 'estuprar', 'estuprador', 'estuprada', 'estuprado',
    'estuprar', 'estuprar', 'estuprar',
    'pqp', 'ctm', 'tnc', 'vsf', 'vtnc', 'foder', 'foda-se', 'foda',
    'vai se foder', 'vai tomar', 'sua mae', 'sua mãe', 'sua familia',
    'sua família', 'cuzinho', 'cuzao', 'bosta', 'bostao', 'otario',
    'otaria', 'imbecil', 'idiota', 'burro', 'burra', 'palhaco', 'palhaço',
    'capeta', 'diabo', 'satanas', 'satana', 'demônio', 'demônio',
    'cacete', 'cacetada', 'arromb', 'esporro', 'xereca', 'piru',
    'piroc', 'piroca', 'piroquinha', 'pinto', 'pintinho',
];
