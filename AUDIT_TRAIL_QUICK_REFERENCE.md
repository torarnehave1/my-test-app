# Audit Trail - Quick Reference Guide

## TL;DR: Where is the Audit Trail?

The audit trail is captured and stored in **three places**:

---

## 1️⃣ Node Level (Per Node Updated)

**Location:** `GrokChatPanel.vue` Lines 2036-2037

```javascript
// When a node is updated
return {
  ...existingNode,                              // Keep existing data
  ...partialUpdate,                             // Apply changes
  updatedAt: new Date().toISOString(),          // ← AUDIT TRAIL #1
  updatedBy: userId,                            // ← AUDIT TRAIL #2
};
```

**What's stored:**
- `updatedAt`: "2026-02-04T14:30:45.123Z" (ISO 8601 timestamp)
- `updatedBy`: "user@example.com" (who made the change)

**Example:**
```javascript
{
  id: "96e477ae-e343-48f3-8142-5478b74ce342",
  label: "Header Metadata",
  info: "<meta ... />",
  updatedAt: "2026-02-04T14:30:45.123Z",  // ← When changed
  updatedBy: "user@example.com"            // ← Who changed it
}
```

---

## 2️⃣ Graph Level (Overall Graph Updated)

**Location:** `GrokChatPanel.vue` Lines 2059-2060

```javascript
// Graph-level metadata
const updatedGraphData = {
  id: currentGraphId,
  nodes: updatedNodes,
  edges: updatedEdges,
  metadata: {
    ...updatedMetadata,
    updated: new Date().toISOString(),     // ← AUDIT TRAIL #3
    updatedBy: userId,                      // ← AUDIT TRAIL #4
  },
};
```

**What's stored:**
- `metadata.updated`: "2026-02-04T14:30:45.123Z" (when graph was last updated)
- `metadata.updatedBy`: "user@example.com" (who last updated the graph)

---

## 3️⃣ Backend Persistence (Version History)

**Location:** `GrokChatPanel.vue` Line 3064 + Backend Endpoint

```javascript
// Sent to backend
const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
  method: 'POST',
  body: JSON.stringify({
    id: currentGraphId,
    graphData: graphData,  // ← Contains updatedAt, updatedBy for all nodes
    override: true,
  }),
});
```

**What the endpoint does:**
- Stores complete graph with audit data
- Maintains version history (history table in backend)
- Each version includes: `updated`, `updatedBy`
- Preserves all previous versions

---

## Complete Audit Trail Data

When a user approves a change, here's what gets stored:

### ✅ Before Change
```javascript
updatedAt: "2026-01-30T09:15:22.456Z"
updatedBy: "admin@example.com"
info: "<meta ... \"Norse Gong\" />"
```

### ✅ User Makes Request
- User highlights text in GNewViewer
- Asks AI to change it
- Modal shows old vs new values

### ✅ User Approves
- Clicks "✅ Approve & Save"
- Frontend captures timestamp: `now()`
- Frontend captures user: `userId`

### ✅ After Change (What's Stored)
```javascript
updatedAt: "2026-02-04T14:30:45.123Z"  // NEW timestamp
updatedBy: "user@example.com"           // Who approved (user, not admin)
info: "<meta ... \"Connect Norse Gong\" />"

// Plus in history:
oldValue: "<meta ... \"Norse Gong\" />"
changeType: "implicit_patch"
approvalDate: "2026-02-04T14:30:45.123Z"
```

---

## How to Access the Audit Trail

### 📊 From Frontend (Current Session)
```javascript
// Get current graph
const graph = store.currentGraph;

// Access node audit data
graph.nodes.forEach(node => {
  console.log(`Node: ${node.label}`);
  console.log(`  Updated: ${node.updatedAt}`);
  console.log(`  By: ${node.updatedBy}`);
});

// Access graph-level audit data
console.log(`Graph updated: ${graph.metadata.updated}`);
console.log(`Graph updated by: ${graph.metadata.updatedBy}`);
```

### 🔍 From Backend API
```javascript
// Fetch a graph
const response = await fetch('https://knowledge.vegvisr.org/graph/graph_1769887409014');
const graph = await response.json();

// Audit data included in response
console.log(graph.metadata.updated);  // When was it last updated
console.log(graph.metadata.updatedBy);  // Who last updated it

// Each node has audit data
graph.nodes.forEach(node => {
  console.log(`${node.label}: updated ${node.updatedAt} by ${node.updatedBy}`);
});
```

