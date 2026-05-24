// ─── Anagram Rush ────────────────────────────────────────────────────────────
// Each entry: { id, difficulty, word, hint }
// The word will be scrambled randomly at runtime
export const anagramQuestions = [
  // Easy (3-4 letters)
  { id: 'an1',  difficulty: 'easy',   word: 'CATS',    hint: 'Plural of feline' },
  { id: 'an2',  difficulty: 'easy',   word: 'BOOK',    hint: 'You read it' },
  { id: 'an3',  difficulty: 'easy',   word: 'TREE',    hint: 'Found in forests' },
  { id: 'an4',  difficulty: 'easy',   word: 'FISH',    hint: 'Lives in water' },
  { id: 'an5',  difficulty: 'easy',   word: 'STAR',    hint: 'Shines at night' },
  { id: 'an6',  difficulty: 'easy',   word: 'DOOR',    hint: 'You open it to enter' },
  { id: 'an7',  difficulty: 'easy',   word: 'MOON',    hint: "Earth's natural satellite" },
  { id: 'an8',  difficulty: 'easy',   word: 'CAKE',    hint: 'Birthday dessert' },
  { id: 'an9',  difficulty: 'easy',   word: 'BIRD',    hint: 'It can fly' },
  { id: 'an10', difficulty: 'easy',   word: 'FIRE',    hint: 'Hot and bright' },
  // Medium (5-6 letters)
  { id: 'an11', difficulty: 'medium', word: 'EARTH',   hint: 'Our planet' },
  { id: 'an12', difficulty: 'medium', word: 'WATER',   hint: 'H₂O' },
  { id: 'an13', difficulty: 'medium', word: 'CLOUD',   hint: 'Floats in the sky' },
  { id: 'an14', difficulty: 'medium', word: 'HORSE',   hint: 'Animal you can ride' },
  { id: 'an15', difficulty: 'medium', word: 'MONEY',   hint: 'Used for buying things' },
  { id: 'an16', difficulty: 'medium', word: 'BEACH',   hint: 'Sandy by the ocean' },
  { id: 'an17', difficulty: 'medium', word: 'LIGHT',   hint: 'Opposite of darkness' },
  { id: 'an18', difficulty: 'medium', word: 'BRAIN',   hint: 'Organ of thought' },
  { id: 'an19', difficulty: 'medium', word: 'FLAME',   hint: 'Part of fire' },
  { id: 'an20', difficulty: 'medium', word: 'DREAM',   hint: 'What you do while sleeping' },
  // Hard (7-8 letters)
  { id: 'an21', difficulty: 'hard',   word: 'DOLPHIN',  hint: 'Intelligent sea mammal' },
  { id: 'an22', difficulty: 'hard',   word: 'CAPTAIN',  hint: 'Leader of a ship' },
  { id: 'an23', difficulty: 'hard',   word: 'KITCHEN',  hint: 'Where food is cooked' },
  { id: 'an24', difficulty: 'hard',   word: 'BALLOON',  hint: 'Floats with helium' },
  { id: 'an25', difficulty: 'hard',   word: 'DIAMOND',  hint: 'Precious gemstone' },
  { id: 'an26', difficulty: 'hard',   word: 'FREEDOM',  hint: 'Being free' },
  { id: 'an27', difficulty: 'hard',   word: 'MYSTERY',  hint: 'Something unknown' },
  { id: 'an28', difficulty: 'hard',   word: 'GRAVITY',  hint: 'Force that pulls you down' },
  { id: 'an29', difficulty: 'hard',   word: 'JOURNEY',  hint: 'A long trip' },
  { id: 'an30', difficulty: 'hard',   word: 'THUNDER',  hint: 'Loud sound in a storm' },
]

