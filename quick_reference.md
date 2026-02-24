# Custom NPC System - Quick Reference Card

## 🎬 Creating an NPC - 5 Steps

```
Step 1: Name          → Enter NPC name (e.g., "mybot")
Step 2: Image         → Upload PNG file (e.g., mybot.png)
Step 3: Font          → Select from list OR upload TTF/OTF
Step 4: Color         → Pick text color (default: white)
Step 5: Voice Files   → Drag audio files into box
        
DONE: Click "✅ Create NPC" button
```

## 🎤 Voice File Naming

Required naming pattern for audio files:

| File Name | When Used |
|-----------|-----------|
| `SAY1.mp3` `SAY2.mp3` | Default dialogue (random pick) |
| `SHOUT1.mp3` | When emotion = "SHOUT" |
| `EXCITED1.mp3` | When emotion = "EXCITED" |
| `TIRED1.mp3` | When emotion = "TIRED" |
| `PLAYFUL1.mp3` | When emotion = "PLAYFUL" |

**Notes:**
- You only need ONE file per emotion
- Multiple files = random variety
- Case-insensitive
- Format: MP3, OGG, WAV

## 📝 Using Custom NPC in Script

```json
{
  "type": "enter",
  "speaker": "mybot"
}

{
  "type": "say",
  "speaker": "mybot",
  "emotion": "SAY",
  "text": "Hello world!"
}

{
  "type": "say",
  "speaker": "mybot",
  "emotion": "SHOUT",
  "text": "WAKE UP!"
}

{
  "type": "leave",
  "speaker": "mybot"
}
```

## 🎨 Theme Colors (Hex Format)

Common colors for custom NPCs:

```
#FFFFFF  White (default)
#FF0000  Red
#00FF00  Green
#0000FF  Blue
#FFFF00  Yellow
#FF00FF  Magenta
#00FFFF  Cyan
#FFD700  Gold
#FFA500  Orange
```

Use any hex color code!

## 📁 File Requirements

| Type | Format | Size | Notes |
|------|--------|------|-------|
| Image | PNG | 500-1000px | Transparent background best |
| Font | TTF, OTF | Any | Valid font files only |
| Audio | MP3, OGG, WAV | 2-5 sec each | Keep files small |

## 💾 Storage Location

All NPCs saved in browser:
- **Location:** localStorage (browser's local storage)
- **Persists:** Until cleared
- **Scope:** This website only, this browser only
- **Limit:** 5-50MB depending on browser

### View Stored NPCs (DevTools)
```javascript
// Press F12 → Console, then:
JSON.parse(localStorage.getItem("customNPCs"))
```

### Clear Everything
```javascript
localStorage.clear()
location.reload()
```

## ✅ What Works

✅ Multiple custom NPCs  
✅ Each with unique art  
✅ Custom fonts per NPC  
✅ Custom colors per NPC  
✅ Multiple voice files per emotion  
✅ Enter/Leave scenes  
✅ All emotions (SAY, SHOUT, etc.)  
✅ Persistent storage  
✅ Preview in editor  
✅ Test sounds  

## ⚠️ Common Mistakes

❌ **File names wrong**  
→ Use exactly: SAY1, SHOUT1, EXCITED1, etc.

❌ **PNG not transparent**  
→ Upload PNG with transparent background

❌ **NPC not in dropdown**  
→ Reload page (Ctrl+R) or check form validation

❌ **Sounds don't play**  
→ Check file name matches emotion exactly

❌ **Font not showing**  
→ Try different TTF file (may be corrupted)

## 🚀 Example: Create "C3P0 Bot"

```
1. Name: c3p0bot
2. Image: c3p0.png (droid artwork)
3. Font: Arial
4. Color: #FFD700 (gold)
5. Voice files:
   - SAY1.mp3 (beep sound)
   - SHOUT1.mp3 (loud beep)
   - EXCITED1.mp3 (beeping excited)
   
✅ Click Create!
```

**In Script:**
```json
{ "type": "say", "speaker": "c3p0bot", "emotion": "SAY", "text": "Beep boop!" }
```

**Result:**
- Shows C3P0 image (your PNG)
- Text in gold color
- Plays SAY1.mp3 beeping sound

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| NPC not in dropdown | Reload page or check all fields filled |
| Sounds silent | Check file names (SAY1 not Say1) |
| Font weird | Upload different TTF file |
| Can't upload files | Check file size and format |
| Lost data | Check if localStorage was cleared |

## 📚 Full Documentation

- **QUICKSTART.md** - Quick start guide
- **CUSTOM_NPC_GUIDE.md** - Complete guide with examples
- **SYSTEM_SUMMARY.md** - How the system works

---

**Quick Checklist Before Creating:**
- [ ] NPC name decided
- [ ] PNG image ready
- [ ] Font selected or file chosen
- [ ] Color picked
- [ ] Voice files named correctly (SAY1, SHOUT1, etc.)
- [ ] All files ready to upload

**GO CREATE YOUR CUSTOM NPC!** 🎬
