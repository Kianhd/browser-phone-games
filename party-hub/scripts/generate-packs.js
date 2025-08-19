// scripts/generate-packs.js
// Builds Party/Friends packs with shuffled A/B/C/D and correct letter.
// Output: public/data/*.json
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

/** Helpers **/
const pick = (arr, n) => {
  if (n >= arr.length) return arr.slice();
  const idx = new Set();
  while (idx.size < n) idx.add(Math.floor(Math.random()*arr.length));
  return Array.from(idx).map(i => arr[i]);
};
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
};
function writePack(filename, seed, targetCount) {
  // If you want exactly N unique, ensure seed has >= N with distinct q's.
  const src = seed.slice(0, targetCount);
  const out = src.map(row => {
    // Ensure one funny distractor is present (but never equals the correctText)
    const funnyPool = [
      'My ex\'s mixtape', 'Pure chaos', 'Drunk Uncle Steve', 'A two-hour trailer',
      'Influencer tears', 'Ocean Spray™', 'Pet rock CEO', 'Elon\'s backyard',
      'Spreadsheet of feelings', 'The Wi-Fi password'
    ].filter(f => f !== row.correctText && !(row.wrong||[]).includes(f));

    // Build 3 wrongs: take from provided wrongs, then top up with a funny
    const wrongRaw = (row.wrong || []).filter(x => x && x !== row.correctText);
    let wrongs = wrongRaw.slice(0, 3);
    while (wrongs.length < 3) wrongs.push(funnyPool[(wrongs.length) % funnyPool.length]);

    const options = shuffle([row.correctText, ...wrongs]);
    const letters = ['A','B','C','D'];
    const correctIdx = options.indexOf(row.correctText);
    const obj = { q: row.q, A: options[0], B: options[1], C: options[2], D: options[3], correct: letters[correctIdx] };

    // Optional sanity guard: never allow the joke to be correct
    if (funnyPool.includes(obj[obj.correct])) {
      // Re-shuffle until the correct isn't funny
      const real = [row.correctText, ...wrongs.filter(w => !funnyPool.includes(w))];
      const rest = [...wrongs.filter(w => funnyPool.includes(w))];
      const rebuilt = shuffle([real[0], ...pick(real.slice(1).concat(rest), 3)]);
      const newIdx = rebuilt.indexOf(row.correctText);
      obj.A = rebuilt[0]; obj.B = rebuilt[1]; obj.C = rebuilt[2]; obj.D = rebuilt[3];
      obj.correct = letters[newIdx];
    }
    return obj;
  });

  const full = path.join(outDir, filename + '.json');
  fs.writeFileSync(full, JSON.stringify(out, null, 2), 'utf8');
  console.log('✔ wrote', path.basename(full), out.length);
}

/** ===================== Party/Friends Seeds ===================== **
 * Format per seed: { q, correctText, wrong: [..realistic..] }
 * All facts below are reality-based (widely verifiable).
 */