### 📜 From History Endpoint
```javascript
// Get version history
const history = await fetch(
  'https://knowledge.vegvisr.org/graph/graph_1769887409014/history'
).then(r => r.json());

// List all versions
history.forEach((version, idx) => {
  console.log(`Version ${idx}:`);
  console.log(`  Date: ${version.updated}`);
  console.log(`  User: ${version.updatedBy}`);
  console.log(`  Nodes changed: ${version.changedNodes}`);
});
```

---

## Timeline: Audit Trail Creation

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: User makes request (e.g., 14:30:25)             │
│ "Change 'Norse Gong' to 'Connect Norse Gong'"           │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: AI proposes change (14:30:30)                   │
│ Calls graph_update_current with new value               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Approval modal shows (14:30:35)                 │
│ • Shows old value: "Norse Gong"                         │
│ • Shows new value: "Connect Norse Gong"                 │
│ • Waiting for user approval                             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: User approves (14:30:45)                        │
│ Clicks "✅ Approve & Save"                              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Step 5: Audit trail created (14:30:45.123Z)             │
│                                                          │
│ AUDIT DATA ADDED TO NODE:                               │
│ updatedAt: "2026-02-04T14:30:45.123Z"                  │
│ updatedBy: "user@example.com"                           │
│                                                          │
│ AUDIT DATA ADDED TO GRAPH:                              │
│ metadata.updated: "2026-02-04T14:30:45.123Z"           │
│ metadata.updatedBy: "user@example.com"                  │
│                                                          │
│ PREVIOUS VALUES PRESERVED:                              │
│ previousValue: "Norse Gong"                             │
│ changeType: "implicit_patch"                            │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Step 6: Backend stores with history (14:30:46)          │
│                                                          │
│ POST https://knowledge.vegvisr.org/saveGraphWithHistory  │
│                                                          │
│ Saves:                                                   │
│ • Current graph state (with audit data)                 │
│ • Previous version in history                           │
│ • All metadata preserved                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Step 7: Query audit trail                               │
│                                                          │
│ Who made the change?                                     │
│ → graph.metadata.updatedBy = "user@example.com"         │
│                                                          │
│ When was it changed?                                     │
│ → graph.metadata.updated = "2026-02-04T14:30:45.123Z"  │
│                                                          │
│ What was changed?                                        │
│ → nodeA.info changed from "Norse Gong" to "Connect..."  │
│                                                          │
│ Complete history?                                        │
│ → GET /graph/{id}/history → all versions                │
└─────────────────────────────────────────────────────────┘
```

---

## File References

| Document | Purpose |
|----------|---------|
| [AUDIT_TRAIL_DOCUMENTATION.md](AUDIT_TRAIL_DOCUMENTATION.md) | Complete detailed documentation |
| [GrokChatPanel.vue:2036-2037](../vegvisr-frontend/src/components/GrokChatPanel.vue#L2036) | Node-level audit capture |
| [GrokChatPanel.vue:2059-2060](../vegvisr-frontend/src/components/GrokChatPanel.vue#L2059) | Graph-level audit capture |
| [GrokChatPanel.vue:2072-2074](../vegvisr-frontend/src/components/GrokChatPanel.vue#L2072) | Change detection (old values) |
| [GrokChatPanel.vue:3064](../vegvisr-frontend/src/components/GrokChatPanel.vue#L3064) | Backend endpoint call |

---

## One-Line Summary

**Audit trail is automatically created when users approve changes, storing `updatedAt` (timestamp) and `updatedBy` (user) for each node and at graph level, persisted via the `saveGraphWithHistory` backend endpoint.**

---

## Verification Checklist

- ✅ Timestamp captured: `new Date().toISOString()` → "2026-02-04T14:30:45.123Z"
- ✅ User captured: `userId` from auth context → "user@example.com"
- ✅ Node-level: Each node gets `updatedAt`, `updatedBy`
- ✅ Graph-level: Graph metadata gets `updated`, `updatedBy`
- ✅ Old values: Captured before approval for change detection
- ✅ Backend: Sent via `saveGraphWithHistory` endpoint
- ✅ History: Backend maintains version history
- ✅ Query: Can retrieve audit data from frontend store or API

**Status: ✅ ACTIVE AND FUNCTIONAL**
