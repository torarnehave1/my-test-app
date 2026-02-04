# Implicit Node Patching - Usage Examples

## Overview

With the enhancements to GrokChatPanel, you can now use **implicit node patching** to make surgical edits to specific parts of a node without rewriting the entire node.

## How It Works

### Step 1: Enable Raw JSON Mode
In GrokChatPanel, enable:
- ✅ **Use Graph Context** (to see the full graph)
- ✅ **Raw JSON Mode** (to see complete JSON structure)
- Optionally: Select any other tools you need

### Step 2: Highlight the Text You Want to Change
In the GNewViewer, select (highlight) the specific text you want to modify.

Example: You have a meta tag in a node and want to change it:
```html
<meta property="og:site_name" content="Norse Gong ™" />
```

Highlight the part you want to change and ask the AI:
```
Change "Norse Gong" to "Connect Norse Gong"
```

### Step 3: AI Detects the Context Automatically

The system now detects:
1. **Raw JSON Mode is enabled** ✅
2. **Text is highlighted** ✅
3. **You're in the Implicit Patching Mode** ✅

GrokChatPanel automatically provides context to the AI:
```
IMPLICIT NODE PATCHING MODE

You have detected that:
1. Raw JSON Mode is enabled - you can see the complete node data
2. A specific piece of text is highlighted in node: "96e477ae-e343-48f3-8142-5478b74ce342"

This means the user wants to modify just this highlighted portion. When they ask
you to "change this to X" or "update this", you should:
1. Understand the context: The highlighted text is from node ID "96e477ae-..."
2. Make the surgical change: Only modify what the user specified
3. Use graph_update_current to save: Call it with ONLY the modified node(s)
```

## Example Workflow

### Scenario: Update OG Meta Tags

**Initial Node Content:**
```html
<meta charset="UTF-8" />
<meta property="og:title" content="Norse Gong" />
<meta property="og:site_name" content="Norse Gong ™" />
<meta property="og:description" content="A mystical Norse instrument" />
```

**User Action:**
1. Highlights: `<meta property="og:site_name" content="Norse Gong ™" />`
2. Asks: "Change this to 'Connect Norse Gong ™'"

**AI Behavior:**
```
I notice you've highlighted a specific meta tag and want to update it.
Let me make that surgical change for you.

I'll replace:
  <meta property="og:site_name" content="Norse Gong ™" />
With:
  <meta property="og:site_name" content="Connect Norse Gong ™" />

Now saving this change...
```

**API Call Made:**
```javascript
graph_update_current({
  "nodes": [{
    "id": "96e477ae-e343-48f3-8142-5478b74ce342",
    "info": "<meta charset=\"UTF-8\" />\n<meta property=\"og:title\" content=\"Norse Gong\" />\n<meta property=\"og:site_name\" content=\"Connect Norse Gong ™\" />\n<meta property=\"og:description\" content=\"A mystical Norse instrument\" />"
  }]
})
```

**Frontend Processing:**
```javascript
// Frontend detects this is a partial update (only 'id' and 'info' provided)
// It automatically merges with existing node data:

const existing = {
  id: "96e477ae-...",
  label: "Header Metadata",
  type: "metadata",
  info: "...", // old content
  bibl: [],
  position: {x: 100, y: 200},
  visible: true,
  // ... other fields
}

const patch = {
  id: "96e477ae-...",
  info: "..." // new content
}

// Result: All fields preserved except 'info' which is updated
const merged = {
  ...existing,
  ...patch,
  updatedAt: "2026-02-04T10:30:00Z",
  updatedBy: "user@example.com"
}
```

**Result:** ✅ Only the meta tag is updated, everything else preserved

---

## More Examples

### Example 2: Update a Single Field in JSON

**Node Info (JSON):**
```json
{
  "title": "My Article",
  "author": "John Doe",
  "status": "draft"
}
```

