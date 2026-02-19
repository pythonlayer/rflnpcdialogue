# 🎬 Dialogue Maker - Custom NPC System

## Welcome!

You now have a **complete custom NPC creation system** built right into the dialogue maker! 

### What's New?

Users can create their own NPCs with:
- 🎨 **Custom Images** (PNG)
- 🔤 **Custom Fonts** (TTF/OTF)
- 🎤 **Custom Voice Lines** (MP3/OGG/WAV)
- 🌈 **Custom Theme Colors** (any hex color)

All saved in browser = **NO SERVER NEEDED!**

---

## 📖 Documentation

Choose your starting point:

### 🚀 **Just Want to Start?**
→ Read **[QUICKSTART.md](QUICKSTART.md)**  
*5 min read - get creating immediately*

### 📚 **Want Full Details?**
→ Read **[CUSTOM_NPC_GUIDE.md](CUSTOM_NPC_GUIDE.md)**  
*Complete user guide with examples and troubleshooting*

### ⚡ **Need Quick Reference?**
→ Check **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)**  
*Cheat sheet with voice naming, colors, shortcuts*

### 🔧 **Technical Details?**
→ See **[CUSTOM_NPC_IMPLEMENTATION.md](CUSTOM_NPC_IMPLEMENTATION.md)**  
*How the system works under the hood*

### ✅ **What's Complete?**
→ View **[VERIFICATION.md](VERIFICATION.md)**  
*Feature checklist and verification status*

---

## ⚡ 30-Second Summary

### Create an NPC:
1. **Scroll to top** → See "➕ Create Custom NPC"
2. **Fill form**: name, image (PNG), font, color
3. **Add voice files**: Drag SAY1.mp3, SHOUT1.mp3, etc.
4. **Click**: "✅ Create NPC"
5. **Done!** Use in dialogue scripts

### Use in Script:
```json
[
  { "type": "enter", "speaker": "mynpc" },
  { "type": "say", "speaker": "mynpc", "emotion": "SHOUT", "text": "Hello!" },
  { "type": "leave", "speaker": "mynpc" }
]
```

---

## 📋 Voice File Naming

**IMPORTANT:** Files must be named by emotion:

```
SAY1.mp3          → Regular dialogue
SHOUT1.mp3        → Shouting
EXCITED1.mp3      → Excited
TIRED1.mp3        → Tired
PLAYFUL1.mp3      → Playful
```

Supports multiple files per emotion (e.g., SAY1.mp3, SAY2.mp3, SAY3.mp3)

---

## 🎨 Features

✅ **Unlimited Custom NPCs** - Create as many as you want  
✅ **Full Feature Parity** - Works exactly like built-in NPCs  
✅ **Persistent Storage** - Data saved in browser (survives reload)  
✅ **No Server** - Everything stored locally  
✅ **Mobile Friendly** - Works on phones and tablets  
✅ **Preview System** - See fonts and colors while editing  
✅ **Drag & Drop** - Easy file uploads  
✅ **Multiple Voices** - Random variety per emotion  

---

## 🔍 Browser Storage

Your custom NPCs are stored in your browser's **local storage**:

### View Your NPCs (DevTools)
```javascript
// Press F12 → Console → Type:
JSON.parse(localStorage.getItem("customNPCs"))
```

### Clear Everything
```javascript
localStorage.clear()
location.reload()
```

**Note:** Data is stored per browser/device. It won't sync across devices.

---

## 📁 Files in This Project

### Core Files (Modified)
- **index.html** - Added custom NPC creator form
- **script.js** - Added NPC creation system
- **style.css** - Added form styling

### Documentation Files (New)
- **QUICKSTART.md** - Get started in 5 minutes
- **CUSTOM_NPC_GUIDE.md** - Complete guide with examples
- **QUICK_REFERENCE.md** - Cheat sheet & troubleshooting
- **CUSTOM_NPC_IMPLEMENTATION.md** - Technical details
- **VERIFICATION.md** - Feature checklist
- **SYSTEM_SUMMARY.md** - High-level overview
- **INSTALLATION_COMPLETE.md** - Completion summary
- **README.md** - This file

---

## 🎯 Quick Start Examples

### Example 1: Create "MyRobot"
```
Name:   myrobot
Image:  robot.png
Font:   Arial
Color:  #00FF00 (green)
Voices: myrobot_say.mp3, myrobot_shout.mp3
```

### Example 2: Create "Talking Teddy"
```
Name:   teddy
Image:  teddy_bear.png
Font:   Upload: friendly.ttf
Color:  #FF69B4 (hot pink)
Voices: teddy_say1.mp3, teddy_say2.mp3, teddy_excited.mp3
```

### Example 3: Create "Evil Robot"
```
Name:   evilbot
Image:  evil_robot.png
Font:   Upload: roboto.ttf
Color:  #FF0000 (red)
Voices: evil_shout.mp3, evil_laugh.mp3, evil_playful.mp3
```

---

## ⚙️ System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- File API support (upload files)
- localStorage support (persistent storage)
- Audio support (play sounds)
- ~5-50MB browser storage available

---

## 🆘 Troubleshooting

| Issue | Fix |
|-------|-----|
| **NPC missing from dropdown** | Reload page (Ctrl+R) |
| **Sounds don't play** | Check file names (SAY1, not Say1) |
| **Font looks wrong** | Try a different TTF file |
| **Lost custom NPC data** | Check localStorage wasn't cleared |
| **Can't upload files** | Check file size and format |

See **[CUSTOM_NPC_GUIDE.md](CUSTOM_NPC_GUIDE.md)** for more help.

---

## 🚀 You're Ready to Go!

The custom NPC system is fully implemented and ready to use.

### Next Steps:
1. **Open the application** in your browser
2. **Scroll to the top**
3. **See "➕ Create Custom NPC" section**
4. **Follow [QUICKSTART.md](QUICKSTART.md)** for 5-minute guide
5. **Start creating!**

---

## 📞 Questions?

Check the relevant documentation:
- **How do I...?** → [CUSTOM_NPC_GUIDE.md](CUSTOM_NPC_GUIDE.md)
- **Quick answer** → [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **How's it work?** → [CUSTOM_NPC_IMPLEMENTATION.md](CUSTOM_NPC_IMPLEMENTATION.md)
- **Is it done?** → [VERIFICATION.md](VERIFICATION.md)

---

## 📝 License & Credits

Custom NPC System created for dialogue maker.  
Stores all data locally in browser - no external servers needed.

---

**Happy Creating! 🎬🎨🎤**
