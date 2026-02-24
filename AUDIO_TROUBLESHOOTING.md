# Background Music & Intro Sound Troubleshooting

## Fixed Issues
✅ Audio loading is now more reliable
✅ Added explicit `.load()` calls before play
✅ Using Promise-based `.play()` for better error handling
✅ Added detailed console logging to debug audio loading

## How to Check What's Wrong

1. **Open Browser Developer Tools** (F12 or Right-click → Inspect)
2. **Go to Console tab**
3. **Click Play to start a scene**
4. **Look for console messages:**

### If You See These Messages ✅
```
Starting background music: BACKGROUND.mp3
Background music playing successfully
Playing intro sound for dave : Dave/INTRO.ogg
Intro playing successfully
Intro finished, starting background music
```
**= Everything is working correctly!**

### If You See These Errors ❌

#### Error 1: File Not Found
```
Background music load error for: BACKGROUND.mp3 - File may not exist or path is incorrect
```
**Solution:**
- Check that `BACKGROUND.mp3` exists in the root directory (same level as `index.html`)
- If it's in a subdirectory, update the path in script.js line 489
- Common paths:
  - `"BACKGROUND.mp3"` (root directory)
  - `"music/BACKGROUND.mp3"` (in music folder)
  - `"audio/BACKGROUND.mp3"` (in audio folder)

#### Error 2: Intro File Not Found
```
Intro load error for: Dave/INTRO.ogg - File may not exist or path is incorrect
```
**Solution:**
- Check that `Dave/INTRO.ogg` exists in correct folder structure
- All intro sounds should be in `[NpcName]/INTRO.ogg`
- Make sure folder names match exactly (case-sensitive on Linux/Mac):
  - `Dave/INTRO.ogg` ✓
  - `dave/intro.ogg` ✗ (wrong case)

#### Error 3: Playback Permission Denied
```
Background music play error: NotAllowedError: play() failed because the user didn't interact with the document first.
```
**Solution:**
- This is a browser security feature
- User must click somewhere on the page first (the Play button does this)
- Usually resolves itself, just click Play

#### Error 4: CORS/Network Error
```
Background music play error: NetworkError: A network error occurred.
```
**Solution:**
- File might be inaccessible or blocked
- Check file permissions
- Make sure file isn't corrupted
- Try refreshing the page

## File Structure Checklist

Your project should have this structure:

```
dialogue/
├── index.html
├── script.js
├── style.css
├── BACKGROUND.mp3                    ← Default background music
├── Dave/
│   ├── INTRO.ogg                    ← Dave intro
│   ├── BACKGROUND.ogg               ← Dave background music
│   └── (other Dave files)
├── Weenie/
│   ├── INTRO.ogg
│   ├── BACKGROUND.ogg
│   └── (other Weenie files)
├── Camo/
│   ├── INTRO.ogg
│   ├── BACKGROUND.ogg
│   └── (other Camo files)
└── (other NPC folders)
```

## Quick Fixes to Try

1. **Make sure Music is enabled**
   - Check the "Enable Music" checkbox in the UI

2. **Try refreshing the page**
   - Sometimes browser cache causes issues
   - Press Ctrl+F5 or Cmd+Shift+R

3. **Check browser console for errors**
   - F12 → Console tab
   - Look for any red error messages

4. **Verify file paths**
   - Are files in the correct directories?
   - Do folder names match the code exactly?

5. **Test with a simple file**
   - Try renaming BACKGROUND.mp3 to BACKGROUND.mp3.bak
   - Create a new simple BACKGROUND.mp3 file
   - See if that plays

## For Custom NPCs

Custom NPCs can have their own intro and background music:

When creating a custom NPC, you can upload:
- **Intro Sound**: Optional - plays when NPC enters
- **Background Music**: Optional - plays after intro

If intro sound is missing, it skips straight to background music ✓
If background music is missing, it falls back to default background ✓

## Need More Help?

Check the console messages for the exact issue. The error messages now include:
- Which file couldn't be loaded
- What the issue might be (file not found vs permission denied vs other)
- Exact file path being attempted

All this information will help diagnose what's wrong!