**User Action:**
- Highlights: `"draft"`
- Asks: "Change status to 'published'"

**AI Makes Update:**
```javascript
graph_update_current({
  "nodes": [{
    "id": "node-123",
    "info": JSON.stringify({
      "title": "My Article",
      "author": "John Doe",
      "status": "published"
    })
  }]
})
```

Result: ✅ Only `status` field changed

---

### Example 3: Update Part of Markdown Content

**Node Label:**
```
## The Norse Cosmology
```

**User Action:**
- Highlights: `Norse Cosmology`
- Asks: "Change to 'Connected Norse Cosmology'"

**AI Makes Update:**
```javascript
graph_update_current({
  "nodes": [{
    "id": "node-456",
    "label": "The Connected Norse Cosmology"
  }]
})
```

Result: ✅ Only the label is updated (info field untouched)

---

## Implicit Patching Detection Logic

The system determines if you're doing a partial update by checking:

```javascript
const isPartialUpdate =
  args.nodes.some(n => {
    // Node has ID (mandatory)
    const hasId = n.id;

    // But only has 1-2 standard fields besides ID
    const fieldCount = ['label', 'info', 'type', 'position']
      .filter(f => f in n).length;

    // If a node has few fields, it's likely a patch
    return hasId && fieldCount < 3;
  });
```

**Partial Update Examples:**
```javascript
// ✅ Detected as partial - only 'info' changed
{"id": "node-1", "info": "new content"}

// ✅ Detected as partial - only 'label' changed
{"id": "node-1", "label": "new label"}

// ❌ NOT partial - full node definition
{
  "id": "node-1",
  "label": "...",
  "info": "...",
  "type": "...",
  "position": {...},
  "bibl": [...]
}
```

---

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Network Traffic** | Send entire graph (all nodes + edges) | Send only changed node |
| **Processing** | Full graph re-validation | Minimal merge operation |
| **User Experience** | Long delay for small edits | Instant response |
| **Precision** | Risky (entire node can break) | Safe (surgical edits only) |
| **API Efficiency** | Always full replace | Smart detection of patch vs replace |

---

## Current Implementation Status

✅ **Implemented in Frontend:**
- GrokChatPanel system prompt enhanced with patching instructions
- Implicit patching detection in `graph_update_current` tool
- Automatic node merging logic

⏳ **Pending Backend:**
- Create dedicated `PATCH /patchknowgraphnode` endpoint (optional optimization)
- Currently uses `POST /saveGraphWithHistory` with intelligent merging

---

## How to Use It Now

1. **Open a graph in GNewViewer**
2. **Enable Raw JSON Mode** in GrokChatPanel
3. **Highlight specific text** you want to change
4. **Ask the AI to modify it**: "Change this to X"
5. **Watch the AI make surgical edits** without rewriting the entire node

That's it! The system handles the rest automatically.

---

## Troubleshooting

### "My entire node was replaced instead of patched"
This happens when you provide a full node definition. To trigger patching:
- Only specify the `id` field + the field(s) being changed
- Example: `{"id": "node-1", "info": "new"}`  ✅
- Not: `{"id": "node-1", "label": "...", "info": "...", ...}` ❌

### "Patching seems slow"
Currently all updates still send to `saveGraphWithHistory` endpoint which processes the full graph. This is optimized when the dedicated PATCH endpoint is implemented on the backend.

### "I don't see the patchMode flag in the response"
Check browser console - the AI should mention "✂️ Implicit node patch detected" in the logs.

---

## Next Steps

1. **Backend Optimization:** Implement `/patchknowgraphnode` endpoint for true PATCH support
2. **AI Optimization:** Train models to prefer minimal node definitions for better patching
3. **UI Improvement:** Show visual indication when patching mode is active
4. **Audit Logging:** Track all patches for compliance/versioning

---

**Status:** Ready for use
**Date:** 2026-02-04
**Requires:** GrokChatPanel + GNewViewer + Graph Context
