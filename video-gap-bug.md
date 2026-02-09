# Video Gap Bug Explanation

## The Problem

The large gap between the video and the text is caused by a **double aspect-ratio wrapper**.

## Step by step

### 1. Input data already has an aspect-ratio wrapper

```html
<div style="position: relative; padding-top: 56.25%;">
  <iframe ...></iframe>
</div>
```

### 2. `wrapBareIframesAndVideos()` adds a second one

The function doesn't detect the existing wrapper and wraps the iframe again:

```html
<div style="position: relative; padding-top: 56.25%;">
  <div class="embed-wrap">   <!-- CSS adds another padding-top: 56.25% -->
    <iframe ...></iframe>
  </div>
</div>
```

Now there are **two stacked 56.25% padding-top containers**, doubling the vertical space.

### 3. `show()` extracts the inner wrapper but leaves the outer one behind

`tmp.querySelector('.embed-wrap')` grabs the inner `.embed-wrap` and uses it as the video. But the outer `<div style="padding-top: 56.25%;">` stays in `remainingHtml` — now **empty** — and gets rendered into the page.

That empty div still reserves ~56% of the container width as vertical height.

**That empty div is the gap.**

## Fix

Before extracting the media element in `show()`, normalize iframe wrappers in the DOM — convert any single-iframe wrapper div into `.embed-wrap` directly (and remove its inline style), so there is only ONE aspect-ratio container:

```javascript
tmp.querySelectorAll('iframe').forEach(iframe => {
    const parent = iframe.parentElement;
    if (parent && parent !== tmp
        && parent.tagName === 'DIV'
        && parent.children.length === 1
        && !parent.classList.contains('embed-wrap')) {
      parent.className = 'embed-wrap';
      parent.removeAttribute('style');
    }
});
```

This reuses the existing wrapper instead of creating a second one, and eliminates the leftover empty div.