// ─── Emoji Decode ─────────────────────────────────────────────────────────────
// Each entry: { id, difficulty, emojis: string, answer: string, choices: string[] }
export const emojiDecodeQuestions = [
  // Easy
  { id: 'ed1',  difficulty: 'easy',   emojis: '🎂🕯️',     answer: 'BIRTHDAY',        choices: ['BIRTHDAY', 'PARTY', 'CAKE', 'CANDLE'] },
  { id: 'ed2',  difficulty: 'easy',   emojis: '🌙😴',     answer: 'BEDTIME',         choices: ['BEDTIME', 'SLEEP', 'DREAM', 'NIGHT'] },
  { id: 'ed3',  difficulty: 'easy',   emojis: '🎵🎶',     answer: 'MUSIC',           choices: ['MUSIC', 'SONG', 'DANCE', 'BEAT'] },
  { id: 'ed4',  difficulty: 'easy',   emojis: '⚽🥅',     answer: 'FOOTBALL',        choices: ['FOOTBALL', 'PENALTY', 'GOAL', 'MATCH'] },
  { id: 'ed5',  difficulty: 'easy',   emojis: '📱💬',     answer: 'TEXTING',         choices: ['TEXTING', 'CALLING', 'CHATTING', 'EMAIL'] },
  { id: 'ed6',  difficulty: 'easy',   emojis: '🌊🏖️',    answer: 'BEACH',           choices: ['BEACH', 'OCEAN', 'ISLAND', 'SURFING'] },
  { id: 'ed7',  difficulty: 'easy',   emojis: '🌧️☂️',    answer: 'RAINY DAY',       choices: ['RAINY DAY', 'STORM', 'FLOOD', 'THUNDER'] },
  { id: 'ed8',  difficulty: 'easy',   emojis: '🐕🏃',     answer: 'DOG WALKING',     choices: ['DOG WALKING', 'RUNNING', 'PET', 'JOGGING'] },
  { id: 'ed9',  difficulty: 'easy',   emojis: '☀️🕶️',    answer: 'SUNNY',           choices: ['SUNNY', 'SUMMER', 'HOT', 'BRIGHT'] },
  { id: 'ed10', difficulty: 'easy',   emojis: '🍕🍺',     answer: 'PIZZA PARTY',     choices: ['PIZZA PARTY', 'DINNER', 'FEAST', 'FRIDAY'] },
  // Medium
  { id: 'ed11', difficulty: 'medium', emojis: '💡🧠',     answer: 'BRIGHT IDEA',     choices: ['BRIGHT IDEA', 'KNOWLEDGE', 'THINK', 'SMART'] },
  { id: 'ed12', difficulty: 'medium', emojis: '🦁👑',     answer: 'LION KING',       choices: ['LION KING', 'ROYALTY', 'PRIDE', 'KINGDOM'] },
  { id: 'ed13', difficulty: 'medium', emojis: '🌋🔥',     answer: 'VOLCANO',         choices: ['VOLCANO', 'ERUPTION', 'LAVA', 'DISASTER'] },
  { id: 'ed14', difficulty: 'medium', emojis: '🏔️🧗',    answer: 'MOUNTAIN CLIMBING', choices: ['MOUNTAIN CLIMBING', 'HIKING', 'ADVENTURE', 'TREKKING'] },
  { id: 'ed15', difficulty: 'medium', emojis: '🌍🔄',     answer: 'REVOLUTION',      choices: ['REVOLUTION', 'ROTATION', 'ORBIT', 'SPIN'] },
  { id: 'ed16', difficulty: 'medium', emojis: '🎭😂😢',   answer: 'DRAMA',           choices: ['DRAMA', 'ACTING', 'THEATRE', 'EMOTION'] },
  { id: 'ed17', difficulty: 'medium', emojis: '🌹🥀',     answer: 'FADING LOVE',     choices: ['FADING LOVE', 'HEARTBREAK', 'WILTING', 'ROMANCE'] },
  { id: 'ed18', difficulty: 'medium', emojis: '🐉🔥',     answer: 'DRAGON FIRE',     choices: ['DRAGON FIRE', 'LEGEND', 'FANTASY', 'MYTHICAL'] },
  { id: 'ed19', difficulty: 'medium', emojis: '🕷️🕸️',   answer: 'SPIDERMAN',       choices: ['SPIDERMAN', 'SPIDER', 'WEB', 'HERO'] },
  { id: 'ed20', difficulty: 'medium', emojis: '🌊🦈',     answer: 'JAWS',            choices: ['JAWS', 'SHARK ATTACK', 'OCEAN', 'PREDATOR'] },
  // Hard
  { id: 'ed21', difficulty: 'hard',   emojis: '🦋🌀',     answer: 'BUTTERFLY EFFECT', choices: ['BUTTERFLY EFFECT', 'METAMORPHOSIS', 'CHAOS', 'SPIRAL'] },
  { id: 'ed22', difficulty: 'hard',   emojis: '⚖️👁️',    answer: 'BLIND JUSTICE',   choices: ['BLIND JUSTICE', 'JUDGEMENT', 'LAW', 'BALANCE'] },
  { id: 'ed23', difficulty: 'hard',   emojis: '🌱💧☀️',  answer: 'PHOTOSYNTHESIS',  choices: ['PHOTOSYNTHESIS', 'GARDENING', 'LIFE CYCLE', 'GROWTH'] },
  { id: 'ed24', difficulty: 'hard',   emojis: '📡🛸',     answer: 'ALIEN SIGNAL',    choices: ['ALIEN SIGNAL', 'BROADCAST', 'SATELLITE', 'UFO'] },
  { id: 'ed25', difficulty: 'hard',   emojis: '🎯🏆',     answer: 'CHAMPIONSHIP',    choices: ['CHAMPIONSHIP', 'BULLSEYE', 'WINNER', 'GOAL'] },
  { id: 'ed26', difficulty: 'hard',   emojis: '🌑🌒🌕',  answer: 'LUNAR CYCLE',     choices: ['LUNAR CYCLE', 'MOONRISE', 'ECLIPSE', 'PHASES'] },
  { id: 'ed27', difficulty: 'hard',   emojis: '🧬🔬',     answer: 'DNA RESEARCH',    choices: ['DNA RESEARCH', 'BIOLOGY', 'GENETICS', 'SCIENCE'] },
  { id: 'ed28', difficulty: 'hard',   emojis: '🌐💻',     answer: 'WORLD WIDE WEB',  choices: ['WORLD WIDE WEB', 'INTERNET', 'NETWORK', 'ONLINE'] },
  { id: 'ed29', difficulty: 'hard',   emojis: '⚡🧠',     answer: 'BRAINSTORM',      choices: ['BRAINSTORM', 'SHOCK', 'IDEA STORM', 'GENIUS'] },
  { id: 'ed30', difficulty: 'hard',   emojis: '🔐🗝️',    answer: 'UNLOCK SECRET',   choices: ['UNLOCK SECRET', 'PASSWORD', 'ENCRYPTION', 'MYSTERY'] },
]

