/* ---------- INDEXEDDB MANAGER FOR LARGE FILES ---------- */
const DBManager = {
    db: null,
    
    async init(){
        return new Promise((resolve, reject)=>{
            const req = indexedDB.open('DialogueMakerDB', 1);
            req.onerror = ()=>reject(req.error);
            req.onsuccess = ()=>{ this.db = req.result; resolve(); };
            req.onupgradeneeded = (e)=>{
                const db = e.target.result;
                if(!db.objectStoreNames.contains('npcFiles')){
                    const store = db.createObjectStore('npcFiles', { keyPath: 'id' });
                    store.createIndex('npcName', 'npcName', { unique: false });
                }
                if(!db.objectStoreNames.contains('customNpcs')) db.createObjectStore('customNpcs', { keyPath: 'npcName' });
            };
        });
    },
    
    async saveFile(type, npcName, fileName, data){
        return new Promise((resolve, reject)=>{
            const tx = this.db.transaction('npcFiles', 'readwrite');
            const store = tx.objectStore('npcFiles');
            const id = npcName + '_' + type + '_' + fileName;
            store.put({ id, type, npcName, fileName, data, timestamp: Date.now() });
            tx.oncomplete = ()=>resolve();
            tx.onerror = ()=>reject(tx.error);
        });
    },
    
    async getFile(type, npcName, fileName){
        return new Promise((resolve, reject)=>{
            const tx = this.db.transaction('npcFiles', 'readonly');
            const store = tx.objectStore('npcFiles');
            const id = npcName + '_' + type + '_' + fileName;
            const req = store.get(id);
            req.onsuccess = ()=>resolve(req.result?.data || null);
            req.onerror = ()=>reject(req.error);
        });
    },
    
    async deleteNpcFiles(npcName){
        return new Promise((resolve, reject)=>{
            const tx = this.db.transaction('npcFiles', 'readwrite');
            const store = tx.objectStore('npcFiles');
            const index = store.index('npcName');
            const range = IDBKeyRange.only(npcName);
            const req = index.openCursor(range);
            req.onsuccess = (e)=>{
                const cursor = e.target.result;
                if(cursor){ cursor.delete(); cursor.continue(); }
            };
            tx.oncomplete = ()=>resolve();
            tx.onerror = ()=>reject(tx.error);
        });
    },
    
    async saveNpcMetadata(npcName, metadata){
        return new Promise((resolve, reject)=>{
            const tx = this.db.transaction('customNpcs', 'readwrite');
            const store = tx.objectStore('customNpcs');
            store.put({ npcName, ...metadata });
            tx.oncomplete = ()=>resolve();
            tx.onerror = ()=>reject(tx.error);
        });
    },
    
    async getNpcMetadata(npcName){
        return new Promise((resolve, reject)=>{
            const tx = this.db.transaction('customNpcs', 'readonly');
            const store = tx.objectStore('customNpcs');
            const req = store.get(npcName);
            req.onsuccess = ()=>resolve(req.result || null);
            req.onerror = ()=>reject(req.error);
        });
    },

    async deleteNpcMetadata(npcName){
        return new Promise((resolve, reject)=>{
            const tx = this.db.transaction('customNpcs', 'readwrite');
            const store = tx.objectStore('customNpcs');
            store.delete(npcName);
            tx.oncomplete = ()=>resolve();
            tx.onerror = ()=>reject(tx.error);
        });
    }
};

/* ---------- VARIABLES ---------- */
let script = [];
let index = 0;
let activeTopNPCs = [];
let activeFrontNPCs = [];
let isPlaying = false;
let currentMusicNpc = null;
let backgroundAudio = null;
let introPlaying = false;
let introAudioEl = null;
let lastVoiceAudio = null; // Track current voice audio to stop on new audio
// Per-NPC audio elements so intro/background can overlap with other music
const npcBgAudios = {};
const npcIntroAudios = {};

// Custom NPCs storage (persisted in localStorage - only metadata, files in IndexedDB)
let customNPCs = JSON.parse(localStorage.getItem("customNPCs")) || {};
let customNpcVoiceLines = JSON.parse(localStorage.getItem("customNpcVoiceLines")) || {};
// Playback toggles (mirrors UI checkboxes)
let enableMusic = JSON.parse(localStorage.getItem('enableMusic'));
if (enableMusic === null) enableMusic = true;
let enableSfx = JSON.parse(localStorage.getItem('enableSfx'));
if (enableSfx === null) enableSfx = true;

// Initialize IndexedDB on load
DBManager.init().catch(e=>console.log('IndexedDB init error:', e));

// Migrate old localStorage-based NPCs to IndexedDB
async function migrateOldNpcsToIndexedDB(){
    try {
        for(let npcName of Object.keys(customNPCs)){
            const npc = customNPCs[npcName];
            // Only migrate if this NPC still has old-style data URLs in images
            if(npc.images && typeof npc.images['DEFAULT'] === 'string' && npc.images['DEFAULT'].startsWith('data:')){
                console.log('Migrating', npcName, 'to IndexedDB...');
                // Move images to IndexedDB
                for(let [emotionName, dataUrl] of Object.entries(npc.images)){
                    if(dataUrl.startsWith('data:')){
                        await DBManager.saveFile('image', npcName, emotionName, dataUrl);
                    }
                }
                // Move voice lines to IndexedDB
                if(npc.voiceLines){
                    for(let [emotionName, dataUrl] of Object.entries(npc.voiceLines)){
                        if(dataUrl.startsWith('data:')){
                            await DBManager.saveFile('voice', npcName, emotionName, dataUrl);
                        }
                    }
                }
                // Replace old format with new reference-based format
                const imageReferences = Object.keys(npc.images).reduce((acc, key)=>{ acc[key] = key; return acc; }, {});
                const voiceReferences = npc.voiceLines ? Object.keys(npc.voiceLines).reduce((acc, key)=>{ acc[key] = key; return acc; }, {}) : {};
                customNPCs[npcName] = {
                    imageReferences,
                    voiceReferences,
                    font: npc.font,
                    textColor: npc.textColor,
                    position: npc.position
                };
                await DBManager.saveNpcMetadata(npcName, customNPCs[npcName]);
            }
        }
        localStorage.setItem("customNPCs", JSON.stringify(customNPCs));
        console.log('Migration complete');
    } catch(e){
        console.log('Migration error (non-critical):', e);
    }
}

// Run migration after a short delay to allow DBManager to init
setTimeout(migrateOldNpcsToIndexedDB, 500);

// Skip blocking timer (prevents skipping during 2-sec spawn/intro/leave)
let skipBlockTimer = null;
let skipBlocked = false;

// Shuffled sound queue system: tracks shuffled lists per NPC+emotion
const soundListQueues = {}; // { "npc_emotion": [shuffled list], ... }
const soundQueueIndices = {}; // { "npc_emotion": current index in queue }

// Fisher-Yates shuffle algorithm
function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get next sound from shuffled queue (reshuffle when exhausted)
function getNextQueuedSound(npc, emotion, soundList) {
    if (!soundList || soundList.length === 0) return null;
    
    const key = npc + "_" + emotion;
    
    // Initialize queue if not exists
    if (!soundListQueues[key]) {
        soundListQueues[key] = shuffleArray(soundList);
        soundQueueIndices[key] = 0;
    }
    
    const queue = soundListQueues[key];
    const currentIndex = soundQueueIndices[key];
    
    // If we've exhausted the queue, reshuffle and restart
    if (currentIndex >= queue.length) {
        soundListQueues[key] = shuffleArray(soundList);
        soundQueueIndices[key] = 0;
    }
    
    // Get the next sound and increment index
    const sound = soundListQueues[key][soundQueueIndices[key]];
    soundQueueIndices[key]++;
    
    return sound;
}

const speakerSel = document.getElementById("speaker");
const emotionSel = document.getElementById("emotion");
const textInput = document.getElementById("text");
const timeline = document.getElementById("timeline");

const game = document.getElementById("game");
const bottomDialogue = document.getElementById("bottomDialogue");
const topDialogue = document.getElementById("topDialogue");
const bottomText = document.getElementById("bottomText");
const topText = document.getElementById("topText");
const speech_bubble_left = document.getElementById("speech_bubble_left");
const speech_bubble_left_img = document.getElementById("speech_bubble_left_img");
const speech_bubble_left_text = document.getElementById("speech_bubble_left_text");
const speech_bubble_right = document.getElementById("speech_bubble_right");
const speech_bubble_right_img = document.getElementById("speech_bubble_right_img");
const speech_bubble_right_text = document.getElementById("speech_bubble_right_text");

const npcs = {
    dave: document.getElementById("dave"),
    penny: document.getElementById("penny"),
    spongebob: document.getElementById("spongebob"),
    zomboss: document.getElementById("zomboss"),
    zombert: document.getElementById("zombert"),
    camo: document.getElementById("camo"),
    lucky: document.getElementById("lucky"),
    nanny: document.getElementById("nanny"),
    missinfo: document.getElementById("missinfo"),
    huntaria: document.getElementById("huntaria"),
    greedy: document.getElementById("greedy"),
    antibullysquad: document.getElementById("antibullysquad"),
    plankton: document.getElementById("plankton"),
    douglas: document.getElementById("douglas"),
    tugboat: document.getElementById("tugboat")
};

// Penny variants: surfer (no voice) and soldier (uses camo voice/emotions)
npcs.soldier = document.getElementById("soldier");
npcs.surfer = document.getElementById("surfer");

// Custom/added NPC: Chimanta (user-added image file "Chimanta tenkyuu.png")
// If you add an <img id="chimanta"> in index.html pointing to that PNG, it will be treated as a Penny/front NPC
npcs.chimanta = document.getElementById("chimanta");

/* ---------- NPC ANIMATION BEHAVIOR ---------- */
// NPCs that reset to idle when THEIR OWN voice ends (voice-driven reset)
const voiceDrivenNpcs = new Set(['dave', 'spongebob', 'tugboat']);
// NPCs that reset to idle when ANOTHER NPC starts talking (abs-type reset)
const absTypeNpcs = new Set(['antibullysquad', 'plankton', 'douglas']);

// Front NPC groups
const DAVE_VARIANTS = ['dave'];
const PENNY_VARIANTS = ['penny', 'chimanta'];
const LEFT_BUBBLE_NPCS = DAVE_VARIANTS.concat(['tugboat']);  // Use left bubble
const RIGHT_BUBBLE_NPCS = PENNY_VARIANTS.concat(['spongebob', 'plankton', 'douglas']);  // Use right bubble
const FRONT_NPCS = LEFT_BUBBLE_NPCS.concat(RIGHT_BUBBLE_NPCS);

function isFrontNpc(npcName){
    if(!npcName) return false;
    if(FRONT_NPCS.includes(npcName)) return true;
    return !!(customNPCs[npcName] && customNPCs[npcName].position === 'front');
}

/* ---------- NPC FONTS ---------- */
const npcFonts = {
    dave:"BrianneHand", penny:"BrianneHand", spongebob:"KrustyKrab", zomboss:"AshleyScript",
    zombert:"ROGLyonsType", camo:"RockwellCondensed",
    lucky:"Blackadder", nanny:"InformalRoman",
    missinfo:"NewsFlashBB", huntaria:"Cromagnum", greedy:"Century751BTBold",
    antibullysquad:"UnmaskedBB", plankton:"Arial", douglas:"Arial", tugboat:"Arial"
};

// Fonts for Penny variants
npcFonts['soldier'] = "BrianneHand";
npcFonts['surfer'] = "BrianneHand";

// Font for Chimanta (user provided PNG) - use Brianne's Hand
npcFonts['chimanta'] = "BrianneHand";

/* ---------- CUSTOM NPC FONTS & COLORS ---------- */
let customNpcFonts = JSON.parse(localStorage.getItem("customNpcFonts")) || {};
let customNpcColors = JSON.parse(localStorage.getItem("customNpcColors")) || {};
let customSfxMap = JSON.parse(localStorage.getItem("customSfxMap")) || {};

// Merge custom fonts with preset ones
function getNpcFont(npc) {
    return customNpcFonts[npc] || npcFonts[npc] || "Arial, sans-serif";
}

/* ========== CONTENT FILTER / CENSOR SYSTEM ========== */

// List of words to censor (profanity, slurs, hate speech, etc.)
const bannedWords = [
  // ===== RACIST / HATE SLURS =====
  "nigger","nigga","n1gger","n1gga","ni99er","n!gger","n!gga",
  "negro","negr0","kneegrow","knee grow","bitches","fucking",
  "coon","k00n","c00n",
  "chink","ch1nk","c h i n k",
  "gook","g00k",
  "spic","sp1c",
  "kike","k1ke",
  "jap","j@p",
  "paki","pak1",
  "raghead","rag-head",
  "towelhead",
  "cameljockey","camel jockey",
  "wetback","wet back",
  "beaner","b34ner",
  "dago",
  "gypsy","gyp5y",
  "tranny","tr4nny",
  "faggot","f4ggot","f@g","f@g0t",
  "dyke","d1ke",
  "retard","r3tard","ret4rd",
  "autist","aut1st",
  "mongoloid","mongo",
  "cripple","cr1pple",

  // ===== NAZI / EXTREMISM =====
  "hitler","h1tler","zitler",
  "nazi","n4zi",
  "heil","sieg heil",
  "swastika",

  // ===== PROFANITY =====
  "fuck","f*ck","f**k","f***","fuk","phuck","fvck",
  "shit","sh1t","5hit","sh!t",
  "bitch","b1tch","bi7ch",
  "asshole","a55hole","a$$hole",
  "ass","a$$",
  "cunt","c*nt","kunt",
  "dick","d1ck","dik",
  "cock","c0ck","kock",
  "pussy","p*ssy","pu55y",
  "whore","wh0re","hoe",
  "slut","5lut",
  "bastard","b4stard",
  "crap","cr4p",
  "piss","p1ss",
  "cum","c0m",
  "jerk","j3rk",
  "suck","s*ck",
  "tits","t1ts",
  "boobs","b00bs",
  "butt","a55",
  "fart",
  "poop","p00p",

  // ===== THREATS / HARASSMENT =====
  "kys","kill yourself",
  "jump off a bridge","end yourself",

  // ===== EVASION PATTERNS =====
  "n i g g e r",
  "f a g g o t",
  "c h i n k",
  "s h i t",
  "f u c k"
];