// 1) Quick Quiz Royale (General knowledge)
const SEED_QUICK_QUIZ = [
  { q:"What is the capital of Canada?", correctText:"Ottawa", wrong:["Toronto","Montreal","Vancouver"] },
  { q:"Which planet is known as the Red Planet?", correctText:"Mars", wrong:["Venus","Jupiter","Mercury"] },
  { q:"The chemical symbol for gold is?", correctText:"Au", wrong:["Ag","Gd","Go"] },
  { q:"What is the largest ocean on Earth?", correctText:"Pacific Ocean", wrong:["Atlantic Ocean","Indian Ocean","Arctic Ocean"] },
  { q:"Who painted the Mona Lisa?", correctText:"Leonardo da Vinci", wrong:["Michelangelo","Raphael","Donatello"] },
  { q:"What gas do plants primarily absorb for photosynthesis?", correctText:"Carbon dioxide", wrong:["Oxygen","Nitrogen","Hydrogen"] },
  { q:"What is the smallest country in the world by area?", correctText:"Vatican City", wrong:["Monaco","Liechtenstein","San Marino"] },
  { q:"In which country would you find the city of Kyoto?", correctText:"Japan", wrong:["China","South Korea","Thailand"] },
  { q:"Which instrument has keys, pedals and strings?", correctText:"Piano", wrong:["Violin","Trumpet","Flute"] },
  { q:"How many continents are there?", correctText:"7", wrong:["5","6","8"] },
  { q:"Which language has the most native speakers?", correctText:"Mandarin Chinese", wrong:["English","Spanish","Hindi"] },
  { q:"What is H2O commonly known as?", correctText:"Water", wrong:["Hydrogen peroxide","Salt","Oxygen"] },
  { q:"Which organ pumps blood through the body?", correctText:"Heart", wrong:["Lungs","Liver","Kidneys"] },
  { q:"What is the capital of Australia?", correctText:"Canberra", wrong:["Sydney","Melbourne","Perth"] },
  { q:"Which scientist proposed the theory of relativity?", correctText:"Albert Einstein", wrong:["Isaac Newton","Niels Bohr","Galileo Galilei"] },
  { q:"How many degrees are in a right angle?", correctText:"90", wrong:["45","60","120"] },
  { q:"What is the hardest natural substance?", correctText:"Diamond", wrong:["Quartz","Topaz","Corundum"] },
  { q:"Which country gifted the Statue of Liberty to the USA?", correctText:"France", wrong:["United Kingdom","Spain","Italy"] },
  { q:"Which metal is liquid at room temperature?", correctText:"Mercury", wrong:["Sodium","Aluminum","Lead"] },
  { q:"What is the largest desert in the world?", correctText:"Antarctic Desert", wrong:["Sahara","Gobi","Arabian"] },
  { q:"Who wrote '1984'?", correctText:"George Orwell", wrong:["Aldous Huxley","Ray Bradbury","J.D. Salinger"] },
  { q:"Which blood type is known as the universal donor?", correctText:"O negative", wrong:["O positive","AB positive","A negative"] },
  { q:"What is the currency of Japan?", correctText:"Yen", wrong:["Won","Yuan","Ringgit"] },
  { q:"Which planet has the most moons?", correctText:"Saturn", wrong:["Jupiter","Uranus","Neptune"] },
  { q:"How many bones are in the adult human body?", correctText:"206", wrong:["201","210","220"] },
  { q:"Which city hosted the 2012 Summer Olympics?", correctText:"London", wrong:["Beijing","Rio de Janeiro","Athens"] },
  { q:"What does CPU stand for?", correctText:"Central Processing Unit", wrong:["Computer Personal Unit","Central Peripheral Unit","Core Processing Utility"] },
  { q:"Which country is known as the Land of the Rising Sun?", correctText:"Japan", wrong:["South Korea","Thailand","China"] },
  { q:"What is the boiling point of water at sea level?", correctText:"100°C", wrong:["90°C","80°C","120°C"] },
  { q:"Who painted 'The Starry Night'?", correctText:"Vincent van Gogh", wrong:["Claude Monet","Pablo Picasso","Paul Cézanne"] },
  { q:"Which element has the symbol Fe?", correctText:"Iron", wrong:["Fluorine","Fermium","Tin"] },
  { q:"What is the tallest mountain above sea level?", correctText:"Mount Everest", wrong:["K2","Kangchenjunga","Lhotse"] },
  { q:"What is the national animal of Scotland?", correctText:"Unicorn", wrong:["Lion","Red deer","Highland cow"] },
  { q:"Which vitamin do we mainly get from sunlight?", correctText:"Vitamin D", wrong:["Vitamin C","Vitamin A","Vitamin B12"] },
  { q:"Which continent is the Nile River primarily associated with?", correctText:"Africa", wrong:["Asia","Europe","South America"] },
  { q:"Which artist is known as the 'King of Pop'?", correctText:"Michael Jackson", wrong:["Prince","Elvis Presley","Justin Bieber"] }
];