// ─── Number Sequence ──────────────────────────────────────────────────────────
// Each entry: { id, difficulty, sequence: string, answer: number|string, choices: (number|string)[] }
// Use '?' to denote the missing value in sequence string
export const numberSequenceQuestions = [
  // Easy (arithmetic)
  { id: 'ns1',  difficulty: 'easy',   sequence: '2, 4, 6, ?, 10',          answer: 8,      choices: [7, 8, 9, 11] },
  { id: 'ns2',  difficulty: 'easy',   sequence: '5, 10, 15, ?, 25',        answer: 20,     choices: [18, 19, 20, 22] },
  { id: 'ns3',  difficulty: 'easy',   sequence: '1, 3, 5, 7, ?',           answer: 9,      choices: [8, 9, 10, 11] },
  { id: 'ns4',  difficulty: 'easy',   sequence: '10, 8, 6, ?, 2',          answer: 4,      choices: [3, 4, 5, 6] },
  { id: 'ns5',  difficulty: 'easy',   sequence: '3, 6, 9, ?, 15',          answer: 12,     choices: [10, 11, 12, 13] },
  { id: 'ns6',  difficulty: 'easy',   sequence: '100, 90, 80, ?, 60',      answer: 70,     choices: [65, 70, 75, 80] },
  { id: 'ns7',  difficulty: 'easy',   sequence: '1, 2, 4, ?, 16',          answer: 8,      choices: [6, 7, 8, 10] },
  { id: 'ns8',  difficulty: 'easy',   sequence: '0, 5, 10, 15, ?',         answer: 20,     choices: [18, 19, 20, 25] },
  { id: 'ns9',  difficulty: 'easy',   sequence: '7, 14, 21, ?, 35',        answer: 28,     choices: [25, 26, 27, 28] },
  { id: 'ns10', difficulty: 'easy',   sequence: '50, 45, 40, 35, ?',       answer: 30,     choices: [28, 29, 30, 32] },
  // Medium
  { id: 'ns11', difficulty: 'medium', sequence: '1, 4, 9, 16, ?',          answer: 25,     choices: [20, 22, 25, 36] },
  { id: 'ns12', difficulty: 'medium', sequence: '1, 1, 2, 3, 5, ?',        answer: 8,      choices: [6, 7, 8, 9] },
  { id: 'ns13', difficulty: 'medium', sequence: '2, 6, 18, 54, ?',         answer: 162,    choices: [108, 144, 162, 216] },
  { id: 'ns14', difficulty: 'medium', sequence: '1, 8, 27, ?, 125',        answer: 64,     choices: [36, 48, 64, 81] },
  { id: 'ns15', difficulty: 'medium', sequence: '2, 3, 5, 7, 11, ?',       answer: 13,     choices: [12, 13, 14, 15] },
  { id: 'ns16', difficulty: 'medium', sequence: '4, 7, 11, 16, ?',         answer: 22,     choices: [20, 21, 22, 23] },
  { id: 'ns17', difficulty: 'medium', sequence: '1, 3, 7, 15, ?',          answer: 31,     choices: [25, 28, 31, 35] },
  { id: 'ns18', difficulty: 'medium', sequence: '64, 32, 16, 8, ?',        answer: 4,      choices: [2, 4, 6, 8] },
  { id: 'ns19', difficulty: 'medium', sequence: '3, 5, 8, 13, ?',          answer: 21,     choices: [18, 20, 21, 26] },
  { id: 'ns20', difficulty: 'medium', sequence: '1, 2, 6, 24, ?',          answer: 120,    choices: [48, 80, 100, 120] },
  // Hard
  { id: 'ns21', difficulty: 'hard',   sequence: '2, 5, 11, 23, ?',         answer: 47,     choices: [40, 43, 47, 50] },
  { id: 'ns22', difficulty: 'hard',   sequence: '1, 4, 10, 20, ?',         answer: 35,     choices: [28, 30, 35, 40] },
  { id: 'ns23', difficulty: 'hard',   sequence: '1, 11, 21, 1211, ?',      answer: '111221', choices: ['111221', '31221', '3112', '112233'] },
  { id: 'ns24', difficulty: 'hard',   sequence: '1, 5, 14, 30, ?',         answer: 55,     choices: [45, 50, 55, 60] },
  { id: 'ns25', difficulty: 'hard',   sequence: '2, 3, 5, 9, 17, ?',       answer: 33,     choices: [29, 31, 33, 35] },
  { id: 'ns26', difficulty: 'hard',   sequence: '1, 2, 4, 7, 11, ?',       answer: 16,     choices: [14, 15, 16, 18] },
  { id: 'ns27', difficulty: 'hard',   sequence: '6, 14, 26, 42, ?',        answer: 62,     choices: [56, 60, 62, 68] },
  { id: 'ns28', difficulty: 'hard',   sequence: '3, 7, 15, 31, ?',         answer: 63,     choices: [52, 57, 63, 72] },
  { id: 'ns29', difficulty: 'hard',   sequence: '0, 1, 1, 2, 3, 5, 8, ?', answer: 13,     choices: [11, 12, 13, 14] },
  { id: 'ns30', difficulty: 'hard',   sequence: '2, 12, 36, 80, ?',        answer: 150,    choices: [100, 120, 140, 150] },
]