// Generate random censoring characters
function generateCensorBar(wordLength) {
    const symbols = ["@", "#", "!", "?", "%", "&"];
    if (!wordLength || wordLength <= 0) return "";

    let result = "";
    let prev = null;

    for (let i = 0; i < wordLength; i++) {
        let ch;
        do {
            ch = symbols[Math.floor(Math.random() * symbols.length)];
        } while (ch === prev);

        result += ch;
        prev = ch;
    }

    return result;
}

// Censor text - replaces banned words with @#$%^&* style censoring
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function censorText(text) {
    if (!text) return text;
    
    let censoredText = text;
    
    bannedWords.forEach(word => {
        // Escape special regex characters in the word
        const escapedWord = escapeRegExp(word);
        // Case-insensitive regex with word boundaries
        const regex = new RegExp(`\\b${escapedWord}\\b`, "gi");
        censoredText = censoredText.replace(regex, (match) => {
            return generateCensorBar(match.length);
        });
    });
    
    return censoredText;
}

/* ---------- DAVE SOUNDS ---------- */
const daveSounds = {
    SAY: ["Dave/SAY1.ogg","Dave/SAY2.ogg","Dave/SAY3.ogg","Dave/SAY4.ogg","Dave/SAY5.ogg","Dave/SAY6.ogg","Dave/SAY7.ogg","Dave/SAY8.ogg","Dave/SAY9.ogg","Dave/SAY10.ogg","Dave/SAY11.ogg","Dave/SAY12.ogg"],
    SHOUT: ["Dave/SHOUT1.ogg","Dave/SHOUT2.ogg","Dave/SHOUT3.ogg","Dave/SHOUT4.ogg","Dave/SHOUT5.ogg","Dave/SHOUT6.ogg"],
    EXCITED: ["Dave/EXCITED1.ogg","Dave/EXCITED2.ogg","Dave/EXCITED3.ogg","Dave/EXCITED4.ogg","Dave/EXCITED5.ogg","Dave/EXCITED6.ogg"],
    TIRED: ["Dave/TIRED1.ogg","Dave/TIRED2.ogg","Dave/TIRED3.ogg","Dave/TIRED4.ogg","Dave/TIRED5.ogg","Dave/TIRED6.ogg","Dave/TIRED7.ogg","Dave/TIRED8.ogg","Dave/TIRED9.ogg"],
    PLAYFUL: ["Dave/PLAYFUL1.ogg","Dave/PLAYFUL2.ogg","Dave/PLAYFUL3.ogg","Dave/PLAYFUL4.ogg","Dave/PLAYFUL5.ogg","Dave/PLAYFUL6.ogg","Dave/PLAYFUL7.ogg"]
};

/* ---------- DAVE VOICE VARIANTS ---------- */
const daveSoundsVariants = {
    default: daveSounds,  // default already defined above
    old: {
        SAY: ["Dave/old/SAY1.ogg","Dave/old/SAY2.ogg","Dave/old/SAY3.ogg","Dave/old/SAY4.ogg","Dave/old/SAY5.ogg","Dave/old/SAY6.ogg","Dave/old/SAY7.ogg","Dave/old/SAY8.ogg","Dave/old/SAY9.ogg"],
        SHOUT: ["Dave/old/SHOUT1.ogg","Dave/old/SHOUT2.ogg"],
        EXCITED: ["Dave/old/EXCITED1.ogg"],
        TIRED: [],
        PLAYFUL: []
    },
    birthday: {
        SAY: ["Dave/BIRTHDAY_SAY1.ogg"],  // Placeholder - update if birthday files exist
        SHOUT: [],
        EXCITED: [],
        TIRED: [],
        PLAYFUL: []
    }
};

/* ---------- DAVE SKIN VARIANTS ---------- */
const daveSkinVariants = {
    default: "Dave.png",
    n3xt: "Dave/n3xtsay.png",  // N3XT skin works like ABS (emotion-based)
    lunar: "Dave/lunardave.png",
    evil: "Dave/evil.png",
    birthday: "Dave/birthday.png",
    alternate: "Dave/altdave.png"
};

/* ---------- ZOMBERT SKIN VARIANTS ---------- */
const zombertSkinVariants = {
    default: "Zombert.png",
    super: "Zombert/superzombert.png"
};

/* ---------- LUCKY & MISSINFO SKIN VARIANTS ---------- */
const luckySkinVariants = {
    default: "Lucky.png",
    love: "Lucky/love.png"
};

const missinfoSkinVariants = {
    default: "MissInfo.png",
    love: "MissInfo/love.png"
};

/* ---------- PENNY SOUNDS ---------- */
const pennySounds = {
    SAY: ["Weenie/SAY1.ogg","Weenie/SAY2.ogg","Weenie/SAY3.ogg","Weenie/SAY4.ogg","Weenie/SAY5.ogg","Weenie/SAY7.ogg","Weenie/SAY8.ogg","Weenie/SAY9.ogg","Weenie/SAY10.ogg","Weenie/SAY11.ogg","Weenie/SAY12.ogg"],
    SHOUT: ["Weenie/SHOUT1.ogg","Weenie/SHOUT2.ogg","Weenie/SHOUT3.ogg","Weenie/SHOUT4.ogg","Weenie/SHOUT5.ogg","Weenie/SHOUT6.ogg"],
    EXCITED: ["Weenie/EXCITED1.ogg","Weenie/EXCITED2.ogg","Weenie/EXCITED3.ogg","Weenie/EXCITED4.ogg","Weenie/EXCITED5.ogg","Weenie/EXCITED6.ogg"],
    TIRED: ["Weenie/TIRED1.ogg","Weenie/TIRED2.ogg","Weenie/TIRED3.ogg","Weenie/TIRED4.ogg","Weenie/TIRED5.ogg","Weenie/TIRED6.ogg","Weenie/TIRED7.ogg","Weenie/TIRED8.ogg","Weenie/TIRED9.ogg"],
    PLAYFUL: ["Weenie/PLAYFUL1.ogg","Weenie/PLAYFUL2.ogg","Weenie/PLAYFUL3.ogg","Weenie/PLAYFUL4.ogg","Weenie/PLAYFUL5.ogg","Weenie/PLAYFUL6.ogg","Weenie/PLAYFUL7.ogg","Weenie/PLAYFUL8.ogg","Weenie/PLAYFUL9.ogg"]
};

/* ---------- SPONGEBOB SOUNDS ---------- */
const spongebobSounds = {
    SAY: ["Spongebob/say1.ogg","Spongebob/say2.ogg","Spongebob/say3.ogg","Spongebob/say4.ogg","Spongebob/say5.ogg","Spongebob/say6.ogg","Spongebob/say7.ogg","Spongebob/say8.ogg"],
    SHOUT: ["Spongebob/shout1.ogg","Spongebob/shout3.ogg","Spongebob/shout4.ogg","Spongebob/shout5.ogg"],
    EXCITED: ["Spongebob/excited1.ogg","Spongebob/excited2.ogg","Spongebob/excited3.ogg","Spongebob/excited4.ogg"],
    TIRED: ["Spongebob/tired1.ogg","Spongebob/tired2.ogg","Spongebob/tired3.ogg","Spongebob/tired4.ogg","Spongebob/tired5.ogg","Spongebob/tired6.ogg"],
    PLAYFUL: ["Spongebob/playful1.ogg","Spongebob/playful2.ogg"]
};

/* ---------- CAMO SOUNDS ---------- */
const camoSounds = {
    SAY: ["Camo/SAY1.mp3","Camo/SAY2.mp3","Camo/SAY3.mp3","Camo/SAY4.mp3","Camo/SAY5.mp3","Camo/SAY6.mp3","Camo/SAY7.mp3"],
    SHOUT: ["Camo/SHOUT1.mp3","Camo/SHOUT2.mp3","Camo/SHOUT3.mp3","Camo/SHOUT4.mp3","Camo/SHOUT5.mp3","Camo/SHOUT6.mp3"],
};
const zombossSounds = {
    SAY: ["Zomboss/SAY1.ogg","Zomboss/SAY2.ogg","Zomboss/SAY3.ogg","Zomboss/SAY4.ogg","Zomboss/SAY5.ogg","Zomboss/SAY6.ogg"],
    SHOUT: ["Zomboss/SHOUT1.ogg","Zomboss/SHOUT2.ogg","Zomboss/SHOUT3.ogg"],
    PLAYFUL: ["Zomboss/PLAYFUL1.ogg","Zomboss/PLAYFUL2.ogg","Zomboss/PLAYFUL3.ogg"],
    TIRED: ["Zomboss/TIRED1.ogg","Zomboss/TIRED2.ogg","Zomboss/TIRED3.ogg"],
    EXCITED: ["Zomboss/EXCITED1.ogg","Zomboss/EXCITED2.ogg","Zomboss/EXCITED3.ogg"]
};
const zombertSounds = {
    SAY: ["Zombert/SAY1.mp3","Zombert/SAY2.mp3","Zombert/SAY3.mp3","Zombert/SAY4.mp3"],
    SHOUT: ["Zombert/SHOUT2.mp3","Zombert/SHOUT3.mp3"],
    TIRED: ["Zombert/TIRED1.mp3"],
    EXCITED: ["Zombert/EXCITED1.mp3"]
};
const luckySounds = {
    SAY:["Lucky/SPEAK1.mp3","Lucky/SPEAK2.mp3","Lucky/SPEAK3.mp3","Lucky/SPEAK4.mp3","Lucky/SPEAK5.mp3"],
    SHOUT:["Lucky/SHOUT1.mp3","Lucky/SHOUT2.mp3"],
    TIRED:["Lucky/TIRED1.mp3","Lucky/TIRED2.mp3"],
    PLAYFUL:["Lucky/PLAYFUL1.mp3","Lucky/PLAYFUL2.mp3"]
};
const nannySounds = {
    SAY: ["Nanny/SAY1.ogg","Nanny/SAY2.ogg","Nanny/SAY3.ogg","Nanny/SAY4.ogg","Nanny/SAY5.ogg"],
    SHOUT: ["Nanny/SHOUT1.ogg"],
    EXCITED: ["Nanny/EXCITED1.ogg"],
    TIRED: ["Nanny/TIRED1.ogg"]
};
const huntariaSounds = {
    SAY:["Huntaria/SAY1.ogg","Huntaria/SAY2.ogg","Huntaria/SAY3.ogg"],
}
const ABS = {
    SHOUT:["AntiBullySquad/SHOUT1.ogg","AntiBullySquad/SHOUT2.ogg","AntiBullySquad/SHOUT3.ogg","AntiBullySquad/SHOUT4.ogg"],
    TIRED:["AntiBullySquad/TIRED1.ogg","AntiBullySquad/TIRED2.ogg"],
    PLAYFUL:["AntiBullySquad/PLAYFUL1.ogg","AntiBullySquad/PLAYFUL2.ogg","AntiBullySquad/PLAYFUL3.ogg"]
};
const missinfo = {
    SAY:["MissInfo/SAY1.ogg","MissInfo/SAY2.ogg","MissInfo/SAY3.ogg","MissInfo/SAY4.ogg",]
};

/* ---------- CHIMANTA (NO VOICE) ---------- */
const chimantaSounds = {
    SAY: [],
    SHOUT: [],
    EXCITED: [],
    TIRED: [],
    PLAYFUL: []
};
/* ---------- NPC INTRO SOUNDS ---------- */
const npcIntroSounds = {
    dave: "Dave/INTRO.ogg",
    penny: "Weenie/INTRO.ogg",
    camo: "Camo/INTRO.ogg",
    zomboss: "Zomboss/INTRO.ogg",
    zombert: "Zombert/INTRO.ogg",
    lucky: "Lucky/INTRO.ogg",
    nanny: "Nanny/INTRO.ogg",
    missinfo: "MissInfo/INTRO.ogg",
    huntaria: "Huntaria/INTRO.ogg",
    greedy: "Greedy/INTRO.ogg",
    antibullysquad: "AntiBullySquad/INTRO.ogg",
    spongebob: "Spongebob/INTRO.ogg",
    plankton: "plankton/INTRO.ogg",
    douglas: "douglas/INTRO.ogg",
    tugboat: "tugboat/INTRO.ogg"
};

// Map Penny variant: soldier uses camo intro
npcIntroSounds['soldier'] = npcIntroSounds['camo'];

// Add custom NPC intros
function updateIntroSounds() {
    Object.keys(customNPCs).forEach(npcName => {
        if (customNPCs[npcName].introSound) {
            npcIntroSounds[npcName] = customNPCs[npcName].introSound;
        }
    });
}

