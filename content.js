chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'executeAction') {
    executeAction(message.toolCall)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function executeAction(toolCall) {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);
  console.log('[Content] Executing action:', name, args);
  if (args.coordinates) showClickDot(args.coordinates);

  switch (name) {
    case 'left_click':
    case 'double_click':
    case 'right_click': {
      if (!args.coordinates) break;
      const [relX, relY] = args.coordinates;
      const x = (relX / 1000) * window.innerWidth;
      const y = (relY / 1000) * window.innerHeight;
      console.log(`[Content] viewport=${window.innerWidth}x${window.innerHeight} relCoord=[${relX},${relY}] absCoord=[${Math.round(x)},${Math.round(y)}]`);
      const el = document.elementFromPoint(x, y);
      if (!el) break;
      el.focus();
      const clickCount = name === 'double_click' ? 2 : 1;
      const button = name === 'right_click' ? 2 : 0;
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button, clientX: x, clientY: y }));
      el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, button, clientX: x, clientY: y }));
      el.dispatchEvent(new MouseEvent('click',     { bubbles: true, button, clientX: x, clientY: y, detail: clickCount }));
      if (name === 'double_click') {
        el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: x, clientY: y }));
      }
      break;
    }
    case 'triple_click': {
      if (!args.coordinates) break;
      const [relX, relY] = args.coordinates;
      const x = (relX / 1000) * window.innerWidth;
      const y = (relY / 1000) * window.innerHeight;
      const el = document.elementFromPoint(x, y);
      if (!el) break;
      el.focus();
      // Select all existing content then replace
      if (el.select) el.select();
      break;
    }
    case 'type': {
      const el = document.activeElement;
      if (!el) break;
      const text = args.text;
      // Set value for input/textarea
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.isContentEditable) {
        el.textContent = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      break;
    }
    case 'key_press': {
      const el = document.activeElement || document.body;
      const key = args.key;
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup',   { key, bubbles: true }));
      break;
    }
    case 'scroll': {
      if (!args.coordinates) break;
      const [relX, relY] = args.coordinates;
      const x = (relX / 1000) * window.innerWidth;
      const y = (relY / 1000) * window.innerHeight;
      const el = document.elementFromPoint(x, y) || window;
      el.scrollBy({ top: args.direction === 'down' ? 200 : -200, behavior: 'smooth' });
      break;
    }
    case 'goto_url': {
      window.location.href = args.url;
      break;
    }
    case 'wait': {
      await new Promise(r => setTimeout(r, (args.ms ?? 500)));
      break;
    }
  }

  // Small delay after each action to let the page react
  await new Promise(r => setTimeout(r, 300));
}

function showClickDot(coordinates) {
  const [relX, relY] = coordinates;
  const x = (relX / 1000) * window.innerWidth;
  const y = (relY / 1000) * window.innerHeight;
  console.log(`[Content] Dot at viewport=[${window.innerWidth}x${window.innerHeight}] rel=[${relX},${relY}] abs=[${Math.round(x)},${Math.round(y)}]`);

  const dot = document.createElement('div');
  dot.style.cssText = `
    position: fixed;
    left: ${x - 12}px;
    top: ${y - 12}px;
    width: 24px;
    height: 24px;
    background: red;
    border: 3px solid white;
    border-radius: 50%;
    z-index: 2147483647;
    pointer-events: none;
    box-shadow: 0 0 8px rgba(255,0,0,0.8);
  `;

  const label = document.createElement('div');
  label.style.cssText = `
    position: fixed;
    left: ${x + 16}px;
    top: ${y - 8}px;
    background: red;
    color: white;
    font-size: 11px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 4px;
    z-index: 2147483647;
    pointer-events: none;
    white-space: nowrap;
    font-family: monospace;
  `;
  label.textContent = `[${relX}, ${relY}]`;

  document.body.appendChild(dot);
  document.body.appendChild(label);
  setTimeout(() => { dot.remove(); label.remove(); }, 5000);
}
