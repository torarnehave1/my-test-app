# Implicit Node Patching - Quick Start Guide

## TL;DR: How to Use Right Now

### 1️⃣ Open Graph + Enable Raw JSON Mode
```
GNewViewer (with a knowledge graph open)
    ↓
GrokChatPanel settings:
    ✅ "Use Graph Context"
    ✅ "Raw JSON Mode"
```

### 2️⃣ Highlight Text You Want to Change
```
In GNewViewer, select/highlight the specific text
Example: <meta property="og:site_name" content="Norse Gong ™" />
```

### 3️⃣ Ask AI to Change It
```
In GrokChatPanel chat, type:
"Change the og:site_name to 'Connect Norse Gong ™'"
```

### 4️⃣ AI Does the Surgery
```
AI automatically:
✅ Understands you want to patch just that field
✅ Sends minimal update: {"id": "node-xxx", "info": "new content"}
✅ Backend merges with existing node
✅ Only that field changed (everything else preserved)
✅ Saves to graph
```

---

## What Changed Under the Hood

| What | Before | After |
|------|--------|-------|
| **Entire node sent** | Always | Only when needed |
| **Small edits** | Risky, slow | Safe, fast |
| **AI understanding** | Generic | Context-aware |
| **Auto-merge** | ❌ No | ✅ Yes |
| **Backward compat** | — | ✅ 100% |

---

## Three Usage Scenarios

### Scenario A: Update HTML Meta Tags
**What you do:**
1. Highlight: `<meta property="og:title" content="Old Title" />`
2. Ask: "Change title to 'New Title'"

**What happens:**
```javascript
// AI sends
{"id": "node-abc", "info": "<meta... content=\"New Title\" ... />"}

// Frontend receives, detects partial update
// Merges with existing node
// Only 'info' field changed ✅
```

---

### Scenario B: Fix JSON Field
**What you do:**
1. Highlight: `"status": "draft"`
2. Ask: "Change to 'published'"

**What happens:**
```javascript
// Original node info (JSON):
{
  "title": "Article",
  "status": "draft",
  "tags": ["tech"]
}

// AI sends
{"id": "node-def", "info": {"title": "Article", "status": "published", "tags": ["tech"]}}

// Result: Only 'status' changed ✅
```

---

### Scenario C: Update Label
**What you do:**
1. Highlight: `The Old Title`
2. Ask: "Make it 'The New Title'"

**What happens:**
```javascript
// AI sends
{"id": "node-ghi", "label": "The New Title"}

// Frontend merges
// Only 'label' changed, 'info' untouched ✅
```

---

## Files to Know

| File | Purpose |
|------|---------|
| **GrokChatPanel.vue** | Frontend implementation ✅ Complete |
| **BACKEND_PATCH_ENDPOINT.md** | Backend spec (optional optimization) |
| **IMPLICIT_PATCHING_EXAMPLE.md** | Detailed examples & workflow |
| **IMPLEMENTATION_SUMMARY.md** | Technical deep dive |

---

## System Detection Logic

```
If (Raw JSON Mode ON && Text Highlighted) {
  → AI gets "Implicit Patching Context"

  If (Update has only id + 1-2 fields) {
    → Frontend treats as PARTIAL update
    → Merges with existing node
    → Preserves all other fields ✅
  } Else {
    → Frontend treats as FULL update
    → Replaces entire node
  }
}
```

---

## Common Questions

### Q: Do I need to enable any special mode?
**A:** No! Just enable "Raw JSON Mode" and highlight text. The system detects automatically.

### Q: Will my entire node be replaced?
**A:** No. System detects partial updates and only changes what you specified.

### Q: Is this slower?
**A:** Actually faster! Smaller payloads = quicker responses.

### Q: What if I want to replace the whole node?
**A:** Send full node definition with all fields. System auto-detects and uses full-update mode.

### Q: Is this production-ready?
**A:** Yes! ✅ Working right now. Fully backward compatible.

---

## Pro Tips

💡 **Tip 1:** Highlight exactly what you want to change
```
Bad:  "update this content"
Good: Select the exact text/field
```

💡 **Tip 2:** Use Raw JSON to see node structure
```
Check what fields exist before asking AI to change them
```

💡 **Tip 3:** Small, focused changes work best
```
Change one field at a time for clarity
```

💡 **Tip 4:** Check the console
```
Browser console shows: "✂️ Implicit node patch detected"
when patching mode activates
```

---

## Troubleshooting

### "Entire node was replaced instead of patched"
→ You sent full node definition. To trigger patching, send only `id` + changed fields.

### "Patching seems slow"
→ Still uses POST endpoint. Backend PATCH optimization is optional future work.

### "Highlighted context not showing"
→ Make sure Raw JSON Mode is enabled in GrokChatPanel settings.

### "AI isn't making the change"
→ Try being more specific. Highlight exact text and be clear about the change.

---

## One-Minute Setup

```bash
1. Open /gnew-viewer?graphId=graph_1769887409014
2. Open GrokChatPanel (right sidebar)
3. Enable: ✅ Use Graph Context, ✅ Raw JSON Mode
4. Highlight a piece of text in the graph view
5. Type in chat: "Change this to X"
6. Watch it work ✨
```

---

## That's It! 🎉

You now have intelligent, surgical node editing powered by AI.

- ✅ No manual PATCH calls needed
- ✅ No special syntax required
- ✅ No breaking changes
- ✅ Auto-detects patch vs full updates

**Just highlight, ask, and AI handles the rest.**

---

For detailed examples, see: `IMPLICIT_PATCHING_EXAMPLE.md`
For technical details, see: `IMPLEMENTATION_SUMMARY.md`
For backend specs, see: `BACKEND_PATCH_ENDPOINT.md`