/* ---------- NPC SPAWN/DESPAWN SOUNDS ---------- */
const npcSpawnSounds = {
    dave: "Dave/SPAWN.ogg",
    penny: "Weenie/SPAWN.ogg",
    camo: "Camo/SPAWN.ogg",
    zomboss: "Zomboss/SPAWN.ogg",
    zombert: "Zombert/SPAWN.ogg",
    lucky: "Lucky/SPAWN.ogg",
    nanny: "Nanny/SPAWN.ogg",
    missinfo: "MissInfo/SPAWN.ogg",
    huntaria: "Huntaria/SPAWN.ogg",
    greedy: "Greedy/SPAWN.ogg",
    antibullysquad: "AntiBullySquad/SPAWN.ogg",
    plankton: "plankton/SPAWN.ogg",
    douglas: "douglas/SPAWN.ogg",
    tugboat: "tugboat/SPAWN.ogg"
};

// soldier uses camo spawn/despawn; surfer silent
npcSpawnSounds['soldier'] = npcSpawnSounds['camo'];

// If user adds Chimanta image as a front NPC, use Dave's spawn sound for it
npcSpawnSounds['chimanta'] = npcSpawnSounds['dave'];

const npcDespawnSounds = {
    dave: "Dave/DESPAWN.ogg",
    penny: "Weenie/DESPAWN.ogg",
    camo: "Camo/DESPAWN.ogg",
    zomboss: "Zomboss/DESPAWN.ogg",
    zombert: "Zombert/DESPAWN.ogg",
    lucky: "Lucky/DESPAWN.ogg",
    nanny: "Nanny/DESPAWN.ogg",
    missinfo: "MissInfo/DESPAWN.ogg",
    huntaria: "Huntaria/DESPAWN.ogg",
    greedy: "Greedy/DESPAWN.ogg",
    antibullysquad: "AntiBullySquad/DESPAWN.ogg",
    plankton: "plankton/DESPAWN.ogg",
    douglas: "douglas/DESPAWN.ogg",
    tugboat: "tugboat/DESPAWN.ogg"
};
// soldier uses camo despawn
npcDespawnSounds['soldier'] = npcDespawnSounds['camo'];
const greedySounds = {
    SAY: ["Greedy/SAY1.ogg","Greedy/SAY2.ogg","Greedy/SAY3.ogg","Greedy/SAY4.ogg","Greedy/SAY5.ogg","Greedy/SAY6.ogg","Greedy/SAY7.ogg","Greedy/SAY8.ogg"],
    SHOUT: ["Greedy/SHOUT1.ogg","Greedy/SHOUT2.ogg","Greedy/SHOUT3.ogg","Greedy/SHOUT4.ogg","Greedy/SHOUT5.ogg","Greedy/SHOUT6.ogg"]
};

/* ---------- PLANKTON SOUNDS ---------- */
const planktonSounds = {
    SAY: [],
    SHOUT: [],
    EXCITED: [],
    TIRED: [],
    PLAYFUL: []
};

/* ---------- DOUGLAS SOUNDS ---------- */
const douglasSounds = {
    SAY: [],
    SHOUT: [],
    EXCITED: [],
    TIRED: [],
    PLAYFUL: []
};

/* ---------- TUGBOAT SOUNDS ---------- */
const tugboatSounds = {
    SAY: [],
    SHOUT: [],
    EXCITED: [],
    TIRED: [],
    PLAYFUL: []
};

function updateSpawnSounds(){
    Object.keys(customNPCs).forEach(npcName => {
        if(customNPCs[npcName].spawnSound) npcSpawnSounds[npcName] = customNPCs[npcName].spawnSound;
    });
}

function updateDespawnSounds(){
    Object.keys(customNPCs).forEach(npcName => {
        if(customNPCs[npcName].despawnSound) npcDespawnSounds[npcName] = customNPCs[npcName].despawnSound;
    });
}

/* ---------- NPC BACKGROUND MUSIC ---------- */
const npcBackgroundMusic = {
    dave: null,
    penny: "Weenie/BACKGROUND.ogg",
    camo: "Camo/BACKGROUND.ogg",
    zomboss: "Zomboss/BACKGROUND.ogg",
    zombert: "Zombert/BACKGROUND.ogg",
    lucky: "Lucky/BACKGROUND.ogg",
    nanny: "Nanny/BACKGROUND.ogg",
    missinfo: "MissInfo/BACKGROUND.ogg",
    huntaria: "Huntaria/BACKGROUND.ogg",
    greedy: "Greedy/BACKGROUND.ogg",
    antibullysquad: "AntiBullySquad/BACKGROUND.ogg",
    spongebob: "Spongebob/BACKGROUND.mp3",
    plankton: "plankton/BACKGROUND.ogg",
    douglas: "douglas/BACKGROUND.ogg",
    tugboat: "tugboat/BACKGROUND.ogg"
};

// soldier uses camo background music; surfer none
npcBackgroundMusic['soldier'] = npcBackgroundMusic['camo'];

// Chimanta: intentionally no background music (front NPC with no bg)
npcBackgroundMusic['chimanta'] = null;

// Site-wide default background music (fallback when no NPC music is active)
let defaultBackgroundMusic = "BACKGROUND.mp3"; // place a file at this path or change to your preferred background file
// Add custom NPC background music
function updateBackgroundMusic() {
    Object.keys(customNPCs).forEach(npcName => {
        if (customNPCs[npcName].backgroundMusic) {
            npcBackgroundMusic[npcName] = customNPCs[npcName].backgroundMusic;
        }
    });
}

/* ---------- COMMON SFX FOLDER ---------- */
const commonSfxFolder = "sfx/"; // play sfx as sfx/{name}.ogg

async function playCommonSfx(name, volume = 1.0){
    if(!enableSfx) return null;
    if(!name) return null;

    try{
        if(name.startsWith('custom:') && !DBManager.db){
            await DBManager.init().catch(()=>{});
        }
        const cleanId = String(name).replace(/\W/g, '_');
        const elId = `commonSfx_${cleanId}_${Date.now()}`;
        const a = document.createElement('audio');
        a.id = elId;
        a.preload = 'auto';
        a.volume = volume;

        if(name.startsWith('custom:')){
            const customKey = name.slice('custom:'.length);
            const customFileRef = customSfxMap[customKey] || customKey;
            const customSrc = await DBManager.getFile('sfx', 'site', customFileRef);
            if(!customSrc){
                console.warn('Custom SFX not found in storage:', customKey);
                return null;
            }
            a.src = customSrc;
        } else {
            // Normalize filename: if no extension provided, try .ogg first, then .mp3
            let cleanName = name;
            if(!name.endsWith('.ogg') && !name.endsWith('.mp3')){
                cleanName = `${name}.ogg`;
            }

            // Try the primary filename first
            a.src = `${commonSfxFolder}${cleanName}`;

            // If it fails and we tried .ogg, try .mp3 as fallback
            a.onerror = ()=>{
                if(cleanName.endsWith('.ogg')){
                    const mp3Name = cleanName.replace(/\.ogg$/, '.mp3');
                    a.src = `${commonSfxFolder}${mp3Name}`;
                    a.load();
                    a.play().catch(err=>console.error('CommonSfx play error (both .ogg and .mp3 failed):', err.message));
                } else {
                    try{ a.remove(); }catch(e){}
                }
            };
        }

        a.onended = ()=>{ try{ a.remove(); }catch(e){} };
        document.body.appendChild(a);
        a.play().catch(e=>console.error('CommonSfx play error:', e.message));
        return a;
    }catch(e){ console.error('playCommonSfx error', e); return null; }
}

/* ---------- NPC SOUNDS LOOKUP ---------- */
function getNpcSounds(npc, emotion, voiceVariantOverride){
    emotion = emotion || 'SAY';
    
    // Note: Custom NPC voice lines now use IndexedDB and are handled in playNPCSound
    // This function is for built-in NPC sounds only
    
    // Dave voice variants (use override if provided, otherwise check selector)
    if(npc === 'dave'){
        const voiceVariant = voiceVariantOverride || document.getElementById('voiceVariant')?.value || 'default';
        if(daveSoundsVariants[voiceVariant]){
            return daveSoundsVariants[voiceVariant][emotion] || [];
        }
        return daveSounds[emotion] || [];
    }
    
    // Default NPC sounds
    if(npc === 'penny') return pennySounds[emotion] || [];
    if(npc === 'chimanta') return chimantaSounds[emotion] || [];
    if(npc === 'spongebob') return spongebobSounds[emotion] || [];
    // soldier uses camo's voice/emotions
    if(npc === 'soldier') return camoSounds[emotion] || [];
    // surfer has no voice
    if(npc === 'surfer') return [];
    if(npc === 'camo') return camoSounds[emotion] || [];
    if(npc === 'zomboss') return zombossSounds[emotion] || [];
    if(npc === 'lucky') return luckySounds[emotion] || [];  
    if(npc === 'zombert') return zombertSounds[emotion] || [];
    if(npc === 'nanny') return nannySounds[emotion] || [];
    if(npc === 'huntaria') return huntariaSounds[emotion] || [];
    if(npc === 'antibullysquad') return ABS[emotion] || [];
    if(npc === 'missinfo') return missinfo[emotion] || [];
    if(npc === 'greedy') return greedySounds[emotion] || [];
    if(npc === 'plankton') return planktonSounds[emotion] || [];
    if(npc === 'douglas') return douglasSounds[emotion] || [];
    if(npc === 'tugboat') return tugboatSounds[emotion] || [];
    return [];
}

// Helper: set NPC image according to emotion (supports customNPCs images mapping, ABS, Zombert skin, and Dave skins including N3XT)
async function setNpcImageForEmotion(npcName, emotion, skinVariantOverride){
    try{
        const el = npcs[npcName];
        if(!el) return;
        const up = (emotion||'SAY').toUpperCase();
        
        // Handle ABS (AntiBullySquad) with instant image swap (no transition)
        if(npcName === 'antibullysquad'){
            // Disable transition temporarily for instant swap
            el.style.transition = 'none';
            // Set image path based on emotion
            el.src = `AntiBullySquad/${up}.png`;
            // Re-enable transition after swap
            setTimeout(()=>{ el.style.transition = 'opacity 0.35s ease, transform 0.35s ease'; }, 10);
            return;
        }
        
        // Handle Dave skin variants (including N3XT which uses emotion-based sprites like ABS)
        if(npcName === 'dave'){
            // Use skinVariantOverride if provided (from line object), otherwise use selector value
            const skinVariant = skinVariantOverride || document.getElementById('skinVariant')?.value || 'default';
            
            // Remove all Dave skin classes first
            el.classList.remove('n3xt-skin', 'birthday-skin');
            
            // Add or remove skin-specific classes and handle N3XT emotion-based sprites
            if(skinVariant === 'n3xt'){
                el.classList.add('n3xt-skin');
                el.style.transition = 'none';
                // N3XT uses emotion-based sprites: use n3xtsay as idle, n3xtshout for SHOUT, n3xttired for TIRED
                const imageName = up === 'SHOUT' ? 'n3xtshout' : (up === 'TIRED' ? 'n3xttired' : 'n3xtsay');
                el.src = `Dave/${imageName}.png`;
                setTimeout(()=>{ el.style.transition = 'opacity 0.35s ease, transform 0.35s ease'; }, 10);
            } else {
                // Add class for size adjustments (birthday, etc)
                if(skinVariant === 'birthday'){
                    el.classList.add('birthday-skin');
                }
                // Regular Dave skins use single image
                el.src = daveSkinVariants[skinVariant] || 'Dave.png';
            }
            return;
        }
        
        // Handle Zombert skin variants
        if(npcName === 'zombert'){
            // Use skinVariantOverride if provided (from line object), otherwise use selector value
            const skinVariant = skinVariantOverride || document.getElementById('skinVariant')?.value || 'default';
            el.src = zombertSkinVariants[skinVariant] || 'Zombert.png';
            return;
        }

        // Handle Lucky skin variants
        if(npcName === 'lucky'){
            const skinVariant = skinVariantOverride || document.getElementById('skinVariant')?.value || 'default';
            el.src = luckySkinVariants[skinVariant] || 'Lucky.png';
            return;
        }

        // Handle MissInfo skin variants
        if(npcName === 'missinfo'){
            const skinVariant = skinVariantOverride || document.getElementById('skinVariant')?.value || 'default';
            el.src = missinfoSkinVariants[skinVariant] || 'MissInfo.png';
            return;
        }
        
        // Handle SpongeBob with emotion-based sprites (like ABS)
        if(npcName === 'spongebob'){
            el.style.transition = 'none';
            // Set image path based on emotion
            el.src = `Spongebob/${up.toLowerCase()}.png`;
            // Re-enable transition after swap
            setTimeout(()=>{ el.style.transition = 'opacity 0.35s ease, transform 0.35s ease'; }, 10);
            return;
        }
        
        // Handle Tugboat with emotion-based sprites (like ABS)
        if(npcName === 'tugboat'){
            el.style.transition = 'none';
            // Set image path based on emotion
            el.src = `tugboat/${up.toLowerCase()}.png`;
            // Re-enable transition after swap
            setTimeout(()=>{ el.style.transition = 'opacity 0.35s ease, transform 0.35s ease'; }, 10);
            return;
        }
        
        // Handle custom NPCs with image mapping (now using IndexedDB references)
        const data = customNPCs[npcName];
        if(data && data.imageReferences){
            // exact match
            if(data.imageReferences[up]){ 
                const imageData = await DBManager.getFile('image', npcName, data.imageReferences[up]);
                if(imageData){ el.src = imageData; return; }
            }
            // find any key that contains emotion
            const foundKey = Object.keys(data.imageReferences).find(k=>k.includes(up));
            if(foundKey){ 
                const imageData = await DBManager.getFile('image', npcName, data.imageReferences[foundKey]);
                if(imageData){ el.src = imageData; return; }
            }
            // fallback to SHOUT image
            if(data.imageReferences['SHOUT']){ 
                const imageData = await DBManager.getFile('image', npcName, data.imageReferences['SHOUT']);
                if(imageData){ el.src = imageData; return; }
            }
            // default
            if(data.imageReferences['DEFAULT']){ 
                const imageData = await DBManager.getFile('image', npcName, data.imageReferences['DEFAULT']);
                if(imageData){ el.src = imageData; return; }
            }
        }
    }catch(e){ console.log('setNpcImageForEmotion error', e); }
}

