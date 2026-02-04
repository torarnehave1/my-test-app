# Graph Update Approval Workflow - Complete Guide

## Overview

**NEW FEATURE:** All graph updates made by the AI through GrokChatPanel now require user approval before saving.

When the AI wants to modify your knowledge graph, it will show you exactly what it wants to change, and you must explicitly approve the change before it's saved.

## ✨ How It Works

### The Workflow

```
1. User asks AI to make a change
         ↓
2. AI preposes an update
         ↓
3. Approval Modal Opens
   Shows:
   - Which node is being changed
   - What fields are changing
   - Old vs new values
   - AI's explanation
         ↓
4. User Reviews Changes
   ✅ Approve & Save
   or
   ❌ Don't Save (cancel)
         ↓
5. If Approved:
   Changes saved to graph
   Success confirmation shown
         ↓
6. If Cancelled:
   No changes saved
   Chat continues normally
```

---

## 🎯 Features

### 1. Clear Preview Modal
Shows:
- **Node being changed** - Which node is being modified
- **Changes list** - Exactly what fields are being changed
- **Before/After comparison** - Old values vs new values
- **AI explanation** - Why the AI thinks this change is needed

### 2. Visual Indicators
- ✅ **Green "Approve & Save"** button for accepting
- ❌ **Red "Don't Save"** button for rejecting
- Status messages showing success/errors

### 3. Field-by-Field Display
For long fields (like HTML or markdown):
- Truncated view of old and new content
- Color-coded: Red for old, Green for new
- Shows which field is being changed

### 4. Safety Features
- No automatic saving
- User must explicitly approve each change
- Can review change before committing
- Can reject changes without consequences

---

## 📋 Using the Approval Workflow

### Example 1: Simple Field Update

**Scenario:** AI wants to change a meta tag

```
Step 1: User asks AI
  "Change the og:site_name from 'Norse Gong' to 'Connect Norse Gong'"

Step 2: AI decides to update
  AI calls: graph_update_current({
    nodes: [{
      id: "node-123",
      info: "<meta property=\"og:site_name\" content=\"Connect Norse Gong\" />"
    }]
  })

Step 3: Approval Modal Opens
  ┌─────────────────────────────────────┐
  │ 🔍 Confirm Graph Update            │
  ├─────────────────────────────────────┤
  │                                     │
  │ The AI wants to make the following  │
  │ change to your graph:              │
  │                                     │
  │ Node Being Updated:                 │
  │ "Header Metadata" (ID: node-123)   │
  │                                     │
  │ Changes:                            │
  │ info:                               │
  │   Old: <meta ... "Norse Gong" ...> │
  │   New: <meta ... "Connect Norse..> │
  │                                     │
  │ AI's Explanation:                   │
  │ Updating 1 node(s). 1 field(s)     │
  │ being modified.                     │
  │                                     │
  │ [❌ Don't Save] [✅ Approve & Save]│
  └─────────────────────────────────────┘

Step 4: User Decides
  - Option A: Click "❌ Don't Save" → Change rejected
  - Option B: Click "✅ Approve & Save" → Change saved

Step 5: Confirmation
  If approved: "✅ Changes saved successfully!"
  If rejected: Modal closes, no changes made
```

### Example 2: Multiple Field Update

**Scenario:** AI wants to update both label and content

```
Approval Modal Shows:
  Node: "Article Content"

  Changes:
  1. label:
     Old: "The Old Title"
     New: "The New Title"

  2. info:
     Old: "Old paragraph text..."
     New: "New paragraph text..."

  AI's Explanation:
  Updating 1 node(s). 2 field(s) being modified.

User can:
  ✅ Accept both changes together
  ❌ Reject both changes together
```

### Example 3: Multiple Node Update

**Scenario:** AI wants to update multiple nodes

```
Approval Modal Shows:
  Node: "First Node Name" (showing first changed node)

  Changes:
  [Details of first node's changes]

  AI's Explanation:
  Updating 3 node(s). 2 field(s) being modified.

Important:
  - Shows preview of first changed node
  - States total number of nodes being updated
  - Approve/Reject applies to ALL nodes at once
```

---

## 🎨 Modal Components

### Header
```
🔍 Confirm Graph Update        [X]
```
- Title clearly indicates this is an approval step
- Close button (X) to cancel

### Content Area
```
The AI wants to make the following change to your graph:

Node Being Updated:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Node name/label]
(ID: node-id-here)

Changes:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Field name]:
  Old: [Previous value, truncated if long]
  New: [New value, truncated if long]

AI's Explanation:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[AI's reasoning for the change]
```

### Footer
```
[❌ Don't Save]        [✅ Approve & Save]
```
- Two clear action buttons
- Status message below (loading/success/error)

---

## 🔍 What Gets Shown

### Always Shown
- ✅ Node ID being changed
- ✅ Node label/name
- ✅ List of fields being changed
- ✅ Number of nodes being updated

### Shown for Field Changes
- ✅ Field name (e.g., "label", "info", "type")
- ✅ Old value (truncated if > 100 chars)
- ✅ New value (truncated if > 100 chars)
- ✅ Color coding (red=old, green=new)

### Shown in Explanation
- ✅ Total nodes being modified
- ✅ Total fields being changed
- ✅ AI's context and reasoning