// ─── Word Association ─────────────────────────────────────────────────────────
// Each entry: { id, difficulty, word: string, choices: string[], answer: string }
export const wordAssociationQuestions = [
  // Easy
  { id: 'wa1',  difficulty: 'easy',   word: 'OCEAN',        choices: ['Desert', 'Wave', 'Mountain', 'Forest'],       answer: 'Wave' },
  { id: 'wa2',  difficulty: 'easy',   word: 'BREAD',        choices: ['Butter', 'Water', 'Paint', 'Metal'],          answer: 'Butter' },
  { id: 'wa3',  difficulty: 'easy',   word: 'NIGHT',        choices: ['Stars', 'Trees', 'Stones', 'Mountains'],      answer: 'Stars' },
  { id: 'wa4',  difficulty: 'easy',   word: 'RAIN',         choices: ['Umbrella', 'Volcano', 'Desert', 'Space'],     answer: 'Umbrella' },
  { id: 'wa5',  difficulty: 'easy',   word: 'BOOK',         choices: ['Read', 'Dance', 'Cook', 'Drive'],             answer: 'Read' },
  { id: 'wa6',  difficulty: 'easy',   word: 'FIRE',         choices: ['Ocean', 'Snow', 'Smoke', 'Clouds'],           answer: 'Smoke' },
  { id: 'wa7',  difficulty: 'easy',   word: 'SCHOOL',       choices: ['Doctor', 'Teacher', 'Chef', 'Driver'],        answer: 'Teacher' },
  { id: 'wa8',  difficulty: 'easy',   word: 'CAT',          choices: ['Bark', 'Chirp', 'Meow', 'Roar'],              answer: 'Meow' },
  { id: 'wa9',  difficulty: 'easy',   word: 'SUN',          choices: ['Rain', 'Moon', 'Shadow', 'Heat'],             answer: 'Heat' },
  { id: 'wa10', difficulty: 'easy',   word: 'MUSIC',        choices: ['Painting', 'Song', 'Sculpture', 'Building'],  answer: 'Song' },
  // Medium
  { id: 'wa11', difficulty: 'medium', word: 'JUSTICE',      choices: ['Scale', 'Sword', 'Crown', 'Shield'],          answer: 'Scale' },
  { id: 'wa12', difficulty: 'medium', word: 'TIME',         choices: ['Space', 'Clock', 'Color', 'Sound'],           answer: 'Clock' },
  { id: 'wa13', difficulty: 'medium', word: 'HEART',        choices: ['Love', 'Logic', 'Power', 'Mind'],             answer: 'Love' },
  { id: 'wa14', difficulty: 'medium', word: 'INTERNET',     choices: ['Isolation', 'Darkness', 'Connection', 'Silence'], answer: 'Connection' },
  { id: 'wa15', difficulty: 'medium', word: 'SILENCE',      choices: ['Thunder', 'Peace', 'Crowd', 'Noise'],         answer: 'Peace' },
  { id: 'wa16', difficulty: 'medium', word: 'MONEY',        choices: ['Hospital', 'Bank', 'Library', 'School'],      answer: 'Bank' },
  { id: 'wa17', difficulty: 'medium', word: 'LEADERSHIP',   choices: ['Comfort', 'Vision', 'Follower', 'Safety'],    answer: 'Vision' },
  { id: 'wa18', difficulty: 'medium', word: 'ANXIETY',      choices: ['Calm', 'Worry', 'Joy', 'Peace'],              answer: 'Worry' },
  { id: 'wa19', difficulty: 'medium', word: 'FREEDOM',      choices: ['Prison', 'Cage', 'Wings', 'Chains'],          answer: 'Wings' },
  { id: 'wa20', difficulty: 'medium', word: 'POWER',        choices: ['Peace', 'Love', 'Electricity', 'Art'],        answer: 'Electricity' },
  // Hard
  { id: 'wa21', difficulty: 'hard',   word: 'ENTROPY',      choices: ['Energy', 'Disorder', 'Matter', 'Light'],      answer: 'Disorder' },
  { id: 'wa22', difficulty: 'hard',   word: 'CATALYST',     choices: ['Stability', 'Change', 'Resistance', 'Stillness'], answer: 'Change' },
  { id: 'wa23', difficulty: 'hard',   word: 'RENAISSANCE',  choices: ['Destruction', 'Rebirth', 'Silence', 'Fear'],  answer: 'Rebirth' },
  { id: 'wa24', difficulty: 'hard',   word: 'PARADOX',      choices: ['Solution', 'Contradiction', 'Answer', 'Clarity'], answer: 'Contradiction' },
  { id: 'wa25', difficulty: 'hard',   word: 'OXYMORON',     choices: ['Agreement', 'Contradiction', 'Logic', 'Clarity'], answer: 'Contradiction' },
  { id: 'wa26', difficulty: 'hard',   word: 'SERENDIPITY',  choices: ['Hard Work', 'Planning', 'Lucky Discovery', 'Patience'], answer: 'Lucky Discovery' },
  { id: 'wa27', difficulty: 'hard',   word: 'EPHEMERAL',    choices: ['Permanent', 'Temporary', 'Eternal', 'Infinite'], answer: 'Temporary' },
  { id: 'wa28', difficulty: 'hard',   word: 'DICHOTOMY',    choices: ['Unity', 'Division', 'Balance', 'Harmony'],    answer: 'Division' },
  { id: 'wa29', difficulty: 'hard',   word: 'MELANCHOLY',   choices: ['Joy', 'Anger', 'Sadness', 'Peace'],           answer: 'Sadness' },
  { id: 'wa30', difficulty: 'hard',   word: 'EUPHORIA',     choices: ['Depression', 'Anger', 'Extreme Joy', 'Boredom'], answer: 'Extreme Joy' },
]

export const ALL_QUESTIONS = {
  anagram:         anagramQuestions,
  emojidecode:     emojiDecodeQuestions,
  numbersequence:  numberSequenceQuestions,
  wordassociation: wordAssociationQuestions,
}
