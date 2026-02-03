# Visibility Control Examples & Scenarios

## Scenario 1: First-Time Setup

### What Happens
1. Superadmin logs in
2. Page loads with default visibility settings (all elements visible)
3. Settings node doesn't exist yet in the graph
4. User opens visibility panel and hides the "Nodes Navigation" element
5. User clicks "Save"

### Behind the Scenes
- New settings node created automatically
- Node ID: `__CONNECT_VISIBILITY_SETTINGS__`
- Node added to graph
- Graph updated in database
- Settings applied to page

### Resulting Graph Node
```json
{
  "id": "__CONNECT_VISIBILITY_SETTINGS__",
  "label": "Visibility Settings",
  "type": "visibility-settings",
  "info": "{\"title\":\"Visibility Settings\",\"description\":\"Auto-generated settings node...\",\"visibility\":{\"header\":true,\"stats\":true,\"nodesList\":false,\"mainContent\":true},\"updatedAt\":\"2025-02-02T10:30:45.000Z\",\"updatedBy\":\"admin@vegvisr.org\"}"
}
```

## Scenario 2: Returning User

### What Happens
1. User returns to page next day
2. Page loads
3. Settings are automatically loaded from the settings node
4. Elements are configured as user left them
5. "Nodes Navigation" element is hidden, others visible

### Timeline
```
Page Load
  ↓
loadVisibilitySettings() called
  ↓
Fetch graph from API
  ↓
Find __CONNECT_VISIBILITY_SETTINGS__ node
  ↓
Extract JSON from node.info
  ↓
Parse visibility object
  ↓
Apply to DOM: nodesList element hidden
  ↓
Page displays with saved settings
```

## Scenario 3: Multiple Superadmins

