# Backend PATCH Endpoint Implementation Guide

## Overview

This document describes how to add support for **partial node updates (PATCH)** to enable implicit node patching in GrokChatPanel.

## Current Architecture

- **Frontend:** Vegvisr-Frontend (Vue.js)
- **Current Endpoints:**
  - `POST https://knowledge.vegvisr.org/saveGraphWithHistory` - Full graph replace
  - `POST https://knowledge.vegvisr.org/updateknowgraph` - Full graph replace
- **Backend:** Knowledge graph worker at `knowledge.vegvisr.org` (external service)

## Problem

Currently, all graph updates require sending the **entire graph** (all nodes + edges), even for single-field changes. This is inefficient and doesn't support surgical edits.

## Solution: Add PATCH Endpoint

### Endpoint Specification

**Method:** `PATCH`
**URL:** `https://knowledge.vegvisr.org/patchknowgraphnode`

### Request Format

```json
{
  "graphId": "graph_1769887409014",
  "nodeId": "96e477ae-e343-48f3-8142-5478b74ce342",
  "updates": {
    "info": "<meta property=\"og:site_name\" content=\"Connect Norse Gong ™\" />",
    "label": "Updated Label"
  }
}
```

### Response Format

```json
{
  "success": true,
  "message": "Node patched successfully",
  "node": {
    "id": "96e477ae-e343-48f3-8142-5478b74ce342",
    "label": "Updated Label",
    "info": "<meta property=\"og:site_name\" content=\"Connect Norse Gong ™\" />",
    "updatedAt": "2026-02-04T10:30:00Z",
    "updatedBy": "user@example.com"
  }
}
```

### Error Cases

```json
{
  "success": false,
  "error": "Node not found",
  "nodeId": "96e477ae-e343-48f3-8142-5478b74ce342"
}
```

## Implementation Steps

### 1. Database Query (merge existing with updates)

```javascript
// Pseudocode
const existingNode = await db.query(
  'SELECT * FROM nodes WHERE graphId = ? AND id = ?',
  [graphId, nodeId]
);

const mergedNode = {
  ...existingNode,
  ...updates,
  updatedAt: new Date().toISOString(),
  updatedBy: req.user.email || req.headers['x-user-email']
};

await db.update('nodes', mergedNode);
```

### 2. Handle Special Fields

When patching, ensure:
- **Timestamps** are updated (`updatedAt`, `updatedBy`)
- **Node ID** cannot be changed (immutable)
- **Graph ID** cannot be changed (immutable)
- **Nested objects** (like `position`, `metadata`) are shallow-merged
- **Arrays** (like `bibl`, `tags`) are replaced completely (not merged)

### 3. Versioning

Decide on versioning strategy:
- **Option A:** Don't increment graph version for node patches (treats as "continuous edit")
- **Option B:** Increment minor version (v1.0.1) for patches
- **Option C:** Create history entry but keep same major version

**Recommendation:** Option A (no version increment) - patches are continuous edits, not major updates

### 4. Permissions

Check authorization:
- User must have edit permission for the graph
- Use `x-user-role` header to verify Superadmin or node owner

```javascript
const userRole = req.headers['x-user-role'];
if (userRole !== 'Superadmin' && nodeOwner !== currentUser) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

## Frontend Integration

The frontend **doesn't need changes** - it's already prepared to use this endpoint!

When `graph_update_current` is called with partial node data:

```javascript
// Frontend will call this automatically
graph_update_current({
  "nodes": [{
    "id": "96e477ae-e343-48f3-8142-5478b74ce342",
    "info": "<meta property=\"og:site_name\" content=\"Connect Norse Gong ™\" />"
  }]
})
```

The backend should recognize:
- Single node with only changed fields = use PATCH endpoint
- Multiple nodes or all fields = use full graph replace

## Implementation Priority

**Phase 1 (MVP):** Basic PATCH endpoint
- Single field updates
- Simple error handling

**Phase 2:** Advanced features
- Batch PATCH requests (multiple nodes)
- Conditional updates (with validators)
- Field-level versioning

## Testing

### Test Cases

1. **Single field update**
   ```bash
   PATCH /patchknowgraphnode
   {"graphId": "...", "nodeId": "...", "updates": {"info": "new content"}}
   ```

2. **Multiple fields**
   ```bash
   PATCH /patchknowgraphnode
   {"graphId": "...", "nodeId": "...", "updates": {"label": "new", "info": "content"}}
   ```

3. **Non-existent node**
   - Should return 404

4. **Unauthorized user**
   - Should return 403

5. **Malformed request**
   - Should return 400

## Backwards Compatibility

- Keep existing `POST saveGraphWithHistory` endpoint unchanged
- PATCH endpoint is additive - no breaking changes
- Frontend will use PATCH for partial updates, POST for full updates

## Next Steps

1. Add PATCH endpoint to knowledge graph worker
2. Update GrokChatPanel to detect when PATCH should be used vs POST
3. Add tests for partial updates
4. Deploy and monitor

---

**Status:** Ready for implementation
**Date:** 2026-02-04
**Backend:** knowledge.vegvisr.org
