let recording = false;
let actions = [];
let inputBuffer = new Map();
let currentUrl = '';

// Initialize locating state from background
chrome.runtime.sendMessage({ command: 'getLocatingState' }, response => {
  if (response.isLocating) {
    startLocating();
  }
});

// Listen for URL changes
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (recording) {
      currentUrl = url;
      chrome.runtime.sendMessage({ 
        type: 'recordAction', 
        action: {
          type: 'navigation',
          url: lastUrl,
          timestamp: Date.now()
        }
      });
    }
  }
}).observe(document, {subtree: true, childList: true});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'startRecording') {
    recording = true;
    actions = [];
    currentUrl = window.location.href;
    attachListeners();
    sendResponse({ status: 'started', url: currentUrl });
  } else if (message.command === 'stopRecording') {
    recording = false;
    detachListeners();
    sendResponse({ status: 'stopped', actions: actions, url: currentUrl });
  } else if (message.command === 'startLocating') {
    startLocating();
    sendResponse({ status: 'started' });
  } else if (message.command === 'stopLocating') {
    stopLocating();
    sendResponse({ status: 'stopped' });
  }
  return true;
});

function attachListeners() {
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('keydown', handleKeydown, true);
}

function detachListeners() {
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('keydown', handleKeydown, true);
  
  // Flush any pending input actions
  inputBuffer.forEach(action => {
    actions = actions.filter(a => a.selector !== action.selector || a.type !== 'input');
    actions.push(action);
    chrome.runtime.sendMessage({ 
      type: 'recordAction', 
      action,
      shouldReplace: true,
      selector: action.selector 
    });
  });
  inputBuffer.clear();
}

function handleClick(e) {
  if (!recording) return;
  const selector = generateSelector(e.target);
  console.log('Click recorded:', selector);
  
  // Flush any pending input actions
  inputBuffer.forEach(action => {
    actions = actions.filter(a => a.selector !== action.selector || a.type !== 'input');
    actions.push(action);
    chrome.runtime.sendMessage({ 
      type: 'recordAction', 
      action,
      shouldReplace: true,
      selector: action.selector 
    });
  });
  inputBuffer.clear();
  
  // Record the click
  const action = {
    type: 'click',
    selector,
    elementHTML: e.target.outerHTML,
    elementText: e.target.textContent.trim(),
    timestamp: Date.now()
  };
  actions.push(action);
  chrome.runtime.sendMessage({ type: 'recordAction', action });
}

function handleInput(e) {
  if (!recording) return;
  const selector = generateSelector(e.target);
  console.log('Input recorded:', selector, e.target.value);
  
  // Special handling for URL bar input
  if (e.target.tagName === 'INPUT' && e.target.type === 'url') {
    chrome.runtime.sendMessage({ 
      type: 'recordAction', 
      action: {
        type: 'navigation',
        url: e.target.value,
        timestamp: Date.now()
      }
    });
    return;
  }
  
  // Regular input handling
  inputBuffer.set(selector, {
    type: 'input',
    selector,
    value: e.target.value,
    elementHTML: e.target.outerHTML,
    timestamp: Date.now()
  });
}

function generateSelector(element) {
  // Check if the element itself has text content
  if ((element.tagName.toLowerCase() === 'a' || element.tagName.toLowerCase() === 'button') 
      && element.textContent) {
    const text = element.textContent.trim();
    if (text.length > 0 && text.length < 50 && !/^\d+$/.test(text)) {
      return text; // Return just the text content
    }
  }

  // Dig deeper into the element's children to find text content
  const childText = findChildText(element);
  if (childText) {
    return childText;
  }

  // First try to find the closest element with a stable attribute
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const stableAttributes = [
      'data-testid',     
      'aria-label',      
      'name',            
      'placeholder',     
      'title',          
      'href',           
      'type',           
      'role'            
    ];

    for (const attr of stableAttributes) {
      const value = current.getAttribute(attr);
      if (value && !isLikelyDynamic(value)) {
        if (attr === 'role') {
          const genericRoles = ['button', 'textbox', 'link', 'checkbox', 'radio'];
          if (!genericRoles.includes(value)) {
            return `[${attr}="${value}"]`;
          }
          continue;
        }
        if (attr === 'href') {
          if (!/^(https?:|javascript:|#)/.test(value)) {
            return `a[href="${value}"]`;
          }
          continue;
        }
        return `[${attr}="${value}"]`;
      }
    }
    
    current = current.parentNode;
  }

  // Last resort: use tag name with type if available
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type');
  if (type) {
    return `${tagName}[type="${type}"]`;
  }

  return tagName;
}

function findChildText(element) {
  // Recursively search for text content in child nodes
  for (let child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent.trim();
      if (text.length > 0 && text.length < 50 && !/^\d+$/.test(text)) {
        return text;
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const text = findChildText(child);
      if (text) {
        return text;
      }
    }
  }
  return null;
}

function isLikelyDynamic(str) {
  return /^[a-z0-9]{8,}$/i.test(str) ||           // Random-looking strings
         /^[a-f0-9]{6,}$/i.test(str) ||           // Hex-like strings
         /^__.+__$/.test(str) ||                  // Framework-specific patterns
         /^[a-z][A-Z]/.test(str) ||               // React-style camelCase class names
         /^[0-9a-f]{4,}-[0-9a-f-]{4,}/.test(str) || // UUID-like strings
         /^[a-z]{1,3}[0-9]{3,}/.test(str) ||      // Short prefix followed by numbers
         /^js/.test(str) ||                       // JavaScript-related attributes
         /^data-v-/.test(str) ||                  // Vue.js generated attributes
         /^ember/.test(str) ||                    // Ember.js attributes
         /^ng-/.test(str) ||                      // Angular attributes
         /^react/.test(str);                      // React-specific attributes
}

// Check if recording was already in progress (e.g., after page refresh)
chrome.runtime.sendMessage({ command: 'getRecordingState' }, response => {
  if (response.isRecording) {
    recording = true;
    attachListeners();
  }
});

function handleKeydown(e) {
  if (!recording) return;
  
  // Only record special keys like Enter, Tab, Escape, etc.
  const specialKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (specialKeys.includes(e.key)) {
    const selector = generateSelector(e.target);
    console.log('Keyboard recorded:', e.key, selector);
    
    // Flush input buffer first
    inputBuffer.forEach(action => {
      actions = actions.filter(a => a.selector !== action.selector || a.type !== 'input');
      actions.push(action);
      chrome.runtime.sendMessage({ 
        type: 'recordAction', 
        action,
        shouldReplace: true,
        selector: action.selector 
      });
    });
    inputBuffer.clear();
    
    // Record keyboard action
    const action = {
      type: 'keyboard',
      key: e.key,
      selector,
      timestamp: Date.now()
    };
    actions.push(action);
    chrome.runtime.sendMessage({ type: 'recordAction', action });
  }
}

// Add new functions for element locating
let isLocating = false;
let previewElement = null;

// Keep track of highlighted elements
let highlightedElements = new Set();

function startLocating() {
  isLocating = true;
  document.addEventListener('mouseover', handleHover, true);
  document.addEventListener('mouseout', handleMouseOut, true);
}

function stopLocating() {
  isLocating = false;
  document.removeEventListener('mouseover', handleHover, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  
  // Clean up any remaining outlines
  const allHighlighted = document.querySelectorAll('[style*="outline"]');
  allHighlighted.forEach(el => {
    el.style.outline = '';
  });
  
  if (previewElement) {
    previewElement.remove();
    previewElement = null;
  }
}

function handleHover(e) {
  if (!isLocating) return;
  e.stopPropagation();
  
  // Remove outline from all other elements first
  const allHighlighted = document.querySelectorAll('[style*="outline"]');
  allHighlighted.forEach(el => {
    if (el !== e.target) {
      el.style.outline = '';
    }
  });
  
  // Add outline to current element
  const element = e.target;
  element.style.outline = '2px solid #ff0000';
  
  // Add click handler for copying HTML
  element.addEventListener('click', async (clickEvent) => {
    if (!isLocating) return;
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    
    const rawHTML = element.outerHTML;
    
    try {
      await navigator.clipboard.writeText(rawHTML);
      showNotification('✓ HTML Copied to Clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy HTML:', err);
      showNotification('❌ Failed to copy HTML', 'error');
    }
  }, { once: true });

  // Update preview
  if (!previewElement) {
    previewElement = document.createElement('div');
    previewElement.className = 'element-preview';
    document.body.appendChild(previewElement);
  }

  const sourceCode = generateSourceCode(element);
  previewElement.innerHTML = `<pre style="margin: 0">${sourceCode}\n\nClick to copy raw HTML</pre>`;
  
  // Position the preview
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  let top = rect.bottom + window.scrollY + 10;
  let left = rect.left + window.scrollX;
  
  if (top + previewElement.offsetHeight > viewportHeight + window.scrollY) {
    top = rect.top + window.scrollY - previewElement.offsetHeight - 10;
  }
  
  if (left + previewElement.offsetWidth > viewportWidth) {
    left = viewportWidth - previewElement.offsetWidth - 10;
  }
  
  previewElement.style.top = `${top}px`;
  previewElement.style.left = `${left}px`;
}

function handleMouseOut(e) {
  if (!isLocating) return;
  e.stopPropagation();
  
  // Remove outline from the element being left
  e.target.style.outline = '';
  
  if (previewElement) {
    previewElement.remove();
    previewElement = null;
  }
}

function clearAllHighlights() {
  highlightedElements.forEach(element => {
    if (element && element.style) {
      element.style.outline = element.dataset.originalOutline || '';
      delete element.dataset.originalOutline;
    }
  });
  highlightedElements.clear();
}

// Add notification function
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#4CAF50' : '#f44336'};
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(notification);
  
  requestAnimationFrame(() => {
    notification.style.opacity = '1';
  });
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Add this new function to generate source code representation
function generateSourceCode(element) {
  // Get the selector that would be used
  const selector = generateSelector(element);
  
  // Get element attributes
  const attributes = Array.from(element.attributes)
    .map(attr => `${attr.name}="${attr.value}"`)
    .join(' ');
  
  // Get element tag
  const tag = element.tagName.toLowerCase();
  
  // Build source code representation
  let code = '';
  code += `Element: <${tag}${attributes ? ' ' + attributes : ''}>\n\n`;
  code += `Selector: ${selector}\n\n`;
  
  // Add DrissionPage code example
  code += 'DrissionPage code:\n';
  code += `page.ele('${selector}')`;
  
  // Add common operations
  code += '\n\nCommon operations:\n';
  code += `page.ele('${selector}').click()  # Click\n`;
  code += `page.ele('${selector}').input('text')  # Input text\n`;
  code += `page.ele('${selector}').text  # Get text\n`;
  code += `page.ele('${selector}').attr('attribute')  # Get attribute`;
  
  return code;
}

// Update the style for the preview
const style = document.createElement('style');
style.textContent = `
  .element-preview {
    position: fixed;
    background: rgba(0, 0, 0, 0.95);
    color: #fff;
    padding: 12px;
    border-radius: 6px;
    max-width: 600px;
    max-height: 400px;
    overflow: auto;
    z-index: 2147483647;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  .element-preview pre {
    margin: 0;
    padding: 0;
  }
`;
document.head.appendChild(style); 