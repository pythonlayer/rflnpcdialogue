# Quick Start: Creating Your First Custom NPC

## 30-Second Overview

1. **Scroll to top** of the editor → See "➕ Create Custom NPC" section
2. **Enter name** (e.g., "MyRobot")
3. **Upload PNG image** of your character
4. **Pick a font** (or upload custom TTF/OTF)
5. **Choose text color**
6. **Drag voice files** (SAY1.mp3, SHOUT1.mp3, etc.)
7. **Click ✅ Create NPC** button

## Naming Your Voice Files

Your audio files MUST be named like this to work:

```
SAY1.mp3       ← Default voice
SAY2.mp3       ← Alternate (randomly picked)
SHOUT1.mp3     ← When emotion="SHOUT"
EXCITED1.mp3   ← When emotion="EXCITED"
TIRED1.mp3     ← When emotion="TIRED"
PLAYFUL1.mp3   ← When emotion="PLAYFUL"
```

You only need ONE file per emotion, but more = more variety!

## Example: Creating "C3P0-Bot"

```
1. Name: c3p0bot
2. Image: c3p0.png (your droid artwork)
3. Font: Arial (or upload robot.ttf)
4. Color: #FFD700 (gold)
5. Voice files:
   - SAY1.mp3 (beep sound)
   - SHOUT1.mp3 (loud beep)
   - EXCITED1.mp3 (happy beeping)
   - (upload these in drag-and-drop box)
6. Click Create!
```

Then in your script:
```json
[
  { "type": "enter", "speaker": "c3p0bot" },
  { "type": "say", "speaker": "c3p0bot", "emotion": "SAY", "text": "Beep boop!" },
  { "type": "say", "speaker": "c3p0bot", "emotion": "EXCITED", "text": "Beep beep beep!" }
]
```

## Tips

✅ **PNG Images**: Use transparent background  
✅ **Image Size**: 500-1000px works great  
✅ **Audio Files**: Keep 2-5 seconds each  
✅ **File Names**: MUST match emotion names exactly (case-insensitive)  
✅ **Font Files**: TTF or OTF format  
✅ **Text Color**: Any hex color (#FF0000, #00FF00, etc.)

## Common Issues

❌ **NPC doesn't appear in dropdown**  
→ Reload page (Ctrl+R)

❌ **Sounds don't play**  
→ Check file names (SAY1, not Say1 or say_1)

❌ **Font doesn't look right**  
→ Use a different font file (some fonts have rendering issues)

❌ **Can't upload files**  
→ Check file size and format

## Where Are My Custom NPCs Saved?

Your custom NPCs live in your **browser's local storage** - they're saved on YOUR computer in this browser. They'll be there next time you visit!

To see them in DevTools (F12 → Console):
```javascript
JSON.parse(localStorage.getItem("customNPCs"))
```

To clear everything:
```javascript
localStorage.clear()
location.reload()
```

---

**That's it! You're ready to create custom NPCs! 🎬**
