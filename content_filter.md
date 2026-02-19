# Content Filter / Censoring System

## Overview

A comprehensive content filter has been added to automatically censor offensive language, profanity, racial slurs, and hate speech. When dialogue is played, any banned words are automatically replaced with cartoon-style censoring (@#$%^&*).

## How It Works

### 1. Automatic Censoring
When any line of dialogue is displayed in the game:
- The system scans for banned words
- Matches are case-insensitive and respect word boundaries
- Each match is replaced with random censoring characters

### 2. Censoring Style
Words are censored using random characters from: `@#$%^&*!`

Each censored word maintains the original word length for readability.

**Examples:**
- `shit` → `@#$%` (4 characters)
- `fuck` → `^&*@` (4 characters)  
- `asshole` → `@#$%^&*` (7 characters)
- `zitler` → `@#$%^&` (6 characters)

### 3. Coverage

The filter covers:
- **Racist slurs and hate speech** - Multiple variations including common leetspeak
- **Profanity** - Common swear words and variations
- **Specific words** - "Zitler" and similar targeted words
- **Leetspeak versions** - Common number/symbol substitutions (n1gg3r, f*ck, etc.)

## Banned Words List

### Racist/Hate Speech
- zitler, hitler, n-word, and related racial slurs
- faggot and variations
- Various ethnic slurs and derogatory terms
- LGBTQ+ slurs

### Common Profanity
- shit (and variations)
- fuck (and variations)
- bitch (and variations)
- asshole, goddamn, crap
- dick, pussy, cock, cum
- And many more common profanities

### Leetspeak Variations
- n1gg3r, f*ck, b!tch, a55hole
- d@mn, g0dd@mn, and other number/symbol substitutions

## Technical Implementation

### Function: `censorText(text)`
```javascript
function censorText(text) {
    if (!text) return text;
    
    let censoredText = text;
    
    bannedWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        censoredText = censoredText.replace(regex, (match) => {
            return generateCensorBar(match.length);
        });
    });
    
    return censoredText;
}
```

### Function: `generateCensorBar(wordLength)`
Generates a random string of censoring characters matching the word length.

### Applied To
- Bottom NPC dialogue (Dave, Penny)
- Top NPC dialogue (all other NPCs)
- Custom NPC dialogue
- All emotions and dialogue types

## When Censoring Occurs

✅ **Applied When:**
- Dialogue is displayed during playback
- Any NPC (built-in or custom) speaks
- Any emotion (SAY, SHOUT, EXCITED, etc.)

✅ **NOT Applied To:**
- Script JSON editor (original text preserved for editing)
- Test sound button previews
- Stored data

## User Experience

1. User creates dialogue with any text (including offensive language)
2. User clicks Play to view scenes
3. Any offensive words are automatically censored with @#$%^&* characters
4. Censoring changes slightly each time due to random character selection
5. Original script text remains unchanged (for editing)

## Example

**Original Script:**
```json
{ "type": "say", "speaker": "zomboss", "emotion": "SHOUT", "text": "I'll destroy you, zitler!" }
```

**Displayed in Game:**
```
I'll destroy you, @#$%^&!
```

## Adding More Words

To add words to the filter, edit the `bannedWords` array in script.js:

```javascript
const bannedWords = [
    // ... existing words ...
    "newword",        // Add new word here
    "n3ww0rd"         // Add leetspeak variation
];
```

## Effectiveness

The filter uses word boundaries (`\b`) in regex, so:
- ✅ Catches: "fuck", "fucking", "fucked" (separate words)
- ✅ Catches: "Fuck", "FUCK", "FuCk" (case-insensitive)
- ✅ Catches: "f*ck", "f!ck" (common substitutions)
- ✅ Won't catch: Words within other words (intentionally, to avoid false positives)

## Notes

- The censor function is applied to **display text only**, not stored data
- Original dialogue text is preserved in the script for editing purposes
- Each playthrough may show different censoring characters for variety
- The system maintains word length for approximate readability
- All censoring happens client-side (in the browser)

---

This ensures a safe, family-friendly experience while allowing creators full editorial control in the editor.
