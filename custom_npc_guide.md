# Custom NPC Creator Guide

## Overview
You can now create your own custom NPCs with unique images, fonts, colors, and voice lines! All custom NPCs are saved in your browser's local storage and will persist between sessions.

## Creating a Custom NPC

### Step 1: Enter NPC Details
1. **NPC Name**: Enter a unique name for your character (e.g., "MyBot", "CustomHero")
   - Name will be automatically converted to lowercase
   - Used in dropdown menus and script

### Step 2: Upload Image
1. **NPC Image**: Select a PNG file for your character
   - Should be a transparent PNG for best results
   - Recommended size: 500x500px or larger
   - Will be displayed at the same positions as other NPCs

### Step 3: Choose Font
1. **Font Name**: Select from preset fonts or upload custom
   - **Preset Options**: Arial, Brianne's Hand, Ashley Script, ROG Lyons Type, etc.
   - **Custom Font**: Select "Upload Custom Font" to add your own TTF or OTF file
   - Selected font will be used for all dialogue from this NPC

### Step 4: Set Text Color
1. **Text Color**: Click the color picker to set dialogue text color
   - Default: White (#FFFFFF)
   - Can be any hex color

### Step 5: Add Voice Lines
Add audio files for different emotions:

1. **Drag & Drop**: Drag audio files directly onto the dashed box, OR
2. **Click to Select**: Click the box to browse and select files

### Voice Line Naming Convention
Name your audio files to match emotions:

```
SAY1.mp3          → SAY emotion (default)
SAY2.mp3          → SAY emotion (random)
SHOUT1.mp3        → SHOUT emotion
SHOUT2.mp3        → SHOUT emotion (random)
EXCITED1.mp3      → EXCITED emotion
TIRED1.mp3        → TIRED emotion
PLAYFUL1.mp3      → PLAYFUL emotion
```

**Supported formats**: MP3, OGG, WAV

**Optional**: You can have multiple files per emotion (SAY1, SAY2, SAY3, etc.) for variety

### Step 6: Create NPC
1. Click the **✅ Create NPC** button
2. Your custom NPC will appear in the Speaker dropdown
3. All data is saved to your browser's local storage

## Using Custom NPCs

### In Dialogue Scripts
1. Open the **Speaker** dropdown
2. Your custom NPC will appear at the bottom of the list
3. Select emotions (SAY, SHOUT, EXCITED, TIRED, PLAYFUL) just like built-in NPCs
4. Add text and create dialogue

### Features
- **Custom Image**: Displays in game scenes
- **Custom Font**: Text uses your selected font
- **Custom Color**: Dialogue text uses your color
- **Custom Sounds**: Voice lines play based on emotion
- **Full Support**: Can Enter/Leave scenes, interact with built-in NPCs

### Example Script
```json
[
  { "type": "enter", "speaker": "mybot" },
  { "type": "say", "speaker": "mybot", "emotion": "SAY", "text": "Hello, I'm a custom NPC!" },
  { "type": "say", "speaker": "mybot", "emotion": "EXCITED", "text": "This is awesome!" },
  { "type": "leave", "speaker": "mybot" }
]
```

## Storage & Persistence

### Automatic Storage
- All custom NPCs are saved to **browser localStorage**
- Data persists across sessions
- Unique per browser/device

### Viewing Stored Data
Open browser DevTools (F12) → Console:
```javascript
// View all custom NPCs
JSON.parse(localStorage.getItem("customNPCs"))

// View custom fonts
JSON.parse(localStorage.getItem("customNpcFonts"))

// View custom colors
JSON.parse(localStorage.getItem("customNpcColors"))
```

### Clearing Custom NPCs
In browser DevTools Console:
```javascript
localStorage.removeItem("customNPCs");
localStorage.removeItem("customNpcFonts");
localStorage.removeItem("customNpcColors");
localStorage.removeItem("customNpcVoiceLines");
// Then refresh the page
```

## Tips & Best Practices

### Image Quality
- Use PNG format with transparency for best results
- Square or landscape aspect ratios work best
- 500x500px to 1000x1000px recommended
- Minimize file size for faster loading

### Voice Lines
- Keep audio files short (2-5 seconds typical)
- Use consistent volume levels across files
- Naming is important (SAY1, SHOUT1, etc.)
- More files per emotion = more variety

### Fonts
- TTF (TrueType) works best
- OTF (OpenType) also supported
- Keep file size under 5MB
- Test font legibility at small sizes

### Color
- Use high contrast colors for readability
- Test against dark background
- Avoid very light colors on light dialogue background

## Troubleshooting

### NPC doesn't appear in dropdown
- Check that you completed all required fields
- Reload the page
- Clear localStorage and recreate

### Sounds don't play
- Verify file names match emotion convention (SAY1, SHOUT1, etc.)
- Check browser console for errors (F12)
- Test in a different browser
- Ensure audio files aren't corrupted

### Custom font not applying
- Verify font file is valid TTF or OTF
- Check browser console for errors
- Try a different font
- Clear localStorage and reload

### Game performance slow
- Reduce image file sizes
- Use fewer voice line files
- Clear unused custom NPCs

## Limitations

- **Storage limit**: Depends on browser (usually 5-50MB)
- **Voice limits**: Browser audio context limitations
- **Font display**: Some fonts may not render identically across browsers
- **Mobile**: Tested on iOS/Android but may vary

## Advanced: Manual Data Editing

In DevTools Console, you can manually add properties to custom NPCs:

```javascript
let npcs = JSON.parse(localStorage.getItem("customNPCs"));
npcs['mybot'].textColor = '#FF0000'; // Change text color
localStorage.setItem("customNPCs", JSON.stringify(npcs));
location.reload();
```

Enjoy creating your custom characters! 🎬🎨🎤
