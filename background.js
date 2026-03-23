importScripts('defaults.js');

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'authenticate') {
    authenticate().then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'signOut') {
    signOut().then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'getOrCreateAppFolder') {
    getOrCreateAppFolder().then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'listFolder') {
    listFolderContents(message.folderId).then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'autofill') {
    const apiBase = message.beaconApiBaseUrl;
    autofill(message.extraction, apiBase, message.tabId)
      .then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'parseDocument') {
    parseDocument(message.fileId, message.mimeType, message.fileName)
      .then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function signOut() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => resolve({ success: true }));
      } else {
        resolve({ success: true });
      }
    });
  });
}

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Failed to get auth token'));
        return;
      }
      if (!token) {
        reject(new Error('No access token received'));
        return;
      }
      resolve(token);
    });
  });
}

async function authenticate() {
  try {
    await getAccessToken();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function driveApiRequest(url, token) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const msg = errData.error?.message || response.statusText || `API error ${response.status}`;
    throw new Error(msg);
  }

  return response.json();
}

function trimBeaconBase(s) {
  return (s || '').trim().replace(/\/$/, '');
}

function getBeaconApiBaseUrlFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['beaconApiBaseUrl'], (r) => {
      const s = trimBeaconBase(r.beaconApiBaseUrl);
      if (s) return resolve(s);
      const d =
        typeof BEACON_API_DEFAULT_BASE_URL !== 'undefined'
          ? trimBeaconBase(BEACON_API_DEFAULT_BASE_URL)
          : '';
      resolve(d);
    });
  });
}

/**
 * Parse + extract via beacon-api (Landing AI key stays on server).
 */
async function parseDocument(fileId, mimeType, fileName) {
  const base = await getBeaconApiBaseUrlFromStorage();
  if (!base) {
    throw new Error('Beacon API base URL is not set. Use defaults.js or sign in with a saved URL.');
  }
  const googleToken = await getAccessToken();

  const res = await fetch(`${base}/v1/landing/parse-document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${googleToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileId, mimeType, fileName })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.message || data.error || `Parse failed (${res.status})`
    );
  }
  if (data.success === false) {
    throw new Error(data.error || 'Parse failed');
  }
  return {
    success: true,
    extraction: data.extraction ?? null,
    chunks: data.chunks
  };
}

const APP_FOLDER_NAME = 'Beacon';

async function getOrCreateAppFolder() {
  const token = await getAccessToken();

  // Check if folder already exists
  const searchParams = new URLSearchParams({
    q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    pageSize: '1'
  });
  const searchData = await driveApiRequest(`${DRIVE_API_BASE}/files?${searchParams}`, token);

  if (searchData.files && searchData.files.length > 0) {
    return { success: true, folderId: searchData.files[0].id };
  }

  // Create the folder
  const response = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to create folder');
  }

  const folder = await response.json();
  return { success: true, folderId: folder.id };
}

const YUTORI_WIDTH = 1280;
const YUTORI_HEIGHT = 800;

async function convertToWebP(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(YUTORI_WIDTH, YUTORI_HEIGHT);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, YUTORI_WIDTH, YUTORI_HEIGHT);
  const webpBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(webpBlob);
  });
}

const MAX_TURNS = 5;

/**
 * Calls your beacon-api (or compatible backend) with the user's Google OAuth token.
 * The Yutori API key stays on the server — see /beacon-api/README.md
 */
async function autofill(extraction, beaconApiBaseUrl, tabId) {
  let base = (beaconApiBaseUrl || '').trim().replace(/\/$/, '');
  if (!base && typeof BEACON_API_DEFAULT_BASE_URL !== 'undefined') {
    base = String(BEACON_API_DEFAULT_BASE_URL).trim().replace(/\/$/, '');
  }
  if (!base) {
    throw new Error('Beacon API base URL is not set. Edit defaults.js or enter it in the sidebar.');
  }
  const googleToken = await getAccessToken();
  const fields = Object.entries(extraction)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join('\n');
  const task = `Please autofill the form on this page with the following information:\n${fields}\n\nClick each field and type the corresponding value.`;


  const messages = [];
  let totalActions = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`[Yutori] Turn ${turn + 1}/${MAX_TURNS}`);

    // Capture fresh screenshot each turn
    const pngDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const screenshot = await convertToWebP(pngDataUrl);

    const userContent = [
      { type: 'image_url', image_url: { url: screenshot } }
    ];
    if (turn === 0) {
      userContent.unshift({ type: 'text', text: task });
    }
    messages.push({ role: 'user', content: userContent });

    // Call Yutori n1 with full conversation history
    const requestBody = { model: 'n1-latest', messages };
    console.log(`[Yutori] Turn ${turn + 1} request:`, JSON.stringify({
      model: requestBody.model,
      message_count: messages.length,
      last_message_content_types: messages[messages.length - 1].content.map(c => c.type),
      task: turn === 0 ? task : '(screenshot only)'
    }, null, 2));

    let data;
    try {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60000)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.warn(`[Yutori] Turn ${turn + 1} failed:`, errData.message || errData.detail || res.status);
        continue; // retry next turn with fresh screenshot
      }
      data = await res.json();
    } catch (err) {
      console.warn(`[Yutori] Turn ${turn + 1} timed out, retrying...`, err.message);
      continue; // retry next turn
    }

    const assistantMessage = data.choices?.[0]?.message;
    console.log(`[Yutori] Turn ${turn + 1} response:`, JSON.stringify(assistantMessage, null, 2));

    if (!assistantMessage) break;
    messages.push({ role: 'assistant', ...assistantMessage });

    const toolCalls = assistantMessage.tool_calls ?? [];
    if (toolCalls.length === 0) {
      console.log('[Yutori] No more actions — form complete');
      break;
    }

    // Execute each action
    for (const toolCall of toolCalls) {
      console.log('[Yutori] Executing:', toolCall.function.name, toolCall.function.arguments);
      const result = await chrome.tabs.sendMessage(tabId, { action: 'executeAction', toolCall });
      console.log('[Yutori] Action result:', result);
      totalActions++;
    }
  }

  return { success: true, actionsExecuted: totalActions };
}

async function listFolderContents(folderId) {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    orderBy: 'folder,name',
    pageSize: '100'
  });

  const url = `${DRIVE_API_BASE}/files?${params}`;
  const data = await driveApiRequest(url, token);

  return { success: true, items: data.files || [] };
}
