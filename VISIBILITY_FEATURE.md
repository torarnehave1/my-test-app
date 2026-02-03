# Element Visibility Control Feature

## Overview

A new visibility control system has been added to the Vegvisr Connect page that allows **Superadmins** to show/hide key page elements. The visibility settings are automatically saved to and loaded from a special JSON node in the knowledge graph.

## How It Works

### For Superadmins

1. **Visibility Toggles**: When logged in as a Superadmin, small purple toggle buttons (👁️ icon) appear in the top-right corner of controllable elements on hover.

2. **Visibility Panel**: Clicking any toggle button opens a floating visibility control panel at the bottom-right of the screen showing all available elements.

3. **Toggle Elements**: In the panel, click on the toggle switches next to each element name to show/hide it.

4. **Save Settings**: Click the "Save" button to persist the visibility settings to the graph in a special settings node.

5. **Close Panel**: Click "Close" to dismiss the visibility panel without saving.

### For Regular Users

- Regular users cannot see the visibility toggle buttons
- All elements display normally based on the saved visibility settings
- Previously hidden elements remain hidden until a Superadmin re-enables them

## Controllable Elements

Currently, the following page elements are controllable:

| Element ID | Label | Description |
|-----------|-------|-------------|
| `header` | Header with Image | The page header with background image and title |
| `stats` | Statistics Cards | The three cards showing Graph ID, Nodes loaded, and Navigation |
| `nodesList` | Nodes Navigation | The row displaying node navigation pills |
| `mainContent` | Main Node Content | The main card displaying node preview, JSON, and debug info |

## Data Storage

### Settings Node Structure

Visibility settings are stored in a special JSON node with:

- **Node ID**: `__CONNECT_VISIBILITY_SETTINGS__` (automatically created/updated)
- **Node Type**: `visibility-settings`
- **Node Label**: "Visibility Settings"

### Settings JSON Format

```json
{
  "title": "Visibility Settings",
  "description": "Auto-generated settings node for page element visibility (managed by Superadmin)",
  "visibility": {
    "header": true,
    "stats": true,
    "nodesList": true,
    "mainContent": true
  },
  "updatedAt": "2025-02-02T10:30:00.000Z",
  "updatedBy": "admin@vegvisr.org"
}
```

The `visibility` object maps element IDs to boolean values:
- `true` = element is visible
- `false` = element is hidden

## Technical Details

### New CSS Classes

- `.controllable-element` - Applied to elements that can be shown/hidden
- `.visibility-toggle` - The button used to open the control panel
- `.hidden-element` - Applied to hidden elements (opacity 0.5, pointer-events none)
- `.visibility-panel` - The floating control panel
- `.visibility-toggle-switch` - The toggle switch in the panel
- `.visibility-item` - An item in the visibility panel

### New JavaScript Functions

- `initializeVisibilityControls()` - Sets up visibility controls for Superadmins
- `openVisibilityPanel(focusElementId)` - Opens the visibility control panel
- `closeVisibilityPanel()` - Closes the panel
- `getElementLabel(elementId)` - Gets human-readable labels for elements
- `applyVisibilitySettings()` - Applies visibility settings to DOM
- `loadVisibilitySettings()` - Loads settings from the graph's settings node
- `saveVisibilitySettings()` - Saves settings to the graph's settings node

### Key Features

✅ Automatic node creation if settings node doesn't exist
✅ Automatic node update if it already exists
✅ Settings persist across page reloads
✅ Real-time toggle with visual feedback
✅ Only visible to Superadmins
✅ Audit trail (stores updatedBy and updatedAt)

## Adding More Controllable Elements

To add a new controllable element:

1. **Add the HTML class and attribute**:
   ```html
   <div class="controllable-element" data-element-id="myElement">
     <!-- content -->
     <button type="button" class="visibility-toggle" title="Toggle visibility"></button>
   </div>
   ```

2. **Add the label** in `getElementLabel()` function:
   ```javascript
   const labels = {
     'header': 'Header with Image',
     'stats': 'Statistics Cards',
     'myElement': 'My New Element'  // Add this
   };
   ```

That's it! The visibility system will automatically detect the new element and add it to the control panel.

## Important Notes

- The visibility settings are graph-specific (stored in the current graph)
- Only Superadmins can modify visibility settings
- Changes are applied immediately in the UI
- Settings are only persisted when the "Save" button is clicked
- The settings node is not filtered by the label search (it has a special ID)

## Future Enhancements

Potential improvements that could be added:

- Individual element permissions (different Superadmins control different elements)
- Scheduled visibility changes (show/hide elements at specific times)
- Device/viewport-specific visibility (different on mobile vs desktop)
- User role-based visibility (show elements only for specific roles)
- Visibility profiles (save multiple configurations and switch between them)
