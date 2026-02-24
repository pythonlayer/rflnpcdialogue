# Browser Storage Crash Fix - Quick Summary

## What Was Fixed
The app was crashing when saving custom NPCs because files were being stored in browser localStorage, which has a 5-10MB limit. When you added multiple NPCs with images and audio, the storage would overflow and crash.

## What Changed
✅ Large files (images, audio, fonts, lawn backgrounds) now use **IndexedDB** instead of localStorage
✅ IndexedDB has **50MB+ storage** (10x more than localStorage)
✅ **Automatic migration** - your existing custom NPCs are converted automatically
✅ **No manual action needed** - just refresh and everything works

## Result
- ✅ Save **unlimited custom NPCs** (within IndexedDB limits)
- ✅ Use **large high-quality images**
- ✅ **No more crashes** from storage overflow
- ✅ **Better performance** for file operations

## How It Works
1. When app starts, it checks for old custom NPCs in localStorage
2. Automatically migrates large files to IndexedDB (transparent to you)
3. Continues working exactly like before, but with unlimited storage
4. New custom NPCs save directly to IndexedDB

## Technical Details
- **Metadata**: Stored in localStorage (NPC names, settings)
- **Large Files**: Stored in IndexedDB (images, audio, fonts)
- **Database**: IndexedDB named "DialogueMakerDB"
- **Migration**: Runs automatically, non-blocking

## Browser Compatibility
Works on all modern browsers (Chrome, Firefox, Safari, Edge, etc.) that support IndexedDB.

## Troubleshooting
If you experience any issues:
1. Clear your browser's IndexedDB cache: Settings → Privacy → Clear browsing data → Cookies and other site data
2. Refresh the page and recreate your custom NPCs
3. Contact support if problems persist
