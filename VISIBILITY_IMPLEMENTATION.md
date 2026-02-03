# Visibility Control Implementation Details

## Architecture

The visibility control system consists of three main components:

### 1. **HTML Structure**

#### Controllable Elements
Each controllable element is wrapped with:
```html
<div class="controllable-element" data-element-id="uniqueId">
  <!-- element content -->
  <button type="button" class="visibility-toggle" title="Toggle visibility"></button>
</div>
```

The `data-element-id` attribute uniquely identifies each element and must match the keys in the `visibilitySettings` object.

#### Visibility Panel
A floating panel that appears at the bottom-right of the screen:
```html
<div id="visibilityPanel" class="visibility-panel">
  <div class="visibility-panel-title">Element Visibility</div>
  <div id="visibilityItems" class="visibility-items"></div>
  <div class="visibility-panel-actions">
    <button id="btnSaveVisibility" class="save">Save</button>
    <button id="btnCloseVisibility">Close</button>
  </div>
</div>
```

### 2. **CSS Styling**

#### Key Classes

| Class | Purpose |
|-------|---------|
| `.visibility-toggle` | The small button that opens the panel |
| `.controllable-element` | Parent container for controllable elements |
| `.hidden-element` | Applied when element should be hidden (opacity 0.5) |
| `.visibility-panel` | The floating control panel container |
| `.visibility-panel.active` | Panel visibility state (display: flex) |
| `.visibility-toggle-switch` | The on/off toggle switch in the panel |
| `.visibility-toggle-switch.on` | Switch is in ON position |

#### Styling Features
- Purple accent colors (rgba(139, 92, 246, ...))
- Smooth transitions (0.2s - 0.3s)
- Hover effects on all interactive elements
- Fixed positioning for panel (bottom: 20px, right: 20px)
- High z-index (999) to appear above other content

### 3. **JavaScript State Management**

#### Global State Variables
```javascript
let visibilitySettings = {};        // { elementId: boolean, ... }
let visibilityPanelOpen = false;    // Panel visibility state
const VISIBILITY_CONFIG_NODE_ID = '__CONNECT_VISIBILITY_SETTINGS__';
```

#### State Flow
```
Application Start
    ↓
loadVisibilitySettings() - Load from graph
    ↓
initializeVisibilityControls() - Setup handlers
    ↓
applyVisibilitySettings() - Apply to DOM
    ↓
User clicks toggle button
    ↓
openVisibilityPanel() - Show control panel
    ↓
User toggles switches + saves
    ↓
saveVisibilitySettings() - Send to graph
    ↓
Settings persisted
```

## Key Functions

### loadVisibilitySettings()
**Purpose**: Load visibility settings from the graph's settings node

**Process**:
1. Fetch the graph using GRAPH_ID
2. Find node with id = `__CONNECT_VISIBILITY_SETTINGS__`
3. Extract JSON from node's info field
4. Populate `visibilitySettings` object
5. Apply settings to DOM

**Error Handling**: Silently continues if node doesn't exist (first-time setup)

### initializeVisibilityControls()
**Purpose**: Set up event handlers for Superadmins only

**What it does**:
1. Check if user is Superadmin (skip if not)
2. Find all `.controllable-element` elements
3. Add click handlers to their `.visibility-toggle` buttons
4. Make toggle buttons visible (add `visible` class)
5. Wire up panel's Save and Close buttons

### openVisibilityPanel(focusElementId)
**Purpose**: Open and populate the visibility control panel

**Process**:
1. Set `visibilityPanelOpen = true`
2. Clear existing items from panel
3. Find all controllable elements
4. For each element:
   - Get its current visibility state
   - Generate HTML for toggle switch
   - Add to panel
5. Attach click handlers to switches
6. Add `active` class to panel (makes it visible)

**Panel Item HTML Structure**:
```html
<div class="visibility-item" data-element-id="elementId">
  <div class="visibility-item-label">Element Label</div>
  <div class="visibility-toggle-switch on" data-element-id="elementId"></div>
</div>
```

### closeVisibilityPanel()
**Purpose**: Hide the visibility control panel

**What it does**:
1. Set `visibilityPanelOpen = false`
2. Remove `active` class from panel
3. Panel fades out (CSS transition)

### applyVisibilitySettings()
**Purpose**: Apply visibility settings to actual DOM elements

**Process**:
1. Loop through all entries in `visibilitySettings`
2. Find the corresponding DOM element
3. If visible: remove `hidden-element` class, set display to ''
4. If hidden: add `hidden-element` class, set display to 'none'

**CSS Result**:
- Visible: normal display, opacity 1.0
- Hidden: opacity 0.5, pointer-events: none

### saveVisibilitySettings()
**Purpose**: Persist visibility settings to the knowledge graph

**Process**:
1. Verify Superadmin access
2. Fetch current graph data
3. Look for existing settings node
4. If exists: update its info field
5. If not: create new node
6. POST updated graph back to API