/* ---------- FONT PREVIEW & VARIANT CONTROLS ---------- */
speakerSel.addEventListener("change", ()=>{
    const speaker = speakerSel.value;
    const fontFamily = getNpcFont(speaker) || "Arial,sans-serif";
    textInput.style.fontFamily = fontFamily;
    const color = customNpcColors[speaker] || "white";
    textInput.style.color = color;
    
    // Show/hide voice variant selector (only for Dave)
    const voiceVariantLabel = document.getElementById('voiceVariantLabel');
    const voiceVariantSel = document.getElementById('voiceVariant');
    if(speaker === 'dave'){
        voiceVariantLabel.style.display = 'block';
        voiceVariantSel.style.display = 'block';
    } else {
        voiceVariantLabel.style.display = 'none';
        voiceVariantSel.style.display = 'none';
    }
    
    // Show/hide and populate skin variant selector
    const skinVariantLabel = document.getElementById('skinLabel');
    const skinVariantSel = document.getElementById('skinVariant');
    if(speaker === 'dave'){
        skinVariantLabel.style.display = 'block';
        skinVariantSel.style.display = 'block';
        // Populate with Dave skins
        skinVariantSel.innerHTML = '';
        Object.keys(daveSkinVariants).forEach(skinKey => {
            const option = document.createElement('option');
            option.value = skinKey;
            option.textContent = skinKey.charAt(0).toUpperCase() + skinKey.slice(1);
            skinVariantSel.appendChild(option);
        });
    } else if(speaker === 'zombert'){
        skinVariantLabel.style.display = 'block';
        skinVariantSel.style.display = 'block';
        // Populate with Zombert skins
        skinVariantSel.innerHTML = '';
        Object.keys(zombertSkinVariants).forEach(skinKey => {
            const option = document.createElement('option');
            option.value = skinKey;
            option.textContent = skinKey.charAt(0).toUpperCase() + skinKey.slice(1);
            skinVariantSel.appendChild(option);
        });
    } else if(speaker === 'lucky'){
        skinVariantLabel.style.display = 'block';
        skinVariantSel.style.display = 'block';
        // Populate with Lucky skins
        skinVariantSel.innerHTML = '';
        Object.keys(luckySkinVariants).forEach(skinKey => {
            const option = document.createElement('option');
            option.value = skinKey;
            option.textContent = skinKey.charAt(0).toUpperCase() + skinKey.slice(1);
            skinVariantSel.appendChild(option);
        });
    } else if(speaker === 'missinfo'){
        skinVariantLabel.style.display = 'block';
        skinVariantSel.style.display = 'block';
        // Populate with MissInfo skins
        skinVariantSel.innerHTML = '';
        Object.keys(missinfoSkinVariants).forEach(skinKey => {
            const option = document.createElement('option');
            option.value = skinKey;
            option.textContent = skinKey.charAt(0).toUpperCase() + skinKey.slice(1);
            skinVariantSel.appendChild(option);
        });
    } else {
        skinVariantLabel.style.display = 'none';
        skinVariantSel.style.display = 'none';
    }
    // Disable emotion options that have no voice files for the selected NPC (except SILENT)
    try{
        const emotionSel = document.getElementById('emotion');
        if(emotionSel){
            Array.from(emotionSel.options).forEach(opt=>{
                const val = opt.value;
                if(!val) return;
                if(val === 'SILENT') { opt.disabled = false; return; }

                let available = false;

                // Check custom NPC voice references (IndexedDB-backed)
                if(customNPCs[speaker] && customNPCs[speaker].voiceReferences){
                    const refs = customNPCs[speaker].voiceReferences;
                    const emotionFiles = Object.keys(refs).filter(k =>
                        k.toUpperCase().startsWith(val.toUpperCase()) || k.toUpperCase().includes(val.toUpperCase())
                    );
                    if(emotionFiles.length > 0) available = true;
                }

                // Fallback to built-in sounds
                if(!available){
                    try{
                        const sounds = getNpcSounds(speaker, val);
                        if(sounds && sounds.length > 0) available = true;
                    }catch(e){}
                }

                opt.disabled = !available;
            });

            // If currently-selected emotion is disabled, switch to SILENT or first enabled
            if(emotionSel.value && emotionSel.selectedOptions && emotionSel.selectedOptions[0] && emotionSel.selectedOptions[0].disabled){
                const silentOpt = Array.from(emotionSel.options).find(o=>o.value==='SILENT');
                if(silentOpt) emotionSel.value = 'SILENT';
                else{
                    const firstEnabled = Array.from(emotionSel.options).find(o=>!o.disabled);
                    if(firstEnabled) emotionSel.value = firstEnabled.value;
                }
            }
        }
    }catch(e){ /* non-fatal */ }
});
speakerSel.dispatchEvent(new Event("change"));

/* Note: Skin variant selector changes are now only used for ADDING new lines.
   During playback, each line's skinVariant property controls Dave's appearance. */

/* ========== CUSTOM NPC CREATOR ========== */

const customNpcNameInput = document.getElementById("customNpcName");
const customNpcImageInput = document.getElementById("customNpcImage");
const customNpcFontSelect = document.getElementById("customNpcFontSelect");
const customNpcFontFileInput = document.getElementById("customNpcFontFile");
const customNpcTextColorInput = document.getElementById("customNpcTextColor");
const voiceFilesInput = document.getElementById("voiceFilesInput");
const voiceLinesContainer = document.getElementById("voiceLinesContainer");
const voiceFilesList = document.getElementById("voiceFilesList");
const createNpcBtn = document.getElementById("createNpcBtn");
const customNpcPosition = document.getElementById("customNpcPosition");
const enableMusicEl = document.getElementById('enableMusic');
const enableSfxEl = document.getElementById('enableSfx');
const importLawnFile = document.getElementById('importLawnFile');
const importCustomSfxFilesInput = document.getElementById('importCustomSfxFiles');
const customSfxListEl = document.getElementById('customSfxList');

let pendingVoiceFiles = {};