### What Happens
1. **Admin A** hides "Statistics Cards"
2. **Admin A** clicks "Save" (visibility.stats = false)
3. **Admin B** loads same page
4. Settings show cards are hidden (Admin A's preference)
5. **Admin B** wants to show cards
6. **Admin B** toggles and saves (visibility.stats = true)
7. **Admin A** reloads page
8. Cards now visible (Admin B's new preference)

### Audit Trail
```
updatedAt: 2025-02-02T10:30:00Z
updatedBy: admin-a@vegvisr.org
visibility.stats: false

↓ (Admin B updates)

updatedAt: 2025-02-02T11:45:30Z
updatedBy: admin-b@vegvisr.org
visibility.stats: true
```

**Note**: Only most recent change is stored (settings are replaced, not versioned)

## Scenario 4: Regular User Browsing

### What Happens
1. Regular user (not Superadmin) loads page
2. Settings are loaded from graph
3. Applied to page automatically
4. User browses normally
5. **No visibility toggle buttons appear** ← Key difference from Superadmin
6. User sees page as configured by Superadmins

### User Perspective
```
Regular User View:
┌──────────────────────────────┐
│    Header with Image         │
│   [NO TOGGLE BUTTON]         │
└──────────────────────────────┘
```

vs.

```
Superadmin View:
┌──────────────────────────────┐
│    Header with Image   [👁️] │
│   (Toggle button visible)    │
└──────────────────────────────┘
```

## Scenario 5: Hiding Most Elements

### Initial State
```
header:       TRUE ✓
stats:        TRUE ✓
nodesList:    TRUE ✓
mainContent:  TRUE ✓
```

### After Hiding Stats and Navigation
```
header:       TRUE  ✓
stats:        FALSE ✗ (hidden)
nodesList:    FALSE ✗ (hidden)
mainContent:  TRUE  ✓
```

### Visual Result
```
┌─────────────────────────────────┐
│  Header with Image              │ ← VISIBLE
├─────────────────────────────────┤
│ Statistics Cards [50% opacity]  │ ← HIDDEN (faded)
│ Nodes Navigation [50% opacity]  │ ← HIDDEN (faded)
├─────────────────────────────────┤
│  Main Node Content              │ ← VISIBLE
│  (Large preview area)           │
└─────────────────────────────────┘
```

## Scenario 6: Mobile User Optimization

### Use Case
Superadmin wants to hide "Statistics Cards" on mobile to focus on node content.

### Settings Configuration
```
Mobile View:
{
  "header": true,
  "stats": false,    // Hidden on mobile
  "nodesList": true,
  "mainContent": true
}
```

**Note**: Current implementation doesn't have viewport detection, but this is a future enhancement.

## Scenario 7: Error Handling - Network Failure

### What Happens
1. User clicks "Save"
2. Network error occurs during graph update
3. Save button shows "Error!"
4. Error message displayed: "Failed to update graph"
5. User can try again

### Error Message
```
┌──────────────────────────────────────┐
│  Element Visibility                  │
├──────────────────────────────────────┤
│  [Elements list...]                  │
├──────────────────────────────────────┤
│  [Error!] [Close]                    │
│  Error: Failed to update graph        │
└──────────────────────────────────────┘
```

## Scenario 8: Settings Node Corruption

### What Happens
1. Settings node exists but has invalid JSON
2. Page loads
3. `loadVisibilitySettings()` tries to parse JSON
4. Parsing fails silently
5. Defaults to all elements visible
6. User can reconfigure and save new settings

### Error Handling
```javascript
try {
  const jsonData = extractJsonFromInfo(info);
  // Parse succeeds
} catch (e) {
  // Silent fail - continue with defaults
  console.log('Could not parse visibility settings:', e);
}
```

## Scenario 9: Adding New Controllable Element

### Developer Task
Want to add a new "Debug Panel" element to visibility control.

### Steps

**Step 1**: Update HTML
```html
<section class="debug-section controllable-element"
         data-element-id="debugPanel">
  <!-- Debug content -->
  <button type="button" class="visibility-toggle"></button>
</section>
```

**Step 2**: Update getElementLabel()
```javascript
const labels = {
  'header': 'Header with Image',
  'stats': 'Statistics Cards',
  'nodesList': 'Nodes Navigation',
  'mainContent': 'Main Node Content',
  'debugPanel': 'Debug Information'  // NEW
};
```

**Step 3**: Done!
System automatically:
- Detects new element
- Adds to visibility panel
- Initializes as visible
- Allows toggling and saving

### Resulting Settings
```json
{
  "visibility": {
    "header": true,
    "stats": true,
    "nodesList": true,
    "mainContent": true,
    "debugPanel": true  // NEW
  }
}
```

## Scenario 10: Scheduled Maintenance

### Workflow
1. All elements normally visible
2. Superadmin prepares for maintenance
3. Hides "Main Node Content" to prevent edits
4. Keeps "Header" visible with notice
5. Saves settings
6. Users see limited interface during maintenance

### Settings
```json
{
  "header": true,
  "stats": true,
  "nodesList": true,
  "mainContent": false  // Maintenance mode
}
```

## Settings File Evolution

### Day 1 - Initial Setup
```json
{
  "title": "Visibility Settings",
  "visibility": {
    "header": true,
    "stats": true,
    "nodesList": true,
    "mainContent": true
  },
  "updatedAt": "2025-02-01T14:20:00Z",
  "updatedBy": "admin@vegvisr.org"
}
```

### Day 2 - After First Change
```json
{
  "title": "Visibility Settings",
  "visibility": {
    "header": true,
    "stats": false,      // CHANGED
    "nodesList": true,
    "mainContent": true
  },
  "updatedAt": "2025-02-02T09:15:30Z",
  "updatedBy": "admin@vegvisr.org"
}
```

### Day 3 - Different User
```json
{
  "title": "Visibility Settings",
  "visibility": {
    "header": true,
    "stats": true,       // CHANGED BACK
    "nodesList": false,  // NEW CHANGE
    "mainContent": true
  },
  "updatedAt": "2025-02-03T16:45:15Z",
  "updatedBy": "other-admin@vegvisr.org"
}
```

## Visibility States Matrix

### All Possible Combinations (4 elements = 16 states)

| # | header | stats | nodesList | mainContent | Use Case |
|---|--------|-------|-----------|-------------|----------|
| 1 | ✓ | ✓ | ✓ | ✓ | Default (everything visible) |
| 2 | ✗ | ✓ | ✓ | ✓ | Hide branded header |
| 3 | ✓ | ✗ | ✓ | ✓ | Hide graph info |
| 4 | ✓ | ✓ | ✗ | ✓ | Hide navigation pills |
| 5 | ✓ | ✓ | ✓ | ✗ | Hide content (maintenance) |
| 6 | ✗ | ✓ | ✓ | ✗ | Minimal view |
| 7 | ✓ | ✗ | ✗ | ✓ | Focus on content |
| 8 | ✗ | ✗ | ✗ | ✗ | Everything hidden (rare) |
| ... | ... | ... | ... | ... | ... |

The system supports all 16 combinations!

## Real-World Usage Example

### Company Internal Tool
**Goal**: Hide navigation and stats to focus on content analysis

**Setup**:
```
Superadmin hides:
- Stats Cards (company doesn't need to see graph info)
- Nodes Navigation (users should view one node at a time)

Keeps visible:
- Header (branding important)
- Main Content (core functionality)
```

**Result**: Users see clean, focused interface with just header and content

### Public Demonstration
**Goal**: Showcase specific data without overwhelming visitors

**Setup**:
```
Keeps visible:
- Header (for branding)
- Main Content (to show data)

Hides:
- Stats (technical details)
- Navigation (confusing for non-users)
```

**Result**: Clean, professional presentation focused on data visualization

---

These examples cover common scenarios and edge cases for the visibility control feature!