---

## ⚙️ Status Messages

### During Processing
```
🔄 Saving approved changes...
```

### Success
```
✅ Changes saved successfully!
```
- Modal closes after 1.5 seconds
- Graph updates with new data

### Error
```
❌ Error: Failed to update graph: 500
```
- Shows specific error message
- User can try again or cancel

### Cancelled
```
(No message, modal just closes)
```
- No changes saved
- User can continue chatting

---

## 🛡️ Safety Features

### No Automatic Saving
- Changes only save after explicit approval
- No "auto-save" functionality
- User is always in control

### Clear Change Display
- Shows exactly what's changing
- Side-by-side before/after comparison
- Color-coded for clarity

### Easy Rejection
- Single click to reject any changes
- No consequences for rejection
- Chat continues normally

### Status Feedback
- Clear loading indicator while saving
- Success confirmation when done
- Error messages if something fails

---

## 💡 Tips & Best Practices

### Tip 1: Review Changes Carefully
Always read what's being changed before approving. The modal is designed to make this easy.

### Tip 2: Understand Field Names
Common field names:
- **label** - The node's display name
- **info** - The node's content/body text
- **type** - The node's data type
- **position** - The node's visual location

### Tip 3: Use Don't Save If Unsure
If you're not sure about a change, click "❌ Don't Save" and ask the AI to explain more.

### Tip 4: Check Before/After Values
The modal shows truncated values for long content. Look for the key differences.

### Tip 5: Consider the Context
The AI's explanation helps you understand why it wants to make the change.

---

## 🎯 Workflow Scenarios

### Scenario A: Approving a Simple Fix
```
AI: "I noticed the typo in the title. Let me fix it."
You: See the modal, review the change
You: Click ✅ Approve & Save
Result: Typo fixed, graph updated
```

### Scenario B: Rejecting an Unexpected Change
```
AI: Proposes a change you don't agree with
You: Review the modal and decide it's not right
You: Click ❌ Don't Save
Result: No changes made, you can ask AI to do something else
```

### Scenario C: Multi-Node Update
```
AI: Wants to update 3 nodes based on your input
You: See modal showing first node's changes
You: Click ✅ Approve & Save
Result: All 3 nodes updated, graph reflects all changes
```

---

## ❓ FAQ

### Q: What if I accidentally click "Don't Save"?
**A:** No problem! Just ask the AI to make the same change again. You'll get another approval request.

### Q: Can I edit the values in the modal?
**A:** No, the modal is for reviewing only. To make different changes, reject the proposal and ask the AI to modify.

### Q: What if the modal doesn't appear?
**A:** This might happen if:
1. Your browser blocked modals (check browser settings)
2. JavaScript is disabled
3. There's a technical issue - try refreshing the page

### Q: How long does the modal stay open?
**A:** Until you click a button or close it. After you approve, it closes after showing success (1.5 seconds).

### Q: Can multiple changes happen at once?
**A:** Yes! If you approve, all changes in that approval request are saved together.

### Q: What if a change fails?
**A:** An error message will appear in the modal. You can try again by clicking "Approve & Save" again, or cancel and ask the AI something else.

### Q: Is there an audit trail?
**A:** Yes! The graph metadata tracks `updatedAt` and `updatedBy` for each update, so you can see when changes were made and who made them.

---

## 📊 Status Flow

```
Idle
  ↓
User asks AI for change
  ↓
AI prepares update
  ↓
Modal Opens (showApprovalModal = true)
  ↓
  ├─→ User clicks ✅ Approve → Saving State → Success → Closes
  │
  └─→ User clicks ❌ Cancel → Closes (no save)
```

---

## 🔧 Technical Details

### Reactive Variables
```javascript
showApprovalModal: ref(false)           // Modal visibility
pendingApproval: ref(null)              // Update data waiting for approval
approvalStatus: ref(null)               // Current status (loading/success/error)
pendingApprovalResolve: null            // Promise resolver for async flow
```

### Data Structure
```javascript
pendingApproval = {
  nodeId: "node-123",                   // Which node is changing
  nodeLabel: "Node Display Name",       // User-friendly name
  changes: {                             // Fields being changed
    info: "new content",
    label: "new label"
  },
  oldValues: {                          // Previous values for comparison
    info: "old content",
    label: "old label"
  },
  explanation: "Human-readable...",     // Why the change is happening
  graphData: {...},                     // Full updated graph data
  graphStore,                           // Store reference for updates
  userId                                // Who made the update
}
```

---

## 🚀 Implementation Status

✅ **Implemented:**
- Approval modal UI with beautiful styling
- Change preview and display logic
- Approve and Cancel functions
- Status feedback (loading, success, error)
- Promise-based async handling
- Integration with graph_update_current

✅ **Tested:**
- Modal appearance and styling
- Button functionality
- Data display accuracy
- Success/error handling
- User interaction flow

---

## 📝 Summary

The approval workflow ensures that:
1. ✅ Users always see what's being changed
2. ✅ Users must explicitly approve each change
3. ✅ Changes are clear and easy to understand
4. ✅ Users have full control
5. ✅ No changes happen without permission

**The AI respects your data and waits for your approval before saving changes.**

---

**Status:** ✅ Production Ready
**Version:** 1.0
**Date:** 2026-02-04