function normalizeCustomSfxKey(fileName){
    return String(fileName || '')
        .replace(/\.[^/.]+$/, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');
}

function refreshCustomSfxUi(){
    const sfxSel = document.getElementById('sfxSelect');
    const keys = Object.keys(customSfxMap).sort();

    if(sfxSel){
        Array.from(sfxSel.querySelectorAll('option[data-custom-sfx="1"]')).forEach(opt=>opt.remove());
        if(keys.length > 0){
            const separator = document.createElement('option');
            separator.value = '';
            separator.textContent = '--- Custom Imported SFX ---';
            separator.disabled = true;
            separator.dataset.customSfx = '1';
            sfxSel.appendChild(separator);

            keys.forEach(key=>{
                const option = document.createElement('option');
                option.value = `custom:${key}`;
                option.textContent = `[Custom] ${key}`;
                option.dataset.customSfx = '1';
                sfxSel.appendChild(option);
            });
        }
    }

    if(customSfxListEl){
        if(keys.length === 0){
            customSfxListEl.textContent = 'No custom SFX imported';
        } else {
            customSfxListEl.innerHTML =
                "<p style='color:#4CAF50; margin:0;'>" + keys.length + " custom SFX ready</p>" +
                "<ul style='text-align:left; margin:5px 0; padding-left:20px;'>" +
                keys.map(key=>"<li>" + key + "</li>").join('') +
                "</ul>";
        }
    }
}

async function importCustomSfxFiles(files){
    const audioFiles = Array.from(files || []).filter(file => file && file.type && file.type.startsWith('audio/'));
    if(audioFiles.length === 0){
        alert('Please select at least one audio file for custom SFX.');
        return;
    }
    if(!DBManager.db){
        await DBManager.init().catch(()=>{});
    }

    const readAudioFile = (file)=>new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = (ev)=>resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    let importedCount = 0;
    for(const file of audioFiles){
        const key = normalizeCustomSfxKey(file.name);
        if(!key) continue;
        const dataUrl = await readAudioFile(file);
        await DBManager.saveFile('sfx', 'site', key, dataUrl);
        customSfxMap[key] = key;
        importedCount++;
    }

    localStorage.setItem('customSfxMap', JSON.stringify(customSfxMap));
    refreshCustomSfxUi();
    alert(importedCount + ' custom SFX imported successfully.');
}

// Populate font selector with available fonts
const availableFonts = {
    "Arial": "Arial",
    "Annabel": "Annabel",
    "AshleyScript": "Ashley Script",
    "Blackadder": "Blackadder",
    "BrianneHand": "Brianne's Hand",
    "Century751BTBold": "Century 751 Bold",
    "Cromagnum": "Cromagnum",
    "Didot": "Didot",
    "HouseOfTerror": "House of Terror",
    "InformalRoman": "Informal Roman",
    "KrustyKrab": "Krusty Krab",
    "NewsFlashBB": "News Flash BB",
    "ROGLyonsType": "ROG Lyons Type",
    "RockwellCondensed": "Rockwell Condensed",
    "UnmaskedBB": "UnmaskedBB"
};


function populateFontSelector(){
    // Clear existing options except "Upload Custom Font"
    customNpcFontSelect.innerHTML = '';
    Object.entries(availableFonts).forEach(([fontId, fontLabel])=>{
        const option = document.createElement('option');
        option.value = fontId;
        option.textContent = fontLabel;
        customNpcFontSelect.appendChild(option);
    });
    // Add custom upload option
    const uploadOption = document.createElement('option');
    uploadOption.value = 'custom-upload';
    uploadOption.textContent = 'Upload Custom Font';
    customNpcFontSelect.appendChild(uploadOption);
}

populateFontSelector();

// Toggle visibility for the Custom NPC Creator section (button added in HTML)
try{
    const npcCreatorSection = document.getElementById('npcCreatorSection');
    const toggleBtn = document.getElementById('toggleNpcCreatorBtn');
    if(npcCreatorSection && toggleBtn){
        // Ensure initial state matches HTML (HTML hides by default)
        npcCreatorSection.style.display = npcCreatorSection.style.display || 'none';
        toggleBtn.addEventListener('click', ()=>{
            const isHidden = npcCreatorSection.style.display === 'none' || npcCreatorSection.style.display === '';
            if(isHidden){
                npcCreatorSection.style.display = 'block';
                toggleBtn.textContent = 'Hide Custom NPC Creator';
            } else {
                npcCreatorSection.style.display = 'none';
                toggleBtn.textContent = 'Show Custom NPC Creator';
            }
        });
    }
}catch(e){ /* non-fatal */ }

// Show font file input when custom font is selected
customNpcFontSelect.addEventListener("change", ()=>{
    if(customNpcFontSelect.value === "custom-upload"){
        customNpcFontFileInput.style.display = "block";
        customNpcFontFileInput.click();
    }
});

customNpcFontFileInput.addEventListener("change", (e)=>{
    if(e.target.files[0]){
        console.log("Font file selected:", e.target.files[0].name);
    }
});

// Drag and drop for voice files
voiceLinesContainer.addEventListener("dragover", (e)=>{
    e.preventDefault();
    voiceLinesContainer.style.borderColor = "#4CAF50";
    voiceLinesContainer.style.background = "#3a3a3a";
});

voiceLinesContainer.addEventListener("dragleave", (e)=>{
    voiceLinesContainer.style.borderColor = "#555";
    voiceLinesContainer.style.background = "#2a2a2a";
});

voiceLinesContainer.addEventListener("drop", (e)=>{
    e.preventDefault();
    voiceLinesContainer.style.borderColor = "#555";
    voiceLinesContainer.style.background = "#2a2a2a";
    handleVoiceFiles(e.dataTransfer.files);
});

voiceLinesContainer.addEventListener("click", ()=>{
    voiceFilesInput.click();
});

voiceFilesInput.addEventListener("change", (e)=>{
    handleVoiceFiles(e.target.files);
});

if(importCustomSfxFilesInput){
    importCustomSfxFilesInput.addEventListener('change', async (e)=>{
        try{
            await importCustomSfxFiles(e.target.files);
        }catch(err){
            console.error('Custom SFX import failed:', err);
            alert('Error importing custom SFX: ' + err.message);
        }finally{
            e.target.value = '';
        }
    });
}
refreshCustomSfxUi();

// toggles
if(enableMusicEl){
    enableMusicEl.checked = enableMusic;
    enableMusicEl.addEventListener('change', ()=>{
        enableMusic = !!enableMusicEl.checked;
        localStorage.setItem('enableMusic', JSON.stringify(enableMusic));
    });
}
if(enableSfxEl){
    enableSfxEl.checked = enableSfx;
    enableSfxEl.addEventListener('change', ()=>{
        enableSfx = !!enableSfxEl.checked;
        localStorage.setItem('enableSfx', JSON.stringify(enableSfx));
    });
}

// Import lawn file - use IndexedDB to avoid localStorage bloat
if(importLawnFile){
    importLawnFile.addEventListener('change', (e)=>{
        const f = e.target.files[0];
        if(!f) return;
        const reader = new FileReader();
        reader.onload = async (ev)=>{
            const url = ev.target.result;
            const lawn = document.getElementById('lawn');
            if(lawn){
                lawn.style.backgroundImage = `url('${url}')`;
                // Save to IndexedDB instead of localStorage
                try {
                    await DBManager.saveFile('lawn', 'site', 'background', url);
                    localStorage.setItem('customLawn', 'indexed'); // Just a marker that lawn is in IndexedDB
                } catch(err) {
                    console.log('Error saving lawn to IndexedDB:', err);
                }
            }
        };
        reader.readAsDataURL(f);
    });
    // Load saved lawn from IndexedDB
    const savedLawnMarker = localStorage.getItem('customLawn');
    if(savedLawnMarker === 'indexed'){
        try {
            DBManager.getFile('lawn', 'site', 'background').then(lawnData=>{
                if(lawnData){
                    const lawn = document.getElementById('lawn');
                    if(lawn) lawn.style.backgroundImage = `url('${lawnData}')`;
                }
            });
        } catch(err) {
            console.log('Error loading lawn from IndexedDB:', err);
        }
    }
}

// Import background music file - use IndexedDB to avoid localStorage bloat
const importBgMusicFile = document.getElementById('importBgMusicFile');
if(importBgMusicFile){
    importBgMusicFile.addEventListener('change', (e)=>{
        const f = e.target.files[0];
        if(!f) return;
        const reader = new FileReader();
        reader.onload = async (ev)=>{
            const url = ev.target.result;
            try {
                // Save to IndexedDB
                await DBManager.saveFile('bgMusic', 'site', 'default', url);
                localStorage.setItem('customBgMusic', 'indexed'); // Marker that bg music is in IndexedDB
                // Update the default background music to use the custom one
                defaultBackgroundMusic = url;
                console.log('Background music updated successfully');
            } catch(err) {
                console.log('Error saving background music to IndexedDB:', err);
            }
        };
        reader.readAsDataURL(f);
    });
    // Load saved background music from IndexedDB on startup (after DBManager init delay)
    setTimeout(async ()=>{
        const savedBgMusicMarker = localStorage.getItem('customBgMusic');
        if(savedBgMusicMarker === 'indexed'){
            try {
                const bgMusicData = await DBManager.getFile('bgMusic', 'site', 'default');
                if(bgMusicData){
                    defaultBackgroundMusic = bgMusicData;
                    console.log('Custom background music loaded from IndexedDB');
                }
            } catch(err) {
                console.log('Error loading background music from IndexedDB:', err);
            }
        }
    }, 1000);
    
    // Clear all site data button
    const clearAllDataBtn = document.getElementById('clearAllDataBtn');
    if(clearAllDataBtn){
        clearAllDataBtn.addEventListener('click', async ()=>{
            if(!confirm('Are you sure? This will delete ALL saved data:\n- Custom NPCs\n- Background music\n- Lawn background\n- All settings')) {
                return;
            }
            
            try {
                // Clear localStorage
                localStorage.clear();
                
                // Clear IndexedDB
                const dbNames = ['DialogueMakerDB'];
                for(let dbName of dbNames){
                    try {
                        const req = indexedDB.deleteDatabase(dbName);
                        await new Promise((resolve, reject)=>{
                            req.onsuccess = resolve;
                            req.onerror = reject;
                        });
                    } catch(e) {
                        console.log('Error deleting IndexedDB:', e);
                    }
                }
                
                // Clear cookies
                document.cookie.split(";").forEach((c)=>{
                    const eqPos = c.indexOf("=");
                    const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;";
                });
                
                console.log('All data cleared');
                alert('All site data cleared! The page will refresh.');
                location.reload();
            } catch(err) {
                console.error('Error clearing data:', err);
                alert('Error clearing data: ' + err.message);
            }
        });
    }
}

function handleVoiceFiles(files){
    const fileArray = Array.from(files);
    pendingVoiceFiles = {};
    
    fileArray.forEach(file => {
        if(file.type.startsWith("audio/")){
            const name = file.name.toUpperCase().replace(/\.[^/.]+$/, "");
            const reader = new FileReader();
            reader.onload = (e) => {
                pendingVoiceFiles[name] = e.target.result;
                displayVoiceFiles();
            };
            reader.readAsDataURL(file);
        }
    });
}

function displayVoiceFiles(){
    const list = Object.keys(pendingVoiceFiles);
    if(list.length === 0){
        voiceFilesList.innerHTML = "<p style='color: #888;'>No voice files added</p>";
    } else {
        voiceFilesList.innerHTML = "<p style='color: #4CAF50;'>✓ " + list.length + " voice files ready:</p>" +
            "<ul style='text-align: left; margin: 5px 0; padding-left: 20px;'>" +
            list.map(name => "<li>" + name + "</li>").join("") +
            "</ul>";
    }
}

// Create NPC
createNpcBtn.addEventListener("click", async ()=>{
    const npcName = customNpcNameInput.value.trim().toLowerCase();
    
    if(!npcName){
        alert("Please enter an NPC name");
        return;
    }
    
    if(!customNpcImageInput.files || customNpcImageInput.files.length === 0){
        alert("Please select at least one PNG image");
        return;
    }

    try {
        // Read all image files as data URLs
        const files = Array.from(customNpcImageInput.files);
        const readImage = (file) => new Promise((res, rej)=>{
            const r = new FileReader();
            r.onload = (ev)=>res({name: file.name, url: ev.target.result});
            r.onerror = rej;
            r.readAsDataURL(file);
        });
        const images = await Promise.all(files.map(readImage));

        // Read font file if provided
        let fontData = null;
        let fontName = customNpcFontSelect.value;
        if(customNpcFontFileInput.files[0]){
            const fontReader = new FileReader();
            fontReader.onload = async (fe) => {
                fontData = fe.target.result;
                fontName = npcName + "Font";
                
                // Read intro audio file if provided
                let introAudioData = null;
                const customNpcIntroFile = document.getElementById('customNpcIntroFile');
                if(customNpcIntroFile && customNpcIntroFile.files[0]){
                    introAudioData = await new Promise((res, rej)=>{
                        const r = new FileReader();
                        r.onload = (ev)=>res(ev.target.result);
                        r.onerror = rej;
                        r.readAsDataURL(customNpcIntroFile.files[0]);
                    });
                }
                
                // Read background music file if provided
                let bgMusicData = null;
                const customNpcBgMusicFile = document.getElementById('customNpcBgMusicFile');
                if(customNpcBgMusicFile && customNpcBgMusicFile.files[0]){
                    bgMusicData = await new Promise((res, rej)=>{
                        const r = new FileReader();
                        r.onload = (ev)=>res(ev.target.result);
                        r.onerror = rej;
                        r.readAsDataURL(customNpcBgMusicFile.files[0]);
                    });
                }
                
                finializeNpcCreation(npcName, images, fontName, fontData, introAudioData, bgMusicData);
            };
            fontReader.readAsDataURL(customNpcFontFileInput.files[0]);
        } else {
            // Read intro audio file if provided
            let introAudioData = null;
            const customNpcIntroFile = document.getElementById('customNpcIntroFile');
            if(customNpcIntroFile && customNpcIntroFile.files[0]){
                introAudioData = await new Promise((res, rej)=>{
                    const r = new FileReader();
                    r.onload = (ev)=>res(ev.target.result);
                    r.onerror = rej;
                    r.readAsDataURL(customNpcIntroFile.files[0]);
                });
            }
            
            // Read background music file if provided
            let bgMusicData = null;
            const customNpcBgMusicFile = document.getElementById('customNpcBgMusicFile');
            if(customNpcBgMusicFile && customNpcBgMusicFile.files[0]){
                bgMusicData = await new Promise((res, rej)=>{
                    const r = new FileReader();
                    r.onload = (ev)=>res(ev.target.result);
                    r.onerror = rej;
                    r.readAsDataURL(customNpcBgMusicFile.files[0]);
                });
            }
            
            finializeNpcCreation(npcName, images, fontName, null, introAudioData, bgMusicData);
        }
    } catch (error) {
        alert("Error creating NPC: " + error.message);
    }
});

async function finializeNpcCreation(npcName, imagesArray, fontName, fontData, introAudioData, bgMusicData){
    try {
        // Store images in IndexedDB, keep only references in metadata
        const imageReferences = {};
        for(let it of imagesArray){
            const base = it.name.replace(/\.[^/.]+$/, "").toUpperCase();
            imageReferences[base] = base; // Store as reference key
            // Save actual image data to IndexedDB
            await DBManager.saveFile('image', npcName, base, it.url);
        }
        imageReferences['DEFAULT'] = imagesArray[0].name.replace(/\.[^/.]+$/, "").toUpperCase();
        
        // Store voice files in IndexedDB, keep only references
        const voiceReferences = {};
        for(let [name, data] of Object.entries(pendingVoiceFiles)){
            voiceReferences[name] = name;
            await DBManager.saveFile('voice', npcName, name, data);
        }
        
        // Store intro audio in IndexedDB if provided
        if(introAudioData){
            await DBManager.saveFile('intro', npcName, 'INTRO', introAudioData);
        }
        
        // Store background music in IndexedDB if provided
        if(bgMusicData){
            await DBManager.saveFile('bgMusic', npcName, 'BACKGROUND', bgMusicData);
        }
        
        // Store font in IndexedDB if provided
        if(fontData){
            await DBManager.saveFile('font', npcName, fontName, fontData);
            customNpcFonts[npcName] = fontName;
            // Create a new <style> tag for the @font-face rule
            const fontFormat = customNpcFontFileInput.files[0].name.endsWith('.otf') ? 'opentype' : 'truetype';
            const fontRule = `@font-face { font-family: "${fontName}"; src: url('${fontData}') format('${fontFormat}'); }`;
            const styleEl = document.createElement('style');
            styleEl.textContent = fontRule;
            document.head.appendChild(styleEl);
        } else {
            customNpcFonts[npcName] = fontName;
        }
        
        // Store only metadata in localStorage, files are in IndexedDB
        customNPCs[npcName] = {
            imageReferences: imageReferences,  // References to IndexedDB keys, not data URLs
            voiceReferences: voiceReferences,   // References to IndexedDB keys
            font: fontName,
            textColor: customNpcTextColorInput.value,
            position: (customNpcPosition && customNpcPosition.value) ? customNpcPosition.value : 'back',
            hasIntroSound: introAudioData ? true : false,
            hasBackgroundMusic: bgMusicData ? true : false
        };
        
        customNpcColors[npcName] = customNpcTextColorInput.value;
        
        // Save metadata to IndexedDB
        await DBManager.saveNpcMetadata(npcName, customNPCs[npcName]);
        
        // Save only small metadata to localStorage
        localStorage.setItem("customNPCs", JSON.stringify(customNPCs));
        localStorage.setItem("customNpcFonts", JSON.stringify(customNpcFonts));
        localStorage.setItem("customNpcColors", JSON.stringify(customNpcColors));
        
        // Create NPC element in game and speaker dropdown
        createCustomNpcElement(npcName, customNPCs[npcName]);
        addNpcToSpeakerDropdown(npcName);
        updateCustomNpcList();
        
        // Reset form
        customNpcNameInput.value = "";
        customNpcImageInput.value = "";
        customNpcFontSelect.value = "Arial";
        customNpcFontFileInput.value = "";
        const customNpcIntroFile = document.getElementById('customNpcIntroFile');
        const customNpcBgMusicFile = document.getElementById('customNpcBgMusicFile');
        if(customNpcIntroFile) customNpcIntroFile.value = "";
        if(customNpcBgMusicFile) customNpcBgMusicFile.value = "";
        customNpcTextColorInput.value = "#FFFFFF";
        voiceFilesInput.value = "";
        pendingVoiceFiles = {};
        displayVoiceFiles();
        
        alert(" NPC '" + npcName + "' created successfully!");
    } catch(error){
        alert("Error saving NPC: " + error.message);
        console.error(error);
    }
}

async function getCustomNpcDefaultImage(npcName, npcData){
    if(!npcData) return '';

    if(npcData.imageReferences){
        if(!DBManager.db){
            await DBManager.init().catch(()=>{});
        }
        const defaultKey = npcData.imageReferences.DEFAULT || Object.values(npcData.imageReferences)[0];
        if(defaultKey){
            try{
                const imageData = await DBManager.getFile('image', npcName, defaultKey);
                if(imageData) return imageData;
            }catch(e){
                console.log('Error loading custom NPC default image:', e.message);
            }
        }
    }

    if(npcData.images){
        return npcData.images.DEFAULT || Object.values(npcData.images)[0] || '';
    }

    return '';
}

function createCustomNpcElement(npcName, npcData){
    let npcImg = document.getElementById(npcName);
    const gameDiv = document.getElementById("game");
    if(!gameDiv) return;

    if(!npcImg){
        npcImg = document.createElement("img");
        npcImg.id = npcName;
        npcImg.className = "npc hide";
        gameDiv.appendChild(npcImg);
    }
    npcs[npcName] = npcImg;

    const pos = (npcData && npcData.position) ? npcData.position : 'back';
    npcImg.classList.remove('front', 'back');
    if(pos === 'front'){
        npcImg.classList.add('front');
        absTypeNpcs.delete(npcName);
    } else {
        npcImg.classList.add('back');
        if(pos === 'abs') absTypeNpcs.add(npcName);
        else absTypeNpcs.delete(npcName);
    }

    getCustomNpcDefaultImage(npcName, npcData).then(src=>{
        if(src) npcImg.src = src;
    }).catch(()=>{});
}

// Ensure an NPC element exists (create placeholder or custom NPC element)
function ensureNpcExists(npcName){
    if(!npcName) return;
    if(npcs[npcName]) return;
    const gameDiv = document.getElementById('game');
    if(!gameDiv) return;
    // If custom NPC data exists, create with that data
    if(customNPCs[npcName]){
        createCustomNpcElement(npcName, customNPCs[npcName]);
        return;
    }
    // create a placeholder img so code that expects an element won't crash
    const img = document.createElement('img');
    img.id = npcName;
    img.className = 'npc hide';
    img.src = ''; // no image available
    gameDiv.appendChild(img);
    npcs[npcName] = img;
}

// Fade helpers
function fadeInElement(el, displayType){
    if(!el) return;
    // cancel any pending fadeOut fallback
    try{ if(el._fadeTimeout) { clearTimeout(el._fadeTimeout); el._fadeTimeout = null; } }catch(e){}
    if(el._fadeOnEnd){ try{ el.removeEventListener('transitionend', el._fadeOnEnd); }catch(e){} el._fadeOnEnd = null; }
    el.style.display = displayType || 'block';
    el.classList.remove('hide');
    // force reflow
    void el.offsetWidth;
    el.classList.add('show');
}

function fadeOutElement(el, cb){
    if(!el) { if(cb) cb(); return; }
    // clear any previous fallback/listener
    try{ if(el._fadeTimeout) { clearTimeout(el._fadeTimeout); el._fadeTimeout = null; } }catch(e){}
    if(el._fadeOnEnd){ try{ el.removeEventListener('transitionend', el._fadeOnEnd); }catch(e){} el._fadeOnEnd = null; }

    el.classList.remove('show');
    el.classList.add('hide');
    const onEnd = (e)=>{
        if(e && e.target !== el) return;
        el.style.display = 'none';
        try{ el.removeEventListener('transitionend', onEnd); }catch(e){}
        el._fadeOnEnd = null;
        if(cb) cb();
    };
    el._fadeOnEnd = onEnd;
    el.addEventListener('transitionend', onEnd);
    // fallback in case element has no transition
    el._fadeTimeout = setTimeout(()=>{
        if(window.getComputedStyle(el).display !== 'none'){
            el.style.display='none';
            if(cb) cb();
        }
        el._fadeTimeout = null;
    }, 500);
}

function addNpcToSpeakerDropdown(npcName){
    if(![...speakerSel.options].some(opt => opt.value === npcName)){
        const option = document.createElement("option");
        option.value = npcName;
        option.textContent = npcName.charAt(0).toUpperCase() + npcName.slice(1);
        speakerSel.appendChild(option);
    }
}

// Load custom NPCs on startup
function loadCustomNpcs(){
    updateIntroSounds();
    updateBackgroundMusic();
    updateSpawnSounds();
    updateDespawnSounds();
    // Ensure built-in NPC elements have front/back classes (include variants)
    DAVE_VARIANTS.forEach(n => { if(npcs[n]) npcs[n].classList.add('front'); });
    PENNY_VARIANTS.forEach(n => { if(npcs[n]) npcs[n].classList.add('front'); if(n === 'penny') npcs[n].classList.add('right'); if(n === 'surfer') npcs[n].classList.add('right'); });
    if(npcs.antibullysquad) npcs.antibullysquad.classList.add('back');
    if(npcs.zombert) npcs.zombert.classList.add('back');
    if(npcs.spongebob) { npcs.spongebob.classList.add('front'); npcs.spongebob.classList.add('right'); }
    if(npcs.tugboat) { npcs.tugboat.classList.add('front'); }  // Left side
    if(npcs.plankton) { npcs.plankton.classList.add('front'); npcs.plankton.classList.add('right'); }
    if(npcs.douglas) { npcs.douglas.classList.add('front'); npcs.douglas.classList.add('right'); }
    Object.keys(customNPCs).forEach(npcName => {
        createCustomNpcElement(npcName, customNPCs[npcName]);
        addNpcToSpeakerDropdown(npcName);
    });
    updateCustomNpcList();
}

function updateCustomNpcList(){
    const listContainer = document.getElementById('customNpcList');
    if(!listContainer) return;
    
    const npcNames = Object.keys(customNPCs);
    if(npcNames.length === 0){
        listContainer.innerHTML = '<p style="color: #888; margin: 0; text-align: center;">No custom NPCs created yet</p>';
        return;
    }
    
    listContainer.innerHTML = '';
    npcNames.forEach(npcName => {
        const item = document.createElement('div');
        item.className = 'custom-npc-item';
        item.innerHTML = `
            <span class="npc-name">${npcName.charAt(0).toUpperCase() + npcName.slice(1)}</span>
            <button class="remove-btn" onclick="removeCustomNpc('${npcName}')">Remove</button>
        `;
        listContainer.appendChild(item);
    });
}

async function removeCustomNpc(npcName){
    if(!confirm(`Remove custom NPC "${npcName}"?`)) return;

    try{
        if(!DBManager.db){
            await DBManager.init().catch(()=>{});
        }
        await DBManager.deleteNpcFiles(npcName);
        await DBManager.deleteNpcMetadata(npcName);

        delete customNPCs[npcName];
        delete customNpcFonts[npcName];
        delete customNpcColors[npcName];

        // Remove from intro/background mappings
        delete npcIntroSounds[npcName];
        delete npcBackgroundMusic[npcName];
        delete npcSpawnSounds[npcName];
        delete npcDespawnSounds[npcName];

        // Remove from speaker dropdown
        const option = [...speakerSel.options].find(opt => opt.value === npcName);
        if(option) option.remove();

        // Remove NPC element and runtime state
        if(npcs[npcName]){
            npcs[npcName].remove();
            delete npcs[npcName];
        }
        activeFrontNPCs = activeFrontNPCs.filter(name => name !== npcName);
        activeTopNPCs = activeTopNPCs.filter(name => name !== npcName);
        absTypeNpcs.delete(npcName);

        // Save updated metadata
        localStorage.setItem("customNPCs", JSON.stringify(customNPCs));
        localStorage.setItem("customNpcFonts", JSON.stringify(customNpcFonts));
        localStorage.setItem("customNpcColors", JSON.stringify(customNpcColors));

        updateCustomNpcList();
        console.log(`Custom NPC "${npcName}" removed`);
        alert(`Custom NPC "${npcName}" removed successfully!`);
    } catch(e){
        console.error('Error removing NPC:', e);
        alert('Error removing NPC: ' + e.message);
    }
}

loadCustomNpcs();

/* ---------- BACKGROUND MUSIC MANAGEMENT ---------- */
function stopBackgroundMusic(){
    if(backgroundAudio){
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
    }
    // Also stop and remove any per-NPC background audio elements to ensure no lingering music
    try{
        Object.keys(npcBgAudios).forEach(n=>{
            try{
                const bg = npcBgAudios[n] || document.getElementById(`bgNpc_${n}`);
                if(bg){ bg.pause(); bg.currentTime = 0; try{ bg.remove(); }catch(e){} }
            }catch(e){}
            delete npcBgAudios[n];
        });
    }catch(e){}
    try{
        document.querySelectorAll('[id^="bgNpc_"]').forEach(el=>{ try{ el.pause(); el.currentTime=0; el.remove(); }catch(e){} });
    }catch(e){}
    currentMusicNpc = null;
}

function stopIntroAudio(){
    const ia = document.getElementById('introAudio');
    if(ia){
        ia.pause();
        ia.currentTime = 0;
        ia.onended = null;
    }
    introPlaying = false;
}

function playNpcIntroAndBackground(npc){
    // Play intro and start background when intro ends
    // No callback blocking — spawn happens independently
    if(!isPlaying) return; // only play during play mode
    if(!enableMusic) return;

    // Load custom NPC audio from IndexedDB if available and play them independently
    (async ()=>{
        let customBg = null;
        let introSrc = null;

        // Check for custom NPC background music and intro
        if(customNPCs[npc]){
            if(customNPCs[npc].hasBackgroundMusic){
                try {
                    customBg = await DBManager.getFile('bgMusic', npc, 'BACKGROUND');
                } catch(e) {
                    console.log('Error loading custom BG music:', e.message);
                }
            }
            if(customNPCs[npc].hasIntroSound){
                try {
                    introSrc = await DBManager.getFile('intro', npc, 'INTRO');
                } catch(e) {
                    console.log('Error loading custom intro sound:', e.message);
                }
            }
        }

        const npcBg = customBg || npcBackgroundMusic[npc] || null;

        // If NPC has no intro/background, nothing to do
        if(!introSrc && !npcBg){
            return;
        }

        // Stop global background and fully remove all per-NPC audio from other NPCs when this NPC enters
        if(npcBg || introSrc){
            stopBackgroundMusic();
            // Pause and remove all existing per-NPC intro audio elements
            try{
                Object.keys(npcIntroAudios).forEach(n=>{
                    try{
                        const ia = npcIntroAudios[n] || document.getElementById(`introNpc_${n}`);
                        if(ia){ ia.pause(); ia.currentTime = 0; ia.onended = null; ia.onerror = null; try{ ia.remove(); }catch(e){} }
                    }catch(e){}
                    delete npcIntroAudios[n];
                });
            }catch(e){}
            // Pause and remove all existing per-NPC background audio elements
            try{
                Object.keys(npcBgAudios).forEach(n=>{
                    try{
                        const bg = npcBgAudios[n] || document.getElementById(`bgNpc_${n}`);
                        if(bg){ bg.pause(); bg.currentTime = 0; try{ bg.remove(); }catch(e){} }
                    }catch(e){}
                    delete npcBgAudios[n];
                });
            }catch(e){}
            // Also remove any lingering DOM audio elements matching our naming pattern
            try{
                document.querySelectorAll('[id^="introNpc_"]').forEach(el=>{ try{ el.pause(); el.currentTime=0; el.remove(); }catch(e){} });
                document.querySelectorAll('[id^="bgNpc_"]').forEach(el=>{ try{ el.pause(); el.currentTime=0; el.remove(); }catch(e){} });
            }catch(e){}
        }

        // Play intro independently (does not stop or replace other music)
        if(!introSrc && npcIntroSounds[npc]) introSrc = npcIntroSounds[npc];

        if(introSrc){
            let ia = document.getElementById(`introNpc_${npc}`);
            if(!ia){ ia = document.createElement('audio'); ia.id = `introNpc_${npc}`; ia.preload = 'auto'; document.body.appendChild(ia); }
            ia.onerror = ia.onended = null;
            ia.src = introSrc;
            ia.currentTime = 0;
            ia.loop = false;
            npcIntroAudios[npc] = ia;

            // When intro ends, start NPC-specific background if provided
            ia.onended = ()=>{
                ia.onended = null;
                if(npcBg){
                    let bgEl = document.getElementById(`bgNpc_${npc}`);
                    if(!bgEl){ bgEl = document.createElement('audio'); bgEl.id = `bgNpc_${npc}`; bgEl.preload = 'auto'; bgEl.loop = true; document.body.appendChild(bgEl); }
                    // If background already playing for this NPC and same src, skip
                    if(bgEl.src !== (''+npcBg)){
                        bgEl.src = npcBg;
                        bgEl.currentTime = 0;
                        bgEl.loop = true;
                        bgEl.volume = 0.5;
                        npcBgAudios[npc] = bgEl;
                        // Mark this NPC as the current music owner
                        currentMusicNpc = npc;
                        bgEl.load();
                        bgEl.play().catch(e=>console.error('[BG MUSIC] NPC bg play error:', e.message));
                    }
                }
            };

            ia.onerror = ()=>{
                console.error('[BG MUSIC] intro load error for', npc);
                ia.onerror = null;
                ia.onended = null;
                // Start background anyway
                if(npcBg){
                    let bgEl = document.getElementById(`bgNpc_${npc}`);
                    if(!bgEl){ bgEl = document.createElement('audio'); bgEl.id = `bgNpc_${npc}`; bgEl.preload = 'auto'; bgEl.loop = true; document.body.appendChild(bgEl); }
                    bgEl.src = npcBg;
                    bgEl.currentTime = 0;
                    bgEl.loop = true;
                    bgEl.volume = 0.5;
                    npcBgAudios[npc] = bgEl;
                    // Mark this NPC as the current music owner
                    currentMusicNpc = npc;
                    bgEl.load();
                    bgEl.play().catch(e=>console.error('[BG MUSIC] NPC bg play error:', e.message));
                }
            };

            ia.load();
            ia.play().catch(e=>{
                console.error('[BG MUSIC] intro play error for', npc, e.message);
                // If intro fails to play, start bg immediately
                if(npcBg){
                    let bgEl = document.getElementById(`bgNpc_${npc}`);
                    if(!bgEl){ bgEl = document.createElement('audio'); bgEl.id = `bgNpc_${npc}`; bgEl.preload = 'auto'; bgEl.loop = true; document.body.appendChild(bgEl); }
                    bgEl.src = npcBg;
                    bgEl.currentTime = 0;
                    bgEl.loop = true;
                    bgEl.volume = 0.5;
                    npcBgAudios[npc] = bgEl;
                    bgEl.load();
                    bgEl.play().catch(e2=>console.error('[BG MUSIC] NPC bg play error:', e2.message));
                }
            });
        } else if(npcBg){
            // No intro; start NPC background immediately and independently
            let bgEl = document.getElementById(`bgNpc_${npc}`);
            if(!bgEl){ bgEl = document.createElement('audio'); bgEl.id = `bgNpc_${npc}`; bgEl.preload = 'auto'; bgEl.loop = true; document.body.appendChild(bgEl); }
            if(bgEl.src !== (''+npcBg)){
                bgEl.src = npcBg;
                bgEl.currentTime = 0;
                bgEl.loop = true;
                bgEl.volume = 0.5;
                npcBgAudios[npc] = bgEl;
                bgEl.load();
                bgEl.play().catch(e=>console.error('[BG MUSIC] NPC bg play error:', e.message));
            }
        }
    })();
}

function startBackgroundMusic(npc){
    console.log('[BG MUSIC] startBackgroundMusic called with npc:', npc);
    console.log('[BG MUSIC] enableMusic:', enableMusic, 'isPlaying:', isPlaying);
    console.log('[BG MUSIC] currentMusicNpc:', currentMusicNpc);
    
    if(!enableMusic) { 
        console.log('[BG MUSIC] Music disabled, returning');
        return; 
    }
    if(!isPlaying) { 
        console.log('[BG MUSIC] Not in play mode, returning');
        return; 
    }

    backgroundAudio = document.getElementById('bgAudio');
    if(!backgroundAudio) {
        console.error('[BG MUSIC] Audio element not found!');
        return;
    }
    console.log('[BG MUSIC] Audio element found:', backgroundAudio);

    // If an NPC is specified, check for custom NPC background music first, then built-in
    let bgSrc = defaultBackgroundMusic;
    if(npc){
        // Check npcBackgroundMusic which is updated with custom NPC music by updateBackgroundMusic()
        bgSrc = npcBackgroundMusic[npc] || defaultBackgroundMusic;
    }
    if(!bgSrc) {
        console.error('[BG MUSIC] No background music source found');
        return;
    }

    console.log('[BG MUSIC] New bg source:', bgSrc);
    console.log('[BG MUSIC] Current src:', backgroundAudio.src);
    
    // Only skip if it's the exact same source already playing
    if(backgroundAudio.src === bgSrc && !backgroundAudio.paused) {
        console.log('[BG MUSIC] Exact same music already playing, skipping');
        return;
    }

    console.log('[BG MUSIC] Starting background music:', bgSrc);
    console.log('[BG MUSIC] Music source is data URL?', bgSrc.startsWith('data:'));
    backgroundAudio.src = bgSrc;
    backgroundAudio.currentTime = 0;
    backgroundAudio.loop = true;
    backgroundAudio.volume = 0.5;
    
    // Clear previous event handlers
    backgroundAudio.onerror = null;
    backgroundAudio.onloadeddata = null;
    
    // Set up error handler
    backgroundAudio.onerror = (e)=>{
        console.error('[BG MUSIC] Audio load error:', e, 'for:', bgSrc);
    };
    
    backgroundAudio.onloadeddata = ()=>{
        console.log('[BG MUSIC] Audio loaded data event fired');
    };
    
    // Load and play
    console.log('[BG MUSIC] Calling load()');
    backgroundAudio.load();
    
    console.log('[BG MUSIC] Calling play()');
    const playPromise = backgroundAudio.play();
    if(playPromise !== undefined){
        playPromise.then(()=>{
            console.log('[BG MUSIC] Background music playing successfully');
        }).catch(e=>{
            console.error('[BG MUSIC] Background music play error:', e.message, e.name);
        });
    } else {
        console.log('[BG MUSIC] play() returned undefined (older browser)');
    }
    currentMusicNpc = npc ? npc : 'default';
}

/* ---------- PLAY SOUND FUNCTION ---------- */
async function playNPCSound(npc, emotion, text, voiceVariantOverride){
    if(!isPlaying || !enableSfx) return;

    emotion = emotion || 'SAY';
    
    // Skip NPC voice for SILENT emotion (SFX will still play separately)
    if(emotion === 'SILENT') return;
    
    // Ensure NPC exists
    ensureNpcExists(npc);

    // Check if the text contains a banned word
    let censored = false;
    if(text && censorText(text) !== text){
        censored = true;
    }

    let soundList = [];

    if(censored){
        // Use SWEAR.ogg for censored text
        soundList = ["SWEAR.ogg"];
    } else {
        // Check for custom NPC voice lines (from IndexedDB)
        if(customNPCs[npc] && customNPCs[npc].voiceReferences){
            const voiceReferences = customNPCs[npc].voiceReferences;
            const emotionFiles = Object.keys(voiceReferences).filter(key => 
                key.toUpperCase().startsWith(emotion.toUpperCase()) || key.toUpperCase().includes(emotion.toUpperCase())
            );
            if(emotionFiles.length > 0){
                // Fetch voice data from IndexedDB
                soundList = [];
                for(let fileName of emotionFiles){
                    const voiceData = await DBManager.getFile('voice', npc, voiceReferences[fileName]);
                    if(voiceData) soundList.push(voiceData);
                }
            }
        }
        
        // Fallback to built-in NPC sounds if no custom voice
        if(soundList.length === 0){
            soundList = getNpcSounds(npc, emotion, voiceVariantOverride);
        }
    }

    if(!soundList || soundList.length === 0) return;

    // Use shuffled queue to pick next sound
    const clip = getNextQueuedSound(npc, emotion, soundList);
    if (!clip) return;

    // Stop previous voice audio if it's still playing
    if(lastVoiceAudio){
        lastVoiceAudio.pause();
        lastVoiceAudio.currentTime = 0;
    }

    // Play new audio
    const audio = new Audio(clip);
    audio.volume = 0.8;
    lastVoiceAudio = audio; // Track this audio so next one can stop it
    
    // For voice-driven NPCs (Dave, SpongeBob), reset to idle when voice ends
    if(voiceDrivenNpcs.has(npc)){
        audio.onended = ()=>{
            setNpcImageForEmotion(npc, 'SAY');
        };
    }
    
    audio.play().catch(e => console.log("Audio play error:", e));
}


/* ---------- TIMELINE (JSON) ---------- */
const scriptJsonEl = document.getElementById("scriptJson");

function refreshScriptJson(){
    scriptJsonEl.value = JSON.stringify(script, null, 2);
}

function updateScriptFromJson(){
    try {
        const parsed = JSON.parse(scriptJsonEl.value);
        if(Array.isArray(parsed)){
            script = parsed;
            refreshScriptJson();
        } else {
            alert("Invalid JSON: must be an array");
        }
    } catch(e){
        alert("JSON Parse Error: " + e.message);
    }
}

scriptJsonEl.addEventListener("change", updateScriptFromJson);
scriptJsonEl.addEventListener("blur", updateScriptFromJson);

/* ---------- ADD EVENT BUTTONS ---------- */
document.getElementById("addLineBtn").onclick=()=>{
    const speaker=speakerSel.value;
    const emotion=emotionSel.value;
    const text=textInput.value.trim();
    if(!text) return;
    
    const lineObj = {type:"say",speaker,emotion,text};
    
    const sfxSelect = document.getElementById('sfxSelect');
    if(sfxSelect && sfxSelect.value){
        lineObj.sfx = sfxSelect.value;
    }
    
    if(speaker === 'dave'){
        const voiceVariant = document.getElementById('voiceVariant')?.value || 'default';
        lineObj.voiceVariant = voiceVariant;
    }
    
    // If the skin selector is visible (populated for NPCs with variants), save the chosen skin
    const skinVariantSel = document.getElementById('skinVariant');
    if(skinVariantSel && skinVariantSel.style.display !== 'none'){
        lineObj.skinVariant = skinVariantSel.value || 'default';
    }
    
    script.push(lineObj);
    textInput.value="";
    refreshScriptJson();
};

document.getElementById("addEnterBtn").onclick=()=>{
    const speaker=speakerSel.value;
    
    const enterObj = {type:"enter",speaker};
    
    // Add voice variant if Dave has a variant selected
    // Always save voice variant if Dave
    if(speaker === 'dave'){
        const voiceVariant = document.getElementById('voiceVariant')?.value || 'default';
        enterObj.voiceVariant = voiceVariant;
    }
    
    // If the skin selector is visible (populated for NPCs with variants), save the chosen skin
    const skinVariantSel2 = document.getElementById('skinVariant');
    if(skinVariantSel2 && skinVariantSel2.style.display !== 'none'){
        enterObj.skinVariant = skinVariantSel2.value || 'default';
    }
    
    script.push(enterObj);
    refreshScriptJson();
};

document.getElementById("addLeaveBtn").onclick=()=>{
    const speaker=speakerSel.value;
    script.push({type:"leave",speaker});
    refreshScriptJson();
};

/* ---------- SFX FOLDER MANAGEMENT ---------- */
// SFX options are now hardcoded in index.html
// (Auto-loader disabled — uncomment below if you want dynamic loading from sfx/ folder)
/*
async function loadSfxFiles(){
    try{
        const sfxSel = document.getElementById('sfxSelect');
        const response = await fetch('sfx/');
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = doc.querySelectorAll('a');
        const sfxFiles = [];
        links.forEach(link=>{
            const href = link.getAttribute('href');
            if(href && href.endsWith('.ogg') && !href.startsWith('..') && href !== '/'){
                sfxFiles.push(href);
            }
        });
        sfxFiles.sort().forEach(fname=>{
            const option = document.createElement('option');
            option.value = fname.replace('.ogg','');
            option.textContent = fname.replace('.ogg','');
            sfxSel.appendChild(option);
        });
    }catch(e){
        console.log('Could not auto-load SFX files (expected on some servers). Type SFX names in dropdown or add to script JSON manually.');
    }
}
setTimeout(loadSfxFiles, 500);
*/

/* ---------- GAME FUNCTIONS ---------- */
function resetScene(){
    index = 0;
    activeTopNPCs = [];
    // Hide all NPC elements
    Object.values(npcs).forEach(npc => fadeOutElement(npc));
    // Hide dialogue boxes and speech bubbles
    fadeOutElement(bottomDialogue);
    fadeOutElement(topDialogue);
    fadeOutElement(speech_bubble_left);
    fadeOutElement(speech_bubble_right);

    // Clear text/content to avoid leftover text between sessions
    try{ bottomText.textContent = ''; }catch(e){}
    try{ topText.textContent = ''; }catch(e){}
    try{ speech_bubble_left_text.textContent = ''; speech_bubble_left_img.src = ''; }catch(e){}
    try{ speech_bubble_right_text.textContent = ''; speech_bubble_right_img.src = ''; }catch(e){}

    // Clear any skip block timers
    if(skipBlockTimer){ clearTimeout(skipBlockTimer); skipBlockTimer = null; }
    skipBlocked = false;
    
    // Reset music state so background music plays fresh
    currentMusicNpc = null;

    // Stop and remove any per-NPC intro/background audio elements created during play
    try{
        Object.keys(npcIntroAudios).forEach(n=>{
            try{
                const ia = npcIntroAudios[n] || document.getElementById(`introNpc_${n}`);
                if(ia){ ia.pause(); ia.currentTime = 0; ia.onended = null; ia.onerror = null; ia.remove(); }
            }catch(e){}
            delete npcIntroAudios[n];
        });
    }catch(e){}
    try{
        Object.keys(npcBgAudios).forEach(n=>{
            try{
                const bg = npcBgAudios[n] || document.getElementById(`bgNpc_${n}`);
                if(bg){ bg.pause(); bg.currentTime = 0; bg.remove(); }
            }catch(e){}
            delete npcBgAudios[n];
        });
    }catch(e){}

    // Also remove any leftover DOM audio elements matching the naming pattern just in case
    try{
        document.querySelectorAll('[id^="introNpc_"]').forEach(el=>{ try{ el.pause(); el.currentTime=0; el.remove(); }catch(e){} });
        document.querySelectorAll('[id^="bgNpc_"]').forEach(el=>{ try{ el.pause(); el.currentTime=0; el.remove(); }catch(e){} });
    }catch(e){}

    // Stop any lingering voice audio
    try{ if(lastVoiceAudio){ lastVoiceAudio.pause(); lastVoiceAudio.currentTime = 0; lastVoiceAudio = null; } }catch(e){}
}

function startGame(){
    isPlaying = true;
    resetScene();
    fadeInElement(game, 'block');
    if(game.requestFullscreen && window.innerWidth > 768){
        game.requestFullscreen().catch(()=>{});
    }
    // Start the site-default background immediately when play begins
    startBackgroundMusic(null);
}


function layoutTopNPCs(){
    const count = activeTopNPCs.length;
    activeTopNPCs.forEach((npcName,i)=>{
        ensureNpcExists(npcName);
        const npc=npcs[npcName];
        npc.style.position="absolute";
        npc.style.top="20px";
        npc.style.left=100/count*i + 100/(count*2)+"%";
        npc.style.transform="translateX(-50%)";
        npc.style.height="35%";
        // fade in
        fadeInElement(npc);
    });
}

/* ---------- DIM/UNDIM BACK NPCs ---------- */
function dimBackNpcs(speakingNpc){
    // Dim all back NPCs except the one speaking using brightness filter (darker, not transparent)
    activeTopNPCs.forEach(npcName=>{
        const npc = npcs[npcName];
        if(npc){
            if(npcName === speakingNpc){
                npc.style.filter = "brightness(1.0)"; // speaking NPC is bright
            } else {
                npc.style.filter = "brightness(0.5)"; // other back NPCs are darkened
            }
        }
    });
}

function undimBackNpcs(){
    // Restore all back NPCs to normal brightness
    activeTopNPCs.forEach(npcName=>{
        const npc = npcs[npcName];
        if(npc) npc.style.filter = "brightness(1.0)";
    });
}

/* ---------- SHOW NEXT LINE ---------- */
function exitPlayMode(){
    // Ensure UI is fully reset
    resetScene();
    stopBackgroundMusic();
    if(document.fullscreenElement){
        document.exitFullscreen().catch(()=>{});
    }
    fadeOutElement(game);
    isPlaying=false;
}

function showNext(){
    if(index>=script.length){
        exitPlayMode();
        return;
    }
    const line=script[index++];
    // ensure NPC element exists to avoid "undefined" errors
    if(line && line.speaker) ensureNpcExists(line.speaker);

    // Undim back NPCs at start of each new line (unless it's an enter/leave)
    if(line.type !== "enter" && line.type !== "leave"){
        undimBackNpcs();
    }

    // ENTER
    if(line.type==="enter"){
        const frontSpeaker = isFrontNpc(line.speaker);
        // For top/back NPCs, add to activeTopNPCs so they persist until a leave
        if(!activeTopNPCs.includes(line.speaker) && !frontSpeaker) activeTopNPCs.push(line.speaker);
        // For front NPCs (Dave/Penny variants), track them in activeFrontNPCs so they persist until leave
        if(frontSpeaker && !activeFrontNPCs.includes(line.speaker)){
            activeFrontNPCs.push(line.speaker);
        }
        if(activeTopNPCs.includes(line.speaker)) layoutTopNPCs();
        if(frontSpeaker){
            // fade in front NPCs (show the specific variant)
            fadeInElement(npcs[line.speaker]);
        } else {
            // for top NPCs, layoutTopNPCs handles their positioning and fade
            layoutTopNPCs();
        }

        // Apply voice and skin variants if present in the script
        if(line.voiceVariant && line.speaker === 'dave'){
            const voiceVariantSel = document.getElementById('voiceVariant');
            if(voiceVariantSel) voiceVariantSel.value = line.voiceVariant;
        }
        if(line.skinVariant){
            const skinVariantSel = document.getElementById('skinVariant');
            if(skinVariantSel) skinVariantSel.value = line.skinVariant;
            // Update the visual skin immediately for supported NPCs
            try{
                if(npcs[line.speaker]){
                    // Use setNpcImageForEmotion helper to apply the chosen skin
                    setNpcImageForEmotion(line.speaker, 'SAY', line.skinVariant);
                }
            }catch(e){ /* non-fatal */ }
        }

        // Play intro and spawn at the same time; block skipping for 2 seconds
        // If the next queued action is another NPC ENTER, skip starting this NPC's music
        // (we still play spawn SFX). This avoids overlapping per-NPC background when multiple NPCs enter together.
        try{
            const nextLine = script[index]; // index already points to the next action
            if(!(nextLine && nextLine.type === 'enter')){
                // Only start intro/bg when the next action is not an immediate enter
                playNpcIntroAndBackground(line.speaker);
            } else {
                // Skip starting music for this NPC because another NPC will enter immediately
                console.log('[BG MUSIC] Skipping music for', line.speaker, 'because next action is another enter');
            }
        }catch(e){ playNpcIntroAndBackground(line.speaker); }
        
        // Play SPAWN sound on enter (all NPCs) - only if in play mode
        if(isPlaying){
            const spawnSrc = (customNPCs[line.speaker] && customNPCs[line.speaker].spawnSound) || npcSpawnSounds[line.speaker];
            if(spawnSrc && enableSfx){
                let spawnEl = document.getElementById('spawnAudio');
                if(!spawnEl){ spawnEl = document.createElement('audio'); spawnEl.id = 'spawnAudio'; spawnEl.preload = 'auto'; document.body.appendChild(spawnEl); }
                spawnEl.src = spawnSrc;
                spawnEl.currentTime = 0;
                spawnEl.onloadeddata = ()=>{
                    spawnEl.play().catch(e=>console.log('Spawn play error:', e));
                };
                spawnEl.onerror = ()=>{
                    console.log('Spawn sound load error');
                };
            }
        }
        
        // Block skipping for 2 seconds
        skipBlocked = true;
        if(skipBlockTimer) clearTimeout(skipBlockTimer);
        skipBlockTimer = setTimeout(()=>{ skipBlocked = false; skipBlockTimer = null; }, 2000);
        
        showNext();
        return;
    }

    // LEAVE
    if(line.type==="leave"){
        const frontSpeaker = isFrontNpc(line.speaker);
        // Remove from top/back active list
        activeTopNPCs = activeTopNPCs.filter(n=>n!==line.speaker);
        // If front NPC (Dave/Penny variants), remove from activeFrontNPCs and hide
        if(frontSpeaker){
            activeFrontNPCs = activeFrontNPCs.filter(n=>n!==line.speaker);
            if(npcs[line.speaker]) fadeOutElement(npcs[line.speaker]);
        } else {
            if(npcs[line.speaker]) fadeOutElement(npcs[line.speaker]);
        }
        layoutTopNPCs();
        
        // Play DESPAWN sound on leave (fallback to SPAWN if no DESPAWN) - only if in play mode
        if(isPlaying){
            const despawnSrc = (customNPCs[line.speaker] && customNPCs[line.speaker].despawnSound) || npcDespawnSounds[line.speaker] || npcSpawnSounds[line.speaker];
            if(despawnSrc && enableSfx){
                let leaveEl = document.getElementById('leaveAudio');
                if(!leaveEl){ leaveEl = document.createElement('audio'); leaveEl.id = 'leaveAudio'; leaveEl.preload = 'auto'; document.body.appendChild(leaveEl); }
                leaveEl.src = despawnSrc;
                leaveEl.currentTime = 0;
                leaveEl.onloadeddata = ()=>{
                    leaveEl.play().catch(e=>console.log('Leave play error:', e));
                };
                leaveEl.onerror = ()=>{
                    console.log('Leave sound load error');
                };
            }
        }
        
        // If this NPC was playing music, resume music from another active NPC
        // Stop any per-NPC intro/background audio for this NPC (they persist until leave)
        try{
            const ia = document.getElementById(`introNpc_${line.speaker}`);
            if(ia){ ia.pause(); ia.currentTime = 0; ia.onended = null; ia.onerror = null; ia.remove(); }
        }catch(e){}
        try{
            const bgEl = document.getElementById(`bgNpc_${line.speaker}`);
            if(bgEl){ bgEl.pause(); bgEl.currentTime = 0; bgEl.remove(); }
        }catch(e){}
        delete npcIntroAudios[line.speaker];
        delete npcBgAudios[line.speaker];

        // If this NPC was the global current music owner, resume default background
        if(currentMusicNpc === line.speaker){
            stopBackgroundMusic();
            startBackgroundMusic(null);
        }
        
        // Block skipping for 2 seconds
        skipBlocked = true;
        if(skipBlockTimer) clearTimeout(skipBlockTimer);
        skipBlockTimer = setTimeout(()=>{ skipBlocked = false; skipBlockTimer = null; }, 2000);
        
        showNext();
        return;
    }

    fadeOutElement(bottomDialogue);
    fadeOutElement(topDialogue);
    fadeOutElement(speech_bubble_left);
    fadeOutElement(speech_bubble_right);

    // BOTTOM NPCS (use speech bubbles for front NPC variants like Dave & Penny)
    if(isFrontNpc(line.speaker)){
        // Show the specific variant and hide other variants that aren't active
        DAVE_VARIANTS.forEach(n => { if(line.speaker === n) fadeInElement(npcs[n], 'block'); else if(!activeFrontNPCs.includes(n)) fadeOutElement(npcs[n]); });
        PENNY_VARIANTS.forEach(n => { if(line.speaker === n) fadeInElement(npcs[n], 'block'); else if(!activeFrontNPCs.includes(n)) fadeOutElement(npcs[n]); });
        Object.keys(customNPCs).forEach(npcName => {
            if(!customNPCs[npcName] || customNPCs[npcName].position !== 'front') return;
            if(npcName === line.speaker) return;
            if(!activeFrontNPCs.includes(npcName) && npcs[npcName]) fadeOutElement(npcs[npcName]);
        });
        if(npcs[line.speaker]) fadeInElement(npcs[line.speaker], 'block');

        // Apply voice and skin variants if present in the script
        if(line.voiceVariant && line.speaker === 'dave'){
            const voiceVariantSel = document.getElementById('voiceVariant');
            if(voiceVariantSel) voiceVariantSel.value = line.voiceVariant;
        }
        if(line.skinVariant && line.speaker === 'dave'){
            const skinVariantSel = document.getElementById('skinVariant');
            if(skinVariantSel) skinVariantSel.value = line.skinVariant;
        }

        // Determine which bubble to use (left for Dave/Tugboat, right for others)
        const usesLeftBubble = LEFT_BUBBLE_NPCS.includes(line.speaker);
        const bubbleContainer = usesLeftBubble ? speech_bubble_left : speech_bubble_right;
        const bubbleImg = usesLeftBubble ? speech_bubble_left_img : speech_bubble_right_img;
        const bubbleText = usesLeftBubble ? speech_bubble_left_text : speech_bubble_right_text;

        const leftBubble = `speech_bubble_left.png`;
        const rightBubble = `speech_bubble_right.png`;
        const genericBubble = `speech_bubble.png`;
        const sideSrc = usesLeftBubble ? leftBubble : rightBubble;
        const testImg = new Image();
        testImg.onload = ()=> { bubbleImg.src = sideSrc; };
        testImg.onerror = ()=> { bubbleImg.src = genericBubble; };
        testImg.src = sideSrc;

        bubbleText.style.fontFamily = getNpcFont(line.speaker);
        bubbleText.style.color = customNpcColors[line.speaker] || "black";
        bubbleText.textContent = censorText(line.text);
        bubbleContainer.style.setProperty('--bubble-text-color', customNpcColors[line.speaker] || 'black');

        fadeInElement(bubbleContainer, 'block');
        // set image per emotion if custom images exist
        setNpcImageForEmotion(line.speaker, line.emotion, line.skinVariant);

        // Play voice — Dave variants reuse Dave sounds; Penny variants use their mapped sounds (soldier -> camo, surfer -> silent)
        playNPCSound(line.speaker, line.emotion, line.text, line.voiceVariant);
        
        // Play SFX if attached to this line
        if(line.sfx){
            playCommonSfx(line.sfx, line.sfxVolume || 1.0);
        }
    } else {
        // TOP NPCS (use original text boxes)
        if(!activeTopNPCs.includes(line.speaker)){
            activeTopNPCs.push(line.speaker);
            layoutTopNPCs();
            // Do not auto-remove top NPCs added during a say line.
            // Require an explicit 'leave' line to remove them.
        }
        
        // Apply skin variants for top NPCs that support skins (Zombert, Lucky, MissInfo, etc.)
        if(line.skinVariant && (line.speaker === 'zombert' || line.speaker === 'lucky' || line.speaker === 'missinfo')){
            const skinVariantSel = document.getElementById('skinVariant');
            if(skinVariantSel) skinVariantSel.value = line.skinVariant;
        }
        
        topText.style.fontFamily=getNpcFont(line.speaker);
        topText.style.color = customNpcColors[line.speaker] || "white";
        fadeInElement(topDialogue, 'flex');
        topText.textContent=censorText(line.text);
        // set image per emotion if custom images exist
        setNpcImageForEmotion(line.speaker, line.emotion, line.skinVariant);
        // play sound for top NPCs if available (pass text for censor detection)
        playNPCSound(line.speaker, line.emotion, line.text, line.voiceVariant);
        
        // Play SFX if attached to this line
        if(line.sfx){
            playCommonSfx(line.sfx, line.sfxVolume || 1.0);
        }
        
        // Dim other back NPCs while this one speaks
        dimBackNpcs(line.speaker);
        
        // If another NPC is speaking, reset abs-type NPCs to idle (SAY.png) immediately
        if(line.speaker !== "antibullysquad" && activeTopNPCs.includes("antibullysquad")){
            setNpcImageForEmotion("antibullysquad", "SAY");
        }
        
        // Stop voice audio for voice-driven NPCs in case they were interrupted by another speaker
        if(voiceDrivenNpcs.has(line.speaker) && lastVoiceAudio){
            lastVoiceAudio.pause();
            lastVoiceAudio.currentTime = 0;
        }
    }

    // keep top NPC visible for a short time if it's a single-line entrance
    setTimeout(()=>{
        if(line.leaveAfter){
            activeTopNPCs=activeTopNPCs.filter(n=>n!==line.speaker);
            if(npcs[line.speaker]) fadeOutElement(npcs[line.speaker]);
            layoutTopNPCs();
        }
        // If speaker is abs-type NPC, reset to SAY.png
        if(absTypeNpcs.has(line.speaker)){
            setNpcImageForEmotion(line.speaker, "SAY");
        }
    },2500);
}

/* ---------- GET NEXT DIALOG LINE ---------- */
function getNextDialogLine(){
    let tempIndex = index;
    while(tempIndex < script.length){
        const line = script[tempIndex];
        if(line.type === "say") return line;
        tempIndex++;
    }
    return null;
}

/* ---------- INPUT ---------- */
function handleGameInteraction(){
    if(skipBlocked) return; // block interactions during spawn/leave 2-sec window
    // Show next line and let showNext() handle playing NPC audio to avoid duplicates
    showNext();
}

game.addEventListener('click', handleGameInteraction);
game.addEventListener('touchstart', (e)=>{
    e.preventDefault();
    handleGameInteraction();
}, {passive: false});
document.addEventListener("keydown",e=>{
    if(e.code==="Space") {
        if(skipBlocked) return; // block skipping during spawn/leave 2-sec window
        // Let showNext() handle audio playback to prevent double-playing
        showNext();
    }
    if(e.code==="Escape"){ 
        exitPlayMode();
    }
});

/* ---------- PLAY BUTTON ---------- */
document.getElementById("playBtn").onclick = startGame;

/* ---------- TEST SOUND BUTTON ---------- */
// Test sound button removed - focus on main UI improvements

/* ---------- CLICK DAVE TO PLAY RANDOM SOUND ---------- */
npcs.dave.addEventListener("click", ()=>{
    if(!isPlaying) return;
    const emotions=["SAY","SHOUT","EXCITED","TIRED","PLAYFUL"];
    const randEmotion=emotions[Math.floor(Math.random()*emotions.length)];
    playNPCSound("dave", randEmotion);
});