**Settings Object Structure**:
```javascript
{
  title: 'Visibility Settings',
  description: '...',
  visibility: visibilitySettings,
  updatedAt: ISO timestamp,
  updatedBy: current user email
}
```

**Error Handling**:
- Validates Superadmin role
- Shows "Saving..." feedback
- Shows "Saved!" or error message
- Auto-closes panel on success
- Allows retry on error

### getElementLabel(elementId)
**Purpose**: Map element IDs to human-readable labels

**Current Mappings**:
```javascript
{
  'header': 'Header with Image',
  'stats': 'Statistics Cards',
  'nodesList': 'Nodes Navigation',
  'mainContent': 'Main Node Content'
}
```

## Data Flow Diagrams

### Load Flow
```
Page Load
    ↓
initWithMagicLink()
    ├─ await init()              // Load graph and nodes
    ├─ checkForMagicLinkToken()  // Check for auth
    ├─ updateLoginButton()       // Update UI
    ├─ await loadVisibilitySettings()  // Fetch from graph
    └─ initializeVisibilityControls()  // Setup handlers
    ↓
Settings loaded and applied to DOM
```

### Save Flow
```
User clicks "Save" button
    ↓
saveVisibilitySettings()
    ├─ Validate Superadmin role
    ├─ Fetch current graph
    ├─ Find/create settings node
    ├─ Update node.info with new settings
    ├─ POST graph back to API
    └─ Show success message
    ↓
Settings persisted
```

## API Endpoints Used

### Loading Graph
```
GET https://knowledge.vegvisr.org/getknowgraph?id={GRAPH_ID}
Response: { nodes: [], edges: [] }
```

### Saving Graph
```
POST https://knowledge.vegvisr.org/updateknowgraph
Body: {
  id: GRAPH_ID,
  graphData: { nodes: [], edges: [] }
}
```

## Element ID Patterns

### Reserved Element IDs
- `__CONNECT_VISIBILITY_SETTINGS__` - Reserved for settings storage

### Current Element IDs
- `header` - Page header element
- `stats` - Statistics cards row
- `nodesList` - Node navigation pills
- `mainContent` - Main content area

### Naming Convention
Use lowercase with hyphens: `my-element`, `user-controls`, etc.

## Visibility State Examples

### All Visible (Default)
```javascript
{
  'header': true,
  'stats': true,
  'nodesList': true,
  'mainContent': true
}
```

### Hide Navigation
```javascript
{
  'header': true,
  'stats': true,
  'nodesList': false,     // Hidden
  'mainContent': true
}
```

### Hide Stats and Navigation
```javascript
{
  'header': true,
  'stats': false,         // Hidden
  'nodesList': false,     // Hidden
  'mainContent': true
}
```

## Security Considerations

### Access Control
- Visibility controls only visible to Superadmins
- Save operation validates Superadmin role
- Regular users see applied settings but can't change them

### Data Isolation
- Settings stored in current graph only
- Different graphs can have different settings
- Settings node hidden from normal node filtering

### Audit Trail
- Each save includes `updatedBy` (user email)
- Each save includes `updatedAt` (timestamp)
- Full settings history viewable in settings node

## Performance Characteristics

### Load Time Impact
- One additional API call to load settings (if settings exist)
- Negligible (< 100ms typically)

### DOM Impact
- Adds CSS classes and attributes (minimal)
- Hides elements via CSS (no DOM removal)
- Hover effects use CSS transitions (GPU accelerated)

### Memory Impact
- Small object tracking visibility state (< 1KB)
- Minimal additional DOM overhead

## Browser Compatibility

- **Modern browsers**: Full support
- **CSS features used**: Flexbox, CSS transitions, custom properties
- **JavaScript features used**: Async/await, ES6 classes, fetch API
- **Minimum target**: ES6+ (IE11 not supported)

## Testing Checklist

- [ ] Visibility toggles visible to Superadmins only
- [ ] Panel opens/closes correctly
- [ ] Toggles save to correct element IDs
- [ ] Settings persist after page reload
- [ ] New settings node created if missing
- [ ] Existing settings node updated correctly
- [ ] Regular users can't see toggle buttons
- [ ] Hidden elements remain hidden with proper styling
- [ ] Error messages display on save failure
- [ ] Audit trail populated (updatedBy, updatedAt)

## Debugging Tips

### Console Logging
- Check browser console for visibility load messages
- Look for "Loaded visibility settings from graph"
- Check for any fetch errors

### Checking Settings
- Open DevTools (F12)
- In console: `console.log(visibilitySettings)`
- View current state

### Checking Settings Node
- Use "Show JSON" button to view all nodes
- Search for `__CONNECT_VISIBILITY_SETTINGS__` node ID
- View the settings JSON in the node's info field

### Common Issues

| Issue | Solution |
|-------|----------|
| Settings don't save | Check Superadmin role in console |
| Toggles invisible | Reload page, check authentication |
| Elements don't hide | Check element IDs match data-element-id |
| Settings disappear | Check graph is still accessible |
| Performance issues | Check browser console for errors |
