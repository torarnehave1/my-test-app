# Visibility Control Feature - Quick Start Guide

## What Changed?

✨ **New Feature**: Superadmins can now show/hide major page elements and save those preferences to the knowledge graph.

## How to Use

### As a Superadmin

1. **Login** using the "Login" button with your Superadmin email
2. **Hover over page elements** - You'll see small purple toggle buttons (👁️) appear in the corners
3. **Click any toggle button** to open the visibility control panel
4. **In the panel**, toggle switches on/off to show/hide elements
5. **Click "Save"** to save your preferences to the graph
6. **Settings persist** - Reload the page and your visibility choices remain!

### What Elements Can I Control?

- ✅ **Header with Image** - The page header with the Vegvisr logo and title
- ✅ **Statistics Cards** - The three cards showing Graph ID, nodes loaded, and navigation buttons
- ✅ **Nodes Navigation** - The row displaying clickable node pills
- ✅ **Main Node Content** - The big card showing node details, JSON, and debug information

## Visual Guide

### Before Login
```
Normal view with all elements visible
No visibility toggles visible
```

### After Superadmin Login
```
All elements now have small purple 👁️ buttons in top-right corner
These buttons are NOT visible to regular users
```

### Opening the Control Panel
```
Click any 👁️ button → Floating panel appears at bottom-right
Shows all controllable elements with toggle switches
```

### The Control Panel
```
┌─────────────────────────────────┐
│  Element Visibility             │
├─────────────────────────────────┤
│ Header with Image       [ON]     │
│ Statistics Cards        [ON]     │
│ Nodes Navigation        [OFF]    │ ← Hidden
│ Main Node Content       [ON]     │
├─────────────────────────────────┤
│  [Save]  [Close]                │
└─────────────────────────────────┘
```

## Behind the Scenes

### Where Are Settings Stored?

Settings are saved in a special JSON node in your current graph:

```
Node ID:   __CONNECT_VISIBILITY_SETTINGS__
Node Type: visibility-settings
Node Label: "Visibility Settings"
```

This node is **automatically created** if it doesn't exist, or **automatically updated** if it does.

### Example Settings Node Content

```json
{
  "title": "Visibility Settings",
  "description": "Auto-generated settings node for page element visibility",
  "visibility": {
    "header": true,
    "stats": true,
    "nodesList": false,
    "mainContent": true
  },
  "updatedAt": "2025-02-02T10:30:00.000Z",
  "updatedBy": "admin@vegvisr.org"
}
```

## Permissions

- **Superadmins**: Can see and control all visibility toggles
- **Regular Users**: Cannot see toggle buttons, but see the saved visibility state
- **Not Logged In**: See the default visibility state (all elements visible)

## Tips & Tricks

💡 **Tip 1**: You can toggle all elements on/off individually - no need to save after each toggle
💡 **Tip 2**: Changes are applied **immediately** in the UI, save when you're happy
💡 **Tip 3**: Settings are **graph-specific** - different graphs can have different visibility settings
💡 **Tip 4**: The settings node is never shown in the filtered node list (it's hidden by the label filter)

## Troubleshooting

### "Element doesn't show/hide"
- Make sure you clicked "Save" in the control panel
- Check browser console for any errors
- Try reloading the page

### "Can't see the toggle buttons"
- Make sure you're logged in as a Superadmin
- Hover over page elements - the buttons appear on hover
- Check your browser's developer tools (F12) to verify your role

### "Settings didn't save"
- Check that you have internet connection
- Verify the graph ID is correct
- Look at browser console for error messages
- Make sure you have permission to edit the graph

## For Developers

### Adding More Controllable Elements

Want to add another element to control? Just 3 steps:

1. **Add the HTML attributes**:
   ```html
   <div class="controllable-element" data-element-id="myNewElement">
     <!-- your content -->
     <button type="button" class="visibility-toggle" title="Toggle visibility"></button>
   </div>
   ```

2. **Add a label** in the `getElementLabel()` function (around line 1442):
   ```javascript
   const labels = {
     'header': 'Header with Image',
     'stats': 'Statistics Cards',
     'myNewElement': 'My New Element'  // Add this
   };
   ```

3. **Done!** The visibility system automatically picks it up.

### Key Files & Functions

- **File**: `connecthtml-fixed.html`
- **Visibility Functions**: Lines ~1400-1530
- **HTML Panel**: Line ~1213-1219
- **CSS Styles**: Lines ~1080-1120

## Future Ideas

🚀 Could this feature include:
- Export/import visibility presets?
- Schedule visibility changes (show element at specific times)?
- Different visibility settings per user role?
- Keyboard shortcuts for quick toggling?

Let us know what would be useful!
