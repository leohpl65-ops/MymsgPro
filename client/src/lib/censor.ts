// Censoring bad words and drug-related terms
const BAD_WORDS = [
  'puto', 'mierda', 'pendejo', 'cabrón', 'jodido', 'hijoputa', 'culo', 
  'puta', 'bastardo', 'coño', 'maldito', 'estúpido', 'idiota', 'tonto',
  'pinga', 'vaca', 'verga', 'boludo', 'pelotudo', 'chamaco', 'fuck',
  'shit', 'asshole', 'bastard', 'damn', 'goddamn'
];

const DRUG_WORDS = [
  'cocaína', 'coca', 'heroína', 'marihuana', 'mota', 'hierba', 'droga',
  'porro', 'canuto', 'cigarrillo', 'faso', 'pito', 'chocolate', 'hachís',
  'lsd', 'ácido', 'éxtasis', 'mdma', 'anfetamina', 'speed', 'crack',
  'metanfetamina', 'meth', 'pastilla', 'píldora', 'ketamina', 'ghb',
  'cocaine', 'heroin', 'marijuana', 'weed', 'pot', 'hash', 'ecstasy',
  'meth', 'acid', 'lsd', 'crack', 'methamphetamine', 'droga', 'narcótico',
  'opiáceo', 'opio', 'morfina', 'tramadol', 'fentanilo'
];

const REPRODUCTIVE_WORDS = [
  'pene', 'penis', 'vagina', 'vulva', 'testículo', 'testículo', 'semen',
  'esperma', 'pezón', 'teta', 'tetas', 'mama', 'mamas', 'mama', 'mamas',
  'clítoris', 'ano', 'anus', 'próstata', 'pubis', 'pubico', 'glande',
  'prepucio', 'escroto', 'útero', 'ovarios', 'trompas'
];

const ALL_BANNED_WORDS = [...BAD_WORDS, ...DRUG_WORDS, ...REPRODUCTIVE_WORDS];

export function censorMessage(text: string): string {
  let censored = text;
  
  ALL_BANNED_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    censored = censored.replace(regex, '####');
  });
  
  return censored;
}

export function containsBannedWord(text: string): boolean {
  const reservedNames = ['owner', 'admin', 'administrador', 'root', 'system'];
  const allBanned = [...ALL_BANNED_WORDS, ...reservedNames];
  return allBanned.some(word => 
    new RegExp(`\\b${word}\\b`, 'i').test(text)
  );
}
