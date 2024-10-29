const recordBtn = document.getElementById('record');
const stopBtn = document.getElementById('stop');
const output = document.getElementById('output');
const copyBtn = document.getElementById('copyBtn');
const locateBtn = document.getElementById('locate');
const tagsInput = document.getElementById('tagsInput');
const updateTagsBtn = document.getElementById('updateTags');
const resetTagsBtn = document.getElementById('resetTags');
let isLocating = false;
const DEFAULT_TAGS = 'data-testid, aria-label, name, placeholder, title, href, type, role';

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
    chrome.runtime.sendMessage({ 
      command: 'startRecording',
      url: response?.url || tab.url
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
  // ... existing DOMContentLoaded code ...
  
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
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { command: 'startLocating' });
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
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { command: 'stopLocating' });
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
// We don't want to stop locating when popup closes
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
      `page.get("${actions[0]?.url || window.location.href}")`,
      ''
    ];
  
    function convertSelector(selector) {
      // Special case for quoted text selectors (e.g. '"Images')
      if (selector.startsWith('"')) {
        return selector.slice(1); // Remove the leading quote
      }

      // Special case for links with text
      if (selector.startsWith('a:contains("') && selector.endsWith('")')) {
        return selector.slice(11, -2); // Remove a:contains(" and ")
      }
      
      // Convert attribute selectors to DrissionPage format
      return selector
        // Convert [attr="value"] to @attr=value
        .replace(/\[([^\]]+)="([^"]+)"\]/g, (match, attr, value) => {
          // Special case for type attribute
          if (attr === 'type') {
            return `[${attr}=${value}]`;
          }
          return `@${attr}=${value}`;
        })
        // Convert element[attr="value"] to tag@attr=value
        .replace(/(\w+)\[([^\]]+)="([^"]+)"\]/g, (match, tag, attr, value) => {
          // Special case for type attribute
          if (attr === 'type') {
            return `${tag}[${attr}=${value}]`;
          }
          return `${tag}@${attr}=${value}`;
        })
        // Convert :nth-of-type(n) to [n]
        .replace(/:nth-of-type\((\d+)\)/g, '[$1]')
        // Convert :contains("text") to @text=text
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
  // Set input value to default tags
  tagsInput.value = DEFAULT_TAGS;
  
  // Save to storage
  chrome.storage.local.set({ customTags: DEFAULT_TAGS }, () => {
    resetTagsBtn.textContent = '✓';
    setTimeout(() => {
      resetTagsBtn.textContent = 'Reset';
    }, 2000);
  });
});

// Update the initial load to use default tags if none saved
chrome.storage.local.get(['customTags'], result => {
  tagsInput.value = result.customTags || DEFAULT_TAGS;
});