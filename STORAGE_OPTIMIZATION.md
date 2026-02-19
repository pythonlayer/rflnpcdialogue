# Storage Optimization - IndexedDB Migration

## Problem Fixed
The application was crashing when saving custom NPCs because all files (images, audio, fonts) were being converted to base64 data URLs and stored in **localStorage**, which has a very limited storage limit (~5-10MB per domain). Large custom NPCs would quickly exceed this limit and cause the browser to crash.

## Solution
Implemented **IndexedDB** storage system which provides:
- **Much larger storage**: 50MB+ (vs 5-10MB for localStorage)
- **Better performance**: Binary data storage without base64 bloat
- **Structured storage**: Organized by NPC, file type, and more
- **Backward compatibility**: Automatically migrates old custom NPCs from localStorage to IndexedDB

## What Changed

### 1. New IndexedDB Manager (DBManager)
A new database manager (`DBManager`) has been added that handles:
- Saving large files (images, audio, fonts) to IndexedDB
- Retrieving files from IndexedDB with async/await
- Organizing files by NPC name and file type
- Automatic database initialization

### 2. Storage Structure
**localStorage** (small metadata only):
- NPC names and settings
- Font choices
- Text colors
- Position (front/back)

**IndexedDB** (large files):
- NPC images (as data URLs)
- NPC voice lines (as data URLs)
- Custom fonts
- Lawn background

### 3. Custom NPC Creation
Files are now saved to IndexedDB instead of localStorage:
- Images stored in IndexedDB with reference keys
- Voice files stored in IndexedDB with reference keys
- Metadata stored in both localStorage (for quick access) and IndexedDB (for backup)

### 4. Automatic Migration
When the app loads, it automatically:
1. Detects old custom NPCs with data URLs in localStorage
2. Migrates all large files to IndexedDB
3. Updates the NPC metadata to use reference-based system
4. Continues without interruption

### 5. Image and Voice Retrieval
- `setNpcImageForEmotion()` now fetches images from IndexedDB asynchronously
- `playNPCSound()` now fetches voice files from IndexedDB asynchronously

### 6. Lawn Background
Custom lawn backgrounds are now stored in IndexedDB instead of localStorage

## Benefits
✅ **No more crashes** from localStorage overflow  
✅ **Save unlimited custom NPCs** (within reason)  
✅ **Large images and audio files** can be used  
✅ **Automatic migration** of existing custom NPCs  
✅ **Backward compatible** with existing saved NPCs  
✅ **Better performance** for file operations  

## Technical Details

### DBManager Methods
```javascript
await DBManager.init()                              // Initialize IndexedDB
await DBManager.saveFile(type, npcName, fileName, data)  // Save a file
await DBManager.getFile(type, npcName, fileName)   // Retrieve a file
await DBManager.deleteNpcFiles(npcName)            // Delete all NPC files
await DBManager.saveNpcMetadata(npcName, metadata) // Save NPC metadata
await DBManager.getNpcMetadata(npcName)            // Get NPC metadata
```

### File Organization
```
IndexedDB: DialogueMakerDB
├── Object Store: npcFiles (stores all file data)
│   ├── npcName (index for queries)
│   ├── type: 'image' | 'voice' | 'font' | 'lawn'
│   ├── fileName: reference key
│   └── data: base64 data URL
└── Object Store: customNpcs (stores metadata)
    ├── npcName (primary key)
    ├── imageReferences: {}
    ├── voiceReferences: {}
    ├── font: string
    ├── textColor: string
    └── position: 'front' | 'back'
```

## Migration Process
When the app starts:
1. DBManager initializes IndexedDB
2. Migration function checks all custom NPCs
3. For each NPC with data URLs in localStorage:
   - Copies all image files to IndexedDB
   - Copies all voice files to IndexedDB
   - Updates NPC metadata to use references instead of data URLs
   - Saves updated metadata back to localStorage
4. Process completes silently (non-blocking)

## No User Action Required
The entire process is automatic. Users don't need to do anything - their existing custom NPCs will be migrated automatically on first load after this update.