// 2) Finish the Phrase (set phrases & idioms)
const SEED_FINISH_PHRASE = [
  { q:"Netflix and ____.", correctText:"Chill", wrong:["Grill","Bill","Cry in the shower"] },
  { q:"Break a ____.", correctText:"Leg", wrong:["Rule","Record","Group chat"] },
  { q:"Spill the ____.", correctText:"Tea", wrong:["Beans","Juice","Entire kitchen"] },
  { q:"Keep calm and ____.", correctText:"Carry on", wrong:["Eat cake","Call mom","Blame your ex"] },
  { q:"The early bird catches the ____.", correctText:"Worm", wrong:["Bus","Cold","Wi-Fi"] },
  { q:"When life gives you lemons, make ____.", correctText:"Lemonade", wrong:["Tea","Margaritas","Excuses"] },
  { q:"Hit the nail on the ____.", correctText:"Head", wrong:["Thumb","Table","DMs"] },
  { q:"A picture is worth a thousand ____.", correctText:"Words", wrong:["Likes","Pixels","Memes"] },
  { q:"Don't count your chickens before they ____.", correctText:"Hatch", wrong:["Post","Cry","Fry"] },
  { q:"Bite off more than you can ____.", correctText:"Chew", wrong:["Stream","Swipe","Budget"] },
  { q:"Let the cat out of the ____.", correctText:"Bag", wrong:["Box","Room","Inbox"] },
  { q:"Beat around the ____.", correctText:"Bush", wrong:["Block","Group chat","Mic"] },
  { q:"Burning the midnight ____.", correctText:"Oil", wrong:["Data","Toast","Playlist"] },
  { q:"Add fuel to the ____.", correctText:"Fire", wrong:["Car","Rumor","Playlist"] },
  { q:"On cloud ____.", correctText:"Nine", wrong:["Seven","Eleven","Storage"] },
  { q:"Barking up the wrong ____.", correctText:"Tree", wrong:["Chat","Door","Thread"] },
  { q:"A blessing in ____.", correctText:"Disguise", wrong:["Comments","Noise","Crocs"] },
  { q:"Don't put all your eggs in one ____.", correctText:"Basket", wrong:["App","Cart","Story"] },
  { q:"Throw in the ____.", correctText:"Towel", wrong:["Like","Fork","Mic"] },
  { q:"Hit the ____ sack.", correctText:"Hay", wrong:["Gym","Like","Snooze"] },
];

// 3) Fact or Fiction? (3 false, 1 true; here we mark the true as correctText)
const SEED_FACT_FICTION = [
  { q:"Which of these is an actual law (USA)?", correctText:"It's illegal to eat fried chicken with a fork in Gainesville, Georgia", wrong:[
    "It's illegal to whistle underwater in Florida",
    "It's illegal to walk backwards after sunset in Arizona",
    "It's illegal to yawn in public on Mondays in Ohio"
  ]},
  { q:"Which of these is scientifically true?", correctText:"Bananas are botanically berries", wrong:[
    "Strawberries are true nuts",
    "Tomatoes are roots",
    "Cucumbers are fungi"
  ]},
  { q:"Which animal can hibernate for years?", correctText:"Some snails can sleep up to 3 years", wrong:[
    "Cheetahs nap for 48 hours",
    "Sharks sleep for weeks on land",
    "Parrots hibernate in winter"
  ]},
  { q:"Which is a real world capital fact?", correctText:"Canberra is the capital of Australia", wrong:[
    "Sydney is the capital of Australia",
    "Melbourne is the capital of Australia",
    "Perth is the capital of Australia"
  ]},
  { q:"Which is a verified record holder?", correctText:"The Pacific is the largest ocean", wrong:[
    "The Atlantic is the largest ocean",
    "The Indian is the largest ocean",
    "The Arctic is the largest ocean"
  ]},
  { q:"Which plant fact is true?", correctText:"Plants primarily absorb CO₂ during photosynthesis", wrong:[
    "Plants absorb methane to make sugar",
    "Plants breathe nitrogen at night",
    "Plants don't need gases"
  ]},
];

// 4) Phone Confessions (situational, answers rooted in common sense/etiquette)
const SEED_PHONE_CONFESSIONS = [
  { q:"Your ex texts 'U up?' What's the healthiest response?", correctText:"Block or ignore", wrong:["Reply: New phone, who dis","Reply: Yes but busy","Reply: Only if you bring pizza"] },
  { q:"You pocket-dial your boss. What do you do?", correctText:"Hang up and send a short apology text", wrong:["Pretend it's research","Call again and breathe loudly","Do nothing for a week"] },
  { q:"Group chat has 200 unread messages. Best move?", correctText:"Skim and respond only where you're needed", wrong:["Reply to everything","Mark all as read, never look","Leave the chat dramatically"] },
  { q:"You posted with a typo. Fix?", correctText:"Edit or delete-and-repost quickly", wrong:["Argue it's a new dialect","Blame autocorrect publicly","Ignore it forever"] },
  { q:"You're late to a call. Proper etiquette?", correctText:"Notify ASAP and give a new ETA", wrong:["Ghost the call","Join silently and say nothing","Blame your pet"] },
];

// 5) Answer Roulette (general facts—one is correct; some games add a 'forced wrong' mechanic in app logic)
const SEED_ANSWER_ROULETTE = [
  { q:"Pick the real Nobel Prize category:", correctText:"Peace", wrong:["Mathematics","Engineering","Philosophy"] },
  { q:"Hardest natural substance:", correctText:"Diamond", wrong:["Graphite","Quartz","Obsidian"] },
  { q:"Human body's largest organ:", correctText:"Skin", wrong:["Liver","Brain","Lungs"] },
  { q:"Planet with most moons (as of 2025):", correctText:"Saturn", wrong:["Jupiter","Uranus","Neptune"] },
  { q:"Currency of Japan:", correctText:"Yen", wrong:["Won","Yuan","Ringgit"] },
];

// 6) Lie Detector (3 lies + 1 true; true is correctText)
const SEED_LIE_DETECTOR = [
  { q:"Which of these actually happened?", correctText:"Justin Bieber was charged for egging a neighbor's house (2014)", wrong:[
    "Ed Sheeran was arrested for karaoke crimes",
    "SpongeBob was jailed for tax evasion",
    "Bruno Mars was arrested for bringing a tiger to a club"
  ]},
  { q:"Which product started as a medicine/tonic?", correctText:"Coca-Cola", wrong:["Sprite","Mountain Dew was a cough syrup","Fanta was an energy drink"] },
  { q:"Which geography fact is true?", correctText:"The Nile is generally cited as the longest river (disputed with the Amazon)", wrong:[
    "The Mississippi is the world's longest",
    "The Rhine is the world's longest",
    "The Danube is the world's longest"
  ]},
];

// 7) Buzzkill Bonus (regular trivia, flagged as 'bonus' in your app; facts real)
const SEED_BUZZKILL = [
  { q:"Capital of Canada?", correctText:"Ottawa", wrong:["Toronto","Montreal","Quebec City"] },
  { q:"Most abundant gas in Earth's atmosphere?", correctText:"Nitrogen", wrong:["Oxygen","Carbon dioxide","Argon"] },
  { q:"Who painted Guernica?", correctText:"Pablo Picasso", wrong:["Salvador Dalí","Joan Miró","Francis Bacon"] },
  { q:"SI unit of electric current:", correctText:"Ampere", wrong:["Volt","Ohm","Watt"] },
  { q:"Which metal's symbol is Fe?", correctText:"Iron", wrong:["Fluorine","Francium","Tin"] },
];

/** ===================== Write packs ===================== **/
writePack('party-quick-quiz',        SEED_QUICK_QUIZ,  SEED_QUICK_QUIZ.length);   // add more seeds to reach 80–100
writePack('party-finish-the-phrase', SEED_FINISH_PHRASE, SEED_FINISH_PHRASE.length);
writePack('party-fact-or-fiction',   SEED_FACT_FICTION, SEED_FACT_FICTION.length);
writePack('party-phone-confessions', SEED_PHONE_CONFESSIONS, SEED_PHONE_CONFESSIONS.length);
writePack('party-answer-roulette',   SEED_ANSWER_ROULETTE, SEED_ANSWER_ROULETTE.length);
writePack('party-lie-detector',      SEED_LIE_DETECTOR, SEED_LIE_DETECTOR.length);
writePack('party-buzzkill',          SEED_BUZZKILL, SEED_BUZZKILL.length);

/** ===================== Couples Seeds ===================== **/

// 8) Couples - How Good Do You Know Me?
const SEED_COUPLES_HOW_GOOD = [
  { q:"What's my go-to comfort food?", correctText:"Pizza", wrong:["Sushi","Ice cream","Tacos"] },
  { q:"My dream vacation vibe?", correctText:"Beach", wrong:["Mountains","City","Countryside"] },
  { q:"My coffee order is:", correctText:"Latte", wrong:["Americano","Cappuccino","Black coffee"] },
  { q:"What stresses me out most?", correctText:"Running late", wrong:["Loud noises","Crowds","Technology"] },
  { q:"My favorite way to relax?", correctText:"Reading", wrong:["Netflix","Music","Gaming"] },
  { q:"What do I do when I'm really excited?", correctText:"Talk fast", wrong:["Get quiet","Jump around","Laugh loudly"] },
  { q:"My biggest pet peeve is:", correctText:"People being late", wrong:["Loud chewing","Messy spaces","Bad drivers"] },
  { q:"How do I handle conflict?", correctText:"Talk it out immediately", wrong:["Need time to think","Avoid it","Get emotional"] },
  { q:"What's my love language?", correctText:"Quality time", wrong:["Physical touch","Words of affirmation","Acts of service"] },
  { q:"When I'm sad, I usually:", correctText:"Want to be alone", wrong:["Seek comfort","Get busy","Sleep it off"] }
];

// 9) Couples - Survival Scenarios
const SEED_COUPLES_SURVIVAL = [
  { q:"We're lost in the woods. Who makes the fire?", correctText:"Me", wrong:["You","Bear Grylls","We freeze together"] },
  { q:"We have one battery left. Who gets it?", correctText:"You", wrong:["Me","The phone","Split it somehow"] },
  { q:"Zombie apocalypse weapon of choice:", correctText:"Baseball bat", wrong:["Kitchen knife","Frying pan","Harsh language"] },
  { q:"Our shelter priority is:", correctText:"Find high ground", wrong:["Stay near water","Find a cave","Build in trees"] },
  { q:"Food runs out. What do we eat?", correctText:"Forage for berries", wrong:["Hunt rabbits","Fish in streams","Each other's cooking"] }
];

// 10) Couples - Finish the Phrase (Love Edition)
const SEED_COUPLES_FINISH_PHRASE = [
  { q:"Love is like ____.", correctText:"A warm hug", wrong:["A Netflix subscription","A rollercoaster","A pizza slice"] },
  { q:"Home is where ____.", correctText:"The heart is", wrong:["The Wi-Fi connects","We cuddle","The snacks live"] },
  { q:"You complete ____.", correctText:"Me", wrong:["My sentences","My Netflix queue","My grocery list"] },
  { q:"Love conquers ____.", correctText:"All", wrong:["Hunger","Laundry","Bad internet"] },
  { q:"Two hearts beat as ____.", correctText:"One", wrong:["Backup","Bass drops","Heart attacks"] }
];

// 11) Couples - Relationship Roulette
const SEED_COUPLES_RELATIONSHIP = [
  { q:"If I won $1M, first thing I'd buy:", correctText:"A house", wrong:["A car","Vacation","Invest it all"] },
  { q:"On a free day I'd rather:", correctText:"Sleep in", wrong:["Go for brunch","Hit the gym","Binge Netflix"] },
  { q:"My ideal date night is:", correctText:"Dinner and movie", wrong:["Adventure activity","Stay home cooking","Live music"] },
  { q:"If we had a pet, it would be:", correctText:"A dog", wrong:["A cat","Something exotic","No pets please"] },
  { q:"My biggest fear about our relationship:", correctText:"Growing apart", wrong:["Running out of things to say","Getting too comfortable","Meeting your parents"] }
];

// 12) Couples - Secret Sync
const SEED_COUPLES_SECRET_SYNC = [
  { q:"Which movie would we pick for date night?", correctText:"Rom-com", wrong:["Action","Horror","Documentary"] },
  { q:"Best pet for us?", correctText:"Dog", wrong:["Cat","Fish","No pets"] },
  { q:"Our ideal Sunday morning:", correctText:"Sleeping in late", wrong:["Early hike","Brunch out","Gym together"] },
  { q:"If we moved in together, biggest challenge:", correctText:"Splitting chores", wrong:["Decorating style","Cooking duties","Space for hobbies"] },
  { q:"Our song genre for dancing:", correctText:"Pop", wrong:["Classic rock","Hip-hop","Country"] }
];

/** ===================== Write all packs ===================== **/
// Party packs
writePack('party-quick-quiz',        SEED_QUICK_QUIZ,  SEED_QUICK_QUIZ.length);
writePack('party-finish-the-phrase', SEED_FINISH_PHRASE, SEED_FINISH_PHRASE.length);
writePack('party-fact-or-fiction',   SEED_FACT_FICTION, SEED_FACT_FICTION.length);
writePack('party-phone-confessions', SEED_PHONE_CONFESSIONS, SEED_PHONE_CONFESSIONS.length);
writePack('party-answer-roulette',   SEED_ANSWER_ROULETTE, SEED_ANSWER_ROULETTE.length);
writePack('party-lie-detector',      SEED_LIE_DETECTOR, SEED_LIE_DETECTOR.length);
writePack('party-buzzkill',          SEED_BUZZKILL, SEED_BUZZKILL.length);

// Couples packs
writePack('couples-how-good',               SEED_COUPLES_HOW_GOOD, SEED_COUPLES_HOW_GOOD.length);
writePack('couples-survival',               SEED_COUPLES_SURVIVAL, SEED_COUPLES_SURVIVAL.length);
writePack('couples-finish-phrase',          SEED_COUPLES_FINISH_PHRASE, SEED_COUPLES_FINISH_PHRASE.length);
writePack('couples-relationship-roulette',  SEED_COUPLES_RELATIONSHIP, SEED_COUPLES_RELATIONSHIP.length);
writePack('couples-secret-sync',            SEED_COUPLES_SECRET_SYNC, SEED_COUPLES_SECRET_SYNC.length);

console.log('Done. Add more seeds to reach 80–100 per pack, then re-run.');