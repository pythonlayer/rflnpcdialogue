# JSON Dialogue Guide

This guide shows you how to write dialogue directly as JSON in the **Script (JSON)** textarea without using the UI buttons.

## Where to Write JSON

In the editor, find the large textarea labeled **"Script (JSON)"** at the bottom. You can paste or type JSON directly there. When you click outside the textarea or press blur, it will automatically validate and load your dialogue.

---

## Basic Structure

The script must be a **JSON array** of events. Each event is an object with a `type` field.

```json
[
  { "type": "enter", "speaker": "dave" },
  { "type": "say", "speaker": "dave", "emotion": "SAY", "text": "Hello there!" },
  { "type": "leave", "speaker": "dave" }
]
```

---

## Event Types

### 1. **Enter** — NPC Appears
Brings an NPC onto the stage with fade-in animation and spawn sound.

```json
{ "type": "enter", "speaker": "dave" }
```

**Fields:**
- `type`: `"enter"` (required)
- `speaker`: NPC name (required) — see list below

---

### 2. **Say** — NPC Speaks
Displays dialogue text and plays voice sound.

```json
{ "type": "say", "speaker": "dave", "emotion": "SAY", "text": "Watch out for zombies!" }
```

**Fields:**
- `type`: `"say"` (required)
- `speaker`: NPC name (required)
- `emotion`: Voice emotion (required) — options: `"SAY"`, `"SHOUT"`, `"EXCITED"`, `"TIRED"`, `"PLAYFUL"`
- `text`: Dialogue text (required) — will be censored for banned words

---

### 3. **Leave** — NPC Disappears
Removes an NPC from the stage with fade-out animation and leave sound.

```json
{ "type": "leave", "speaker": "dave" }
```

**Fields:**
- `type`: `"leave"` (required)
- `speaker`: NPC name (required)

---

## Available NPCs

**Built-in NPCs:**
- `"dave"` — Crazy Dave (bottom-left)
- `"penny"` — Penny (bottom-right)
- `"zomboss"` — Zomboss (top-center)
- `"zombert"` — Zombert (top)
- `"camo"` — Captain Camo (top)
- `"lucky"` — Lucky (top)
- `"nanny"` — Nanny (top)
- `"missinfo"` — Miss Information (top)
- `"huntaria"` — Huntaria (top)
- `"greedy"` — Greedy (top)

**Custom NPCs:**
Any NPC you created in the "Create Custom NPC" section—use the exact name you gave it (lowercase).

---

## Complete Example

```json
[
  { "type": "enter", "speaker": "dave" },
  { "type": "say", "speaker": "dave", "emotion": "SAY", "text": "Welcome to my garden!" },
  { "type": "say", "speaker": "dave", "emotion": "EXCITED", "text": "Let's grow some plants!" },
  
  { "type": "enter", "speaker": "zomboss" },
  { "type": "say", "speaker": "zomboss", "emotion": "SHOUT", "text": "Your plants will wilt!" },
  
  { "type": "say", "speaker": "dave", "emotion": "PLAYFUL", "text": "Not if I have anything to say about it!" },
  
  { "type": "leave", "speaker": "zomboss" },
  { "type": "say", "speaker": "dave", "emotion": "TIRED", "text": "Phew, that was close..." },
  { "type": "leave", "speaker": "dave" }
]
```

---

## Audio Timing

When you press **Play** (`▶`):

1. **On Enter:** NPC fades in, spawn sound + intro music play together → Player can skip after 2 seconds
2. **On Say:** Text appears, voice sound plays → Player can click to advance
3. **On Leave:** NPC fades out, leave/despawn sound plays → Player can skip after 2 seconds
4. **Background Music:** Starts when intro finishes and plays in a loop while NPC is active

---

## Voice Availability & Special Mappings

Not all NPCs have voice clips for every emotion. If an emotion has no available clip for an NPC, no voice will play for that line. Use `SAY` when you want the broadest compatibility.

Special mappings in this build:

- **`SAY`**: available for most NPCs (general fallback).
- **`mrgrim`** and **`brim`**: primarily have `TIRED` voice clips.
- **`greg`**: primarily has `PLAYFUL` voice clips.
- **`stilts`**: primarily has `SHOUT` voice clips.

When writing scripts, prefer `SAY` for lines that should work across characters; choose the specific mapped emotion to play a character's unique clip.

---

## Tips & Tricks

### Copy & Paste from UI
1. Use the **Add Line**, **Enter**, **Leave** buttons to build your dialogue
2. The JSON automatically updates in the textarea
3. Copy that JSON for reuse

### Validate JSON
If your JSON has errors:
- Check for missing commas between objects
- Make sure all strings use double quotes (`"`, not `'`)
- Use a JSON validator like [jsonlint.com](https://www.jsonlint.com/) if unsure

### Censoring
Any text containing banned words (profanity, slurs) will be automatically censored with random `@#$%^&*` characters while preserving word length.

### Multiple NPCs on Stage
You can have:
- Bottom NPCs: `dave` and `penny` together
- Top NPCs: multiple top NPCs visible at once (they spread horizontally)

Example:
```json
[
  { "type": "enter", "speaker": "dave" },
  { "type": "enter", "speaker": "zomboss" },
  { "type": "enter", "speaker": "camo" },
  { "type": "say", "speaker": "dave", "emotion": "SAY", "text": "We're outnumbered!" },
  { "type": "say", "speaker": "zomboss", "emotion": "SHOUT", "text": "Surrender!" },
  { "type": "leave", "speaker": "camo" },
  { "type": "leave", "speaker": "zomboss" },
  { "type": "leave", "speaker": "dave" }
]
```

---

## Common Mistakes

❌ **Missing quotes around strings:**
```json
{ "type": say, "speaker": dave }  // WRONG
```

✅ **Correct:**
```json
{ "type": "say", "speaker": "dave" }
```

---

❌ **Trailing comma:**
```json
[
  { "type": "enter", "speaker": "dave" },
  { "type": "say", "speaker": "dave", "emotion": "SAY", "text": "Hi!" },  // Extra comma
]
```

✅ **Correct:**
```json
[
  { "type": "enter", "speaker": "dave" },
  { "type": "say", "speaker": "dave", "emotion": "SAY", "text": "Hi!" }
]
```

---

## Quick Reference

| Event | Syntax |
|-------|--------|
| **Enter** | `{ "type": "enter", "speaker": "NAME" }` |
| **Say** | `{ "type": "say", "speaker": "NAME", "emotion": "EMOTION", "text": "..." }` |
| **Leave** | `{ "type": "leave", "speaker": "NAME" }` |

**Emotions:** `"SAY"`, `"SHOUT"`, `"EXCITED"`, `"TIRED"`, `"PLAYFUL"`

---

Happy dialogue writing! 
