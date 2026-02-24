# Custom NPC System - Implementation Summary

## What's New

Users can now create their own NPCs with:
- **Custom PNG Images** - Upload any character artwork
- **Custom Fonts** - Choose from presets or upload TTF/OTF files
- **Custom Voice Lines** - Add audio files (MP3, OGG, WAV) for different emotions
- **Custom Theme Color** - Set text color via color picker

## Technical Architecture

### Data Storage (localStorage)
```javascript
customNPCs {
  "npcname": {
    image: "data:image/png;base64,...",
    font: "FontName",
    textColor: "#FFFFFF",
    voiceLines: {
      "SAY1": "data:audio/mp3;base64,...",
      "SHOUT1": "data:audio/mp3;base64,...",
      ...
    }
  }
}

customNpcFonts {
  "npcname": "FontName"
}

customNpcColors {
  "npcname": "#FFFFFF"
}
```

### Key Functions Added

#### `getNpcFont(npc)`
Returns the appropriate font for an NPC, checking custom fonts first

#### `getNpcSounds(npc, emotion)`
Enhanced to check custom NPC voice lines first, falls back to preset sounds

#### `createCustomNpcElement(npcName, imageData)`
Creates an `<img>` element in the game and adds it to `npcs` object

#### `addNpcToSpeakerDropdown(npcName)`
Adds custom NPC to the Speaker dropdown automatically

#### `finializeNpcCreation(npcName, imageData, fontName, fontData)`
Saves all NPC data to localStorage and updates UI

#### `loadCustomNpcs()`
Loads all custom NPCs on page load and recreates elements

### UI Components Added

**Custom NPC Creator Section** (HTML):
- NPC Name input
- PNG Image file picker
- Font selector (preset or custom)
- Font file picker (TTF/OTF)
- Text color picker
- Voice files drag-and-drop area

**Voice Line System**:
- Drag-and-drop interface
- Supports multiple files per emotion
- File naming convention: `SAY1.mp3`, `SHOUT1.mp3`, etc.
- Automatically detects emotion from filename

### Integration Points

1. **Speaker Dropdown** - Custom NPCs appear in list
2. **Emotion Dropdown** - Works with custom voice lines
3. **Font Preview** - Text preview uses custom fonts/colors
4. **Voice Playback** - `playNPCSound()` checks custom voices first
5. **Dialogue Display** - Uses custom font and color
6. **Game Rendering** - Custom images display in scenes

## Usage Flow

1. User fills NPC Creator form
2. Clicks "✅ Create NPC" button
3. System validates input
4. Reads files as data URLs
5. Saves everything to localStorage
6. Creates game element
7. Adds to speaker dropdown
8. User can immediately use in dialogue scripts

## Features Supported

✅ Bottom NPCs (like Dave/Penny)  
✅ Top NPCs (like Zomboss)  
✅ Enter/Leave scenes  
✅ Custom emotions (SAY, SHOUT, EXCITED, TIRED, PLAYFUL)  
✅ Multiple voice files per emotion  
✅ Font preview in editor  
✅ Color preview in editor  
✅ Persistent storage between sessions  

## Browser Compatibility

- **Storage**: Works in all modern browsers (localStorage supported)
- **Data URLs**: Efficient storage without server
- **Audio Formats**: MP3, OGG, WAV
- **Font Formats**: TTF, OTF (via @font-face)
- **File Drag & Drop**: Works on desktop and some mobile browsers

## Limitations

- localStorage limited to 5-50MB depending on browser
- Data URLs can be large; image/audio compression recommended
- Custom font CSS injection may not work in strict CSP environments
- Voice line playback depends on browser audio support

## Files Modified

1. **index.html** - Added custom NPC creator form
2. **script.js** - Added all custom NPC logic
3. **style.css** - Added styling for custom NPC inputs

## Files Created

1. **CUSTOM_NPC_GUIDE.md** - User-facing documentation
2. **CUSTOM_NPC_IMPLEMENTATION.md** - This technical summary

---

Users can now create unlimited custom NPCs with full feature parity with built-in characters!
