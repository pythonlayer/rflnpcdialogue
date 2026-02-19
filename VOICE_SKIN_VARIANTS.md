# Voice Variants & Skin Selection Feature

## Overview
Added support for NPCs to have multiple voice variants and Dave to have multiple skins that can be chosen during dialogue creation and applied during playback.

## Features

### 1. Voice Variants (Dave)
Players can now choose between different voice sets for Dave:
- **Default** - Main voice lines (Dave/SAY1-12, Dave/SHOUT1-6, etc.)
- **Old/Classic** - Classic/birthday voice lines (Dave/old/SAY1-9, Dave/old/SHOUT1-2, etc.)
- **Birthday** - Special birthday voice lines (placeholder, update paths as needed)

**How It Works:**
- Voice variant selector appears when Dave is selected as speaker
- Selector is hidden for all other NPCs
- Choice is stored in the JSON script as `voiceVariant` field
- During playback, getNpcSounds() checks current voice variant to load appropriate audio files
- When lines with voice variants are played, the correct audio set is used

### 2. Skin Variants (Dave)
Players can now choose between different visual skins for Dave:
- **Default** - Dave.png (standard appearance)
- **Evil** - Dave/evil.png (evil costume)
- **Lunar** - Dave/lunardave.png (lunar variant)
- **Anniversary** - Dave/aniversarydave.png (anniversary outfit)

**How It Works:**
- Skin variant selector appears when Dave is selected as speaker
- Selector is hidden for all other NPCs
- Choice is stored in the JSON script as `skinVariant` field
- Dave's image updates immediately when skin is selected in editor
- During playback, setNpcImageForEmotion() applies the selected skin to Dave
- Skin persists throughout dialogue until changed

### 3. N3XT GEN (New NPC)
N3XT GEN is a new NPC character that uses emotion-based sprites like ABS:
- **Neutral** - next.png (default display)
- **SAY** - nextsay.png (speaking state)
- **TIRED** - nexttired.png (tired/exhausted state)

**How It Works:**
- N3XT GEN appears in speaker dropdown
- Uses emotion-based image system (like ABS/AntiBullySquad)
- Image automatically switches based on current emotion
- Positioned at top center (like ABS and back NPCs)
- Has placeholder voice lines (can be updated with actual N3XT audio files)

## JSON Format

### Voice & Skin Variants in Script
```json
{
    "type": "say",
    "speaker": "dave",
    "emotion": "SAY",
    "text": "Hello!",
    "voiceVariant": "old",
    "skinVariant": "evil"
}
```

### Enter Actions with Variants
```json
{
    "type": "enter",
    "speaker": "dave",
    "voiceVariant": "birthday",
    "skinVariant": "lunar"
}
```

**Notes:**
- `voiceVariant` and `skinVariant` fields are optional
- Only used when speaker is "dave"
- When not specified, defaults to "default" for both
- Fields are added to JSON only when non-default values are selected

## UI Elements

### Voice Variant Selector
- **Label**: "Voice Variant"
- **Options**: Default, Old/Classic, Birthday
- **Visibility**: Only visible when speaker is Dave
- **Location**: Below speaker selector in editor

### Skin Variant Selector
- **Label**: "Skin"
- **Options**: Default, Evil, Lunar, Anniversary
- **Visibility**: Only visible when speaker is Dave
- **Location**: Below voice variant selector in editor

### N3XT GEN Selection
- Located in speaker dropdown alongside other NPCs
- Labeled as "N3XT GEN"
- Works like any other NPC in terms of enter/leave and dialogue

## Audio File Structure
```
Dave/
├── SAY1.ogg to SAY12.ogg (default)
├── SHOUT1.ogg to SHOUT6.ogg (default)
├── EXCITED1.ogg to EXCITED6.ogg (default)
├── TIRED1.ogg to TIRED9.ogg (default)
├── PLAYFUL1.ogg to PLAYFUL7.ogg (default)
├── BIRTHDAY_SAY1.ogg (birthday voice)
├── old/
│   ├── SAY1.ogg to SAY9.ogg (classic)
│   ├── SHOUT1.ogg to SHOUT2.ogg (classic)
│   └── EXCITED1.ogg (classic)
├── evil.png (skin)
├── lunardave.png (skin)
├── aniversarydave.png (skin)
├── next.png (N3XT neutral)
├── nextsay.png (N3XT speaking)
└── nexttired.png (N3XT tired)
```

## Implementation Details

### Code Changes

1. **HTML (index.html)**
   - Added voice variant selector (`id="voiceVariant"`)
   - Added skin variant selector (`id="skinVariant"`)
   - Added N3XT GEN option to speaker dropdown
   - Added N3XT GEN image element

2. **CSS (style.css)**
   - Added N3XT positioning (top center, like ABS)
   - Emotion-based image handling for N3XT

3. **JavaScript (script.js)**
   - Added `daveSoundsVariants` object with variant audio mappings
   - Added `daveSkinVariants` object with skin image mappings
   - Added `n3xtSounds` object for N3XT voice lines
   - Updated `getNpcSounds()` to check voice variant selector
   - Updated `setNpcImageForEmotion()` to handle:
     - N3XT emotion-based images
     - Dave skin variants
     - Emotion switching for N3XT
   - Updated speaker change event to show/hide variant selectors
   - Modified `addLineBtn` and `addEnterBtn` to include variant data in script
   - Updated playback to apply variants when playing script
   - Added N3XT to npcs object, fonts, and class list

## Usage Examples

### Example 1: Dave with Old Voice and Evil Skin
```json
{
    "type": "enter",
    "speaker": "dave",
    "voiceVariant": "old",
    "skinVariant": "evil"
}
```
During playback, Dave will:
- Appear as the evil skin (Dave/evil.png)
- Use classic voice lines (Dave/old/SAY1-9, etc.)

### Example 2: N3XT GEN Character
```json
{
    "type": "enter",
    "speaker": "n3xt"
}
```
During playback, N3XT will:
- Appear at top center
- Start with neutral sprite (next.png)
- Switch emotions based on emotion selection

## Backward Compatibility
✅ Fully backward compatible:
- Existing scripts without variant data work normally
- Missing variant fields default to "default" variant
- Works alongside existing custom NPCs
- No breaking changes to save format

## Future Enhancements
1. Add voice variants to other NPCs (Penny, Zomboss, etc.)
2. Add skin variants to other NPCs
3. Per-emotion voice file overrides
4. Voice variant preview button
5. Skin preview in editor
6. Voice/skin pack downloads

## File Locations & Notes

### Voice Variant Files
- Old voice: `Dave/old/` directory
- Birthday voice: Add to `Dave/` root or `Dave/birthday/`
- Update paths in `daveSoundsVariants` if using different structure

### Skin Files
- Evil: `Dave/evil.png`
- Lunar: `Dave/lunardave.png`
- Anniversary: `Dave/aniversarydave.png`
- All skins should be in Dave folder for organization

### N3XT Files
- Neutral: `Dave/next.png`
- Speaking: `Dave/nextsay.png`
- Tired: `Dave/nexttired.png`
- All currently in Dave folder (can be moved to separate N3XT folder later)
