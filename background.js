let isRecording = false;
let recordedActions = [];
let recordingUrl = '';
let generatedCode = 'Generated code will appear here...';
let isLocating = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'startRecording') {
    isRecording = true;
    recordedActions = [];
    recordingUrl = message.url || '';
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  } else if (message.command === 'stopRecording') {
    isRecording = false;
    chrome.action.setBadgeText({ text: '' });
  } else if (message.command === 'getRecordingState') {
    sendResponse({ isRecording });
  } else if (message.type === 'recordAction') {
    if (isRecording) {
      if (message.shouldReplace) {
        recordedActions = recordedActions.filter(a => 
          !(a.selector === message.selector && a.type === 'input')
        );
      }
      message.action.url = recordingUrl;
      recordedActions.push(message.action);
    }
  } else if (message.command === 'getActions') {
    sendResponse({ actions: recordedActions });
  } else if (message.command === 'setGeneratedCode') {
    generatedCode = message.code;
  } else if (message.command === 'getGeneratedCode') {
    sendResponse({ code: generatedCode });
  } else if (message.command === 'setLocatingState') {
    isLocating = message.state;
    sendResponse({ success: true });
  } else if (message.command === 'getLocatingState') {
    sendResponse({ isLocating });
  }
  return true;
});

// Handle any background tasks if needed
chrome.runtime.onInstalled.addListener(() => {
  console.log('DrissionPage Recorder installed');
}); 