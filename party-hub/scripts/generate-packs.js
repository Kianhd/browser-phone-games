const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

/* ---------- Helpers ---------- */
function writePack(name, list, targetCount){
  const out = expandTo(list, targetCount);
  fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log('✔', name, out.length);
}
function expandTo(seed, n){
  if (seed.length >= n) return seed.slice(0, n);
  const out = seed.slice();
  let i = 0;
  while (out.length < n){
    const base = seed[i % seed.length];
    // light remix: occasionally append an emoji or swap a joke word
    const funny = ["(probably)", "🫣", "😅", "🤨", "lowkey", "no cap", "fr fr", "ngl", "pls", "send help"];
    const D = (out.length % 3 === 0) ? (base.D + ' ' + funny[out.length % funny.length]) : base.D;
    out.push({ q: base.q, A: base.A, B: base.B, C: base.C, D, correct: base.correct });
    i++;
  }
  return out;
}

/* ---------- PARTY MODES ---------- */
const quickQuiz = [
  { q:"Capital of Australia?", A:"Sydney", B:"Melbourne", C:"Canberra", D:"Kangaroo City", correct:"C" },
  { q:"Largest ocean?", A:"Atlantic", B:"Indian", C:"Pacific", D:"Ocean Spray", correct:"C" },
  { q:"Chemical symbol for gold?", A:"Au", B:"Ag", C:"Go", D:"$$", correct:"A" },
  { q:"Fastest land animal?", A:"Horse", B:"Ostrich", C:"Cheetah", D:"Your Wi-Fi fleeing", correct:"C" },
  { q:"Scotland's national animal?", A:"Lion", B:"Unicorn", C:"Horse", D:"Nessie", correct:"B" },
  { q:"Which planet is the Red Planet?", A:"Venus", B:"Mars", C:"Jupiter", D:"Elon's backyard", correct:"B" },
  { q:"Smallest country?", A:"Monaco", B:"Vatican City", C:"Liechtenstein", D:"TikTok HQ", correct:"B" },
  { q:"9 × 9 =", A:"81", B:"72", C:"99", D:"Use a calculator", correct:"A" },
  { q:"Which gas do plants absorb?", A:"Oxygen", B:"Carbon dioxide", C:"Nitrogen", D:"Pure vibes", correct:"B" },
  { q:"Who painted Guernica?", A:"Picasso", B:"Van Gogh", C:"Dalí", D:"That one NFT guy", correct:"A" }
];
const finishPhrase = [
  { q:"Netflix and ____.", A:"Chill", B:"Grill", C:"Bill", D:"Cry in the shower", correct:"A" },
  { q:"Work hard, play ____.", A:"Hard", B:"Smart", C:"Cards", D:"With my feelings", correct:"A" },
  { q:"Break a ____.", A:"Leg", B:"Rule", C:"Record", D:"Group chat", correct:"A" },
  { q:"Spill the ____.", A:"Tea", B:"Juice", C:"Truth", D:"Entire kitchen", correct:"A" },
  { q:"Another one bites the ____.", A:"Dust", B:"Crust", C:"Bus", D:"Mobile data", correct:"A" }
];
const factFiction = [
  { q:"Which is a real law in Georgia (US)?", A:"No forks with fried chicken", B:"No walking backwards after sunset", C:"No whistling underwater", D:"No farting near churches", correct:"A" },
  { q:"Which animal can sleep for 3 years?", A:"Snail", B:"Bear", C:"Camel", D:"Your roommate", correct:"A" },
  { q:"Bananas are actually?", A:"Berries", B:"Vegetables", C:"Roots", D:"Influencers", correct:"A" },
  { q:"Liquid at room temperature?", A:"Mercury", B:"Sodium", C:"Iron", D:"Unobtainium", correct:"A" }
];
const phoneConf = [
  { q:"Your ex texts 'U up?' You reply:", A:"New phone, who dis", B:"Yes but busy", C:"Block immediately", D:"Only if you bring pizza", correct:"C" },
  { q:"You pocket-dial your boss. You:", A:"Hang up", B:"Text sorry", C:"Pretend it's research", D:"Start singing", correct:"B" },
  { q:"You see 47 unread DMs. You:", A:"Answer all", B:"Select important", C:"Mark all read", D:"Throw phone in sea", correct:"B" }
];
const answerRoulette = [
  { q:"Pick the real Nobel category:", A:"Peace", B:"Engineering", C:"Mathematics", D:"Vibes", correct:"A" },
  { q:"Hardest natural substance?", A:"Diamond", B:"Graphite", C:"Quartz", D:"My ex's heart", correct:"A" },
  { q:"Human body's biggest organ?", A:"Skin", B:"Liver", C:"Brain", D:"TikTok feed", correct:"A" }
];
const lieDetector = [
  { q:"Which celeb was actually arrested?", A:"Bruno Mars for cocaine", B:"Justin Bieber for egging a house", C:"Ed Sheeran for karaoke", D:"SpongeBob for taxes", correct:"B" },
  { q:"Which product started as medicine?", A:"Coca-Cola", B:"Red Bull", C:"Sprite", D:"Hot sauce ice cream", correct:"A" }
];
const buzzkill = [
  { q:"2× points — Capital of Canada?", A:"Ottawa", B:"Toronto", C:"Montreal", D:"Canada City", correct:"A" },
  { q:"2× points — Gas most of air?", A:"Oxygen", B:"Nitrogen", C:"CO₂", D:"Pure chaos", correct:"B" }
];

/* ---------- COUPLES MODES ---------- */
const couplesHow = [
  { q:"What's my go-to comfort food?", A:"Pizza", B:"Sushi", C:"Ice cream", D:"Liquid courage", correct:"A" },
  { q:"My dream vacation vibe?", A:"Beach", B:"Mountains", C:"City", D:"In-laws resort", correct:"A" },
  { q:"My coffee order is:", A:"Latte", B:"Americano", C:"Cappuccino", D:"Pure chaos", correct:"A" }
];
const couplesSurvival = [
  { q:"We're lost in the woods. Who makes the fire?", A:"Me", B:"You", C:"Bear Grylls", D:"We cry together", correct:"A" },
  { q:"We have one battery left. Who gets it?", A:"Me", B:"You", C:"Phone", D:"The playlist", correct:"B" }
];
const couplesFinish = [
  { q:"Love is like ____.", A:"A rose", B:"A battlefield", C:"A Netflix subscription", D:"A stomach ache", correct:"A" },
  { q:"Home is where ____.", A:"The heart is", B:"The Wi-Fi connects", C:"We cuddle", D:"The snacks live", correct:"A" }
];
const couplesRel = [
  { q:"If I won $1M, first thing I'd buy:", A:"Car", B:"House", C:"Vacation", D:"Divorce lawyer", correct:"B" },
  { q:"On a free day I'd rather:", A:"Sleep in", B:"Brunch", C:"Gym", D:"Rearrange Spotify", correct:"A" }
];
const couplesSync = [
  { q:"Which movie would we pick for date night?", A:"Rom-com", B:"Action", C:"Horror", D:"Two-hour trailer", correct:"A" },
  { q:"Best pet for us?", A:"Dog", B:"Cat", C:"Fish", D:"Pet rock CEO", correct:"A" }
];

/* ---------- Write packs (counts) ---------- */
writePack('party-quick-quiz', quickQuiz, 100);
writePack('party-finish-the-phrase', finishPhrase, 80);
writePack('party-fact-or-fiction', factFiction, 80);
writePack('party-phone-confessions', phoneConf, 80);
writePack('party-answer-roulette', answerRoulette, 80);
writePack('party-lie-detector', lieDetector, 80);
writePack('party-buzzkill', buzzkill, 80);

writePack('couples-how-good', couplesHow, 60);
writePack('couples-survival', couplesSurvival, 60);
writePack('couples-finish-phrase', couplesFinish, 60);
writePack('couples-relationship-roulette', couplesRel, 60);
writePack('couples-secret-sync', couplesSync, 60);