
"use strict";
const recordBtn = document.getElementById('record');
const stopBtn = document.getElementById('stop');
const output = document.getElementById('output');
const copyBtn = document.getElementById('copyBtn');
const locateBtn = document.getElementById('locate');
const tagsInput = document.getElementById('tagsInput');
const updateTagsBtn = document.getElementById('updateTags');
const resetTagsBtn = document.getElementById('resetTags');
let isLocating = false;
// Added data-reactid and data-reactroot for React-heavy sites
const DEFAULT_TAGS = 'data-testid, aria-label, name, placeholder, title, href, type, role, data-reactid, data-reactroot';

// Check initial recording state and restore previous code
chrome.runtime.sendMessage({ command: 'getRecordingState' }, response => {
  if (response.isRecording) {
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    output.textContent = 'Recording...';
  } else {
    // Restore previous code
    chrome.runtime.sendMessage({ command: 'getGeneratedCode' }, response => {
      output.textContent = response.code;
      copyBtn.disabled = response.code === 'Generated code will appear here...';
    });
  }
});

// Load saved tags
chrome.storage.local.get(['customTags'], result => {
  if (result.customTags) {
    tagsInput.value = result.customTags;
  }
});

// Add event listener for updating tags
updateTagsBtn.addEventListener('click', () => {
  const tags = tagsInput.value;
  chrome.storage.local.set({ customTags: tags }, () => {
    updateTagsBtn.textContent = '✓';
    setTimeout(() => {
      updateTagsBtn.textContent = 'Update';
    }, 2000);
  });
});

recordBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { command: 'startRecording' }, response => {
    // Use robust fallback if primary URL not obtained
    const recUrl = response?.url || tab.url || 'http://unknown-url.com';
    chrome.runtime.sendMessage({ 
      command: 'startRecording',
      url: recUrl
    });
  });
  recordBtn.disabled = true;
  stopBtn.disabled = false;
  output.textContent = 'Recording...';
  copyBtn.disabled = true;
});

stopBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { command: 'stopRecording' });
  
  chrome.runtime.sendMessage({ command: 'getActions' }, response => {
    if (response && response.actions && response.actions.length > 0) {
      const code = generateDrissionCode(response.actions);
      output.textContent = code;
      copyBtn.disabled = false;
      // Store generated code in background script
      chrome.runtime.sendMessage({ 
        command: 'setGeneratedCode', 
        code: code 
      });
    } else {
      const errorMsg = 'Error: No actions recorded';
      output.textContent = errorMsg;
      copyBtn.disabled = true;
      chrome.runtime.sendMessage({ 
        command: 'setGeneratedCode', 
        code: errorMsg 
      });
    }
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    chrome.runtime.sendMessage({ command: 'stopRecording' });
  });
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(output.textContent);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text:', err);
  }
});

// Update the locating state initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Sync locate button state
  chrome.runtime.sendMessage({ command: 'getLocatingState' }, response => {
    isLocating = response.isLocating;
    if (isLocating) {
      locateBtn.style.background = '#ff0000';
    }
  });
});

// Update the locate button click handler
locateBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!isLocating) {
    try {
      // Update background state first
      await chrome.runtime.sendMessage({ command: 'setLocatingState', state: true });
      isLocating = true;
      locateBtn.style.background = '#ff0000';
      
      // Enable locating on all tabs
      const tabs = await chrome.tabs.query({});
      for (const t of tabs) {
        try {
          await chrome.tabs.sendMessage(t.id, { command: 'startLocating' });
        } catch (err) {
          // Ignore errors for tabs that don't have content script
        }
      }
    } catch (err) {
      console.error('Failed to start locating:', err);
    }
  } else {
    try {
      // Update background state first
      await chrome.runtime.sendMessage({ command: 'setLocatingState', state: false });
      isLocating = false;
      locateBtn.style.background = '#2196F3';
      
      // Disable locating on all tabs
      const tabs = await chrome.tabs.query({});
      for (const t of tabs) {
        try {
          await chrome.tabs.sendMessage(t.id, { command: 'stopLocating' });
        } catch (err) {
          // Ignore errors for tabs that don't have content script
        }
      }
    } catch (err) {
      console.error('Failed to stop locating:', err);
    }
  }
});

// Remove or update window.onblur
window.onblur = null;

function generateDrissionCode(actions) {
    console.log('Generating code for actions:', actions);
    
    if (!actions || actions.length === 0) {
      return 'No actions recorded';
    }

    const lines = [
      'from DrissionPage import ChromiumPage',
      'from DrissionPage.common import Keys',
      '',
      'page = ChromiumPage()',
      `page.get("${actions[0]?.url || 'http://example.com'}")`,
      ''
    ];

    function convertSelector(selector) {
      // Handle robust conversion by focusing on stable attributes
      // Use a fallback approach if certain attributes fail
      // Special handling for text selectors
      if (selector.startsWith('"')) {
        return selector.slice(1);
      }

      if (selector.startsWith('a:contains("') && selector.endsWith('")')) {
        return selector.slice(11, -2);
      }

      // Convert attribute selectors to DrissionPage format
      return selector
        .replace(/\[([^\]]+)="([^"]+)"\]/g, (match, attr, value) => {
          if (attr === 'type') {
            return `[${attr}=${value}]`;
          }
          return `@${attr}=${value}`;
        })
        .replace(/(\w+)\[([^\]]+)="([^"]+)"\]/g, (match, tag, attr, value) => {
          if (attr === 'type') {
            return `${tag}[${attr}=${value}]`;
          }
          return `${tag}@${attr}=${value}`;
        })
        .replace(/:nth-of-type\((\d+)\)/g, '[$1]')
        .replace(/:contains\("([^"]+)"\)/g, '@text=$1');
    }

    actions.forEach(action => {
      if (action.type === 'navigation') {
        lines.push(`# Navigate to URL`);
        lines.push(`page.get("${action.url}")`);
        lines.push('');
        return;
      }

      const convertedSelector = convertSelector(action.selector);
      
      if (action.type === 'click') {
        lines.push(`# Click ${action.elementText || convertedSelector}`);
        if (action.elementHTML) {
          const htmlLines = action.elementHTML.split('\n');
          lines.push(`# Source: ${htmlLines[0]}`);
          for (let i = 1; i < htmlLines.length; i++) {
            lines.push(`#${htmlLines[i]}`);
          }
        }
        lines.push(`page('${convertedSelector}').click()`);
      } else if (action.type === 'input') {
        lines.push(`# Input text`);
        if (action.elementHTML) {
          const htmlLines = action.elementHTML.split('\n');
          lines.push(`# Source: ${htmlLines[0]}`);
          for (let i = 1; i < htmlLines.length; i++) {
            lines.push(`#${htmlLines[i]}`);
          }
        }
        lines.push(`page('${convertedSelector}').input('${action.value}')`);
      } else if (action.type === 'keyboard') {
        if (action.selector) {
          if (action.elementHTML) {
            const htmlLines = action.elementHTML.split('\n');
            lines.push(`# Source: ${htmlLines[0]}`);
            for (let i = 1; i < htmlLines.length; i++) {
              lines.push(`#${htmlLines[i]}`);
            }
          }
          switch(action.key) {
            case 'Enter':
              lines.push(`page('${convertedSelector}').input(Keys.ENTER)`);
              break;
            case 'Tab':
              lines.push(`page('${convertedSelector}').input(Keys.TAB)`);
              break;
            case 'Escape':
              lines.push(`page('${convertedSelector}').input(Keys.ESCAPE)`);
              break;
            case 'ArrowUp':
              lines.push(`page('${convertedSelector}').input(Keys.UP)`);
              break;
            case 'ArrowDown':
              lines.push(`page('${convertedSelector}').input(Keys.DOWN)`);
              break;
            case 'ArrowLeft':
              lines.push(`page('${convertedSelector}').input(Keys.LEFT)`);
              break;
            case 'ArrowRight':
              lines.push(`page('${convertedSelector}').input(Keys.RIGHT)`);
              break;
          }
        } else {
          switch(action.key) {
            case 'Enter':
              lines.push('page.actions.type(Keys.ENTER)');
              break;
            case 'Tab':
              lines.push('page.actions.type(Keys.TAB)');
              break;
            case 'Escape':
              lines.push('page.actions.type(Keys.ESCAPE)');
              break;
            case 'ArrowUp':
              lines.push('page.actions.type(Keys.UP)');
              break;
            case 'ArrowDown':
              lines.push('page.actions.type(Keys.DOWN)');
              break;
            case 'ArrowLeft':
              lines.push('page.actions.type(Keys.LEFT)');
              break;
            case 'ArrowRight':
              lines.push('page.actions.type(Keys.RIGHT)');
              break;
          }
        }
      }
      lines.push('');
    });

    return lines.join('\n');
}

// Load custom tags on popup open
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['customTags'], result => {
    if (result.customTags) {
      tagsInput.value = result.customTags;
    }
  });
});

resetTagsBtn.addEventListener('click', () => {
  tagsInput.value = DEFAULT_TAGS;
  chrome.storage.local.set({ customTags: DEFAULT_TAGS }, () => {
    resetTagsBtn.textContent = '✓';
    setTimeout(() => {
      resetTagsBtn.textContent = 'Reset';
    }, 2000);
  });
});

chrome.storage.local.get(['customTags'], result => {
  tagsInput.value = result.customTags || DEFAULT_TAGS;
});
