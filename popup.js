document.addEventListener('DOMContentLoaded', () => {
  const authSection = document.getElementById('auth-section');
  const setupSection = document.getElementById('setup-section');
  const documentsSection = document.getElementById('documents-section');
  const contentSection = document.getElementById('content-section');
  const documentsList = document.getElementById('documents-list');
  const contentTitle = document.getElementById('content-title');
  const contentBody = document.getElementById('content-body');
  const errorMessage = document.getElementById('error-message');
  const loading = document.getElementById('loading');
  const openFolderLink = document.getElementById('open-folder-link');
  const signoutBtn = document.getElementById('signout-btn');
  const apiKeyInput = document.getElementById('api-key-input');
  const yutoriKeyInput = document.getElementById('yutori-key-input');
  const autofillBtn = document.getElementById('autofill-btn');
  const autofillStatus = document.getElementById('autofill-status');
  let lastExtraction = null;

  function setSignedIn(isSignedIn) {
    signoutBtn.classList.toggle('hidden', !isSignedIn);
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
  }

  function showLoading(show) {
    loading.classList.toggle('hidden', !show);
  }

  function showSetup() {
    setupSection.classList.remove('hidden');
    documentsSection.classList.add('hidden');
    contentSection.classList.add('hidden');
  }

  // Check if already authenticated and folder exists
  chrome.storage.local.get(['isAuthenticated', 'appFolderId'], (result) => {
    if (result.isAuthenticated && result.appFolderId) {
      authSection.classList.add('hidden');
      openFolderLink.href = `https://drive.google.com/drive/folders/${result.appFolderId}`;
      setSignedIn(true);
      showSetup();
    }
  });

  document.getElementById('auth-btn').addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const yutoriKey = yutoriKeyInput.value.trim();
    if (!apiKey) {
      showError('Please enter your Landing AI API key');
      return;
    }
    if (!yutoriKey) {
      showError('Please enter your Yutori API key');
      return;
    }

    hideError();
    showLoading(true);
    try {
      const authRes = await chrome.runtime.sendMessage({ action: 'authenticate' });
      if (!authRes.success) {
        showError(authRes.error || 'Authentication failed');
        showLoading(false);
        return;
      }

      const folderRes = await chrome.runtime.sendMessage({ action: 'getOrCreateAppFolder' });
      if (!folderRes.success) {
        showError(folderRes.error || 'Failed to set up folder');
        showLoading(false);
        return;
      }

      chrome.storage.local.set({ isAuthenticated: true, appFolderId: folderRes.folderId, landingAiKey: apiKey, yutoriKey });
      openFolderLink.href = `https://drive.google.com/drive/folders/${folderRes.folderId}`;
      authSection.classList.add('hidden');
      setSignedIn(true);
      showSetup();
    } catch (err) {
      showError(err.message || 'Something went wrong');
    }
    showLoading(false);
  });

  signoutBtn.addEventListener('click', async () => {
    hideError();
    try {
      await chrome.runtime.sendMessage({ action: 'signOut' });
      chrome.storage.local.remove(['isAuthenticated', 'appFolderId', 'landingAiKey', 'yutoriKey']);
      setSignedIn(false);
      setupSection.classList.add('hidden');
      documentsSection.classList.add('hidden');
      contentSection.classList.add('hidden');
      authSection.classList.remove('hidden');
    } catch (err) {
      showError(err.message || 'Failed to sign out');
    }
  });

  document.getElementById('load-btn').addEventListener('click', async () => {
    hideError();
    showLoading(true);
    try {
      const { appFolderId } = await chrome.storage.local.get('appFolderId');
      const response = await chrome.runtime.sendMessage({ action: 'listFolder', folderId: appFolderId });
      if (response.success) {
        setupSection.classList.add('hidden');
        documentsSection.classList.remove('hidden');
        renderDocuments(response.items);
      } else {
        showError(response.error || 'Failed to load documents');
      }
    } catch (err) {
      showError(err.message || 'Failed to load documents');
    }
    showLoading(false);
  });

  document.getElementById('back-to-setup-btn').addEventListener('click', () => {
    documentsSection.classList.add('hidden');
    showSetup();
  });

  document.getElementById('back-btn').addEventListener('click', () => {
    contentSection.classList.add('hidden');
    documentsSection.classList.remove('hidden');
  });

  autofillBtn.addEventListener('click', async () => {
    if (!lastExtraction) {
      showError('No extracted data available');
      return;
    }
    hideError();
    autofillBtn.disabled = true;
    autofillStatus.textContent = 'Autofilling form...';
    autofillStatus.classList.remove('hidden');

    try {
      const { yutoriKey } = await chrome.storage.local.get('yutoriKey');
      if (!yutoriKey) {
        showError('Yutori API key not found. Please sign out and sign in again.');
        return;
      }
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      console.log('[Popup] Autofilling tab:', tab?.id, tab?.url);
      const response = await chrome.runtime.sendMessage({
        action: 'autofill',
        extraction: lastExtraction,
        yutoriKey,
        tabId: tab.id
      });
      if (response.success) {
        autofillStatus.textContent = `Done — ${response.actionsExecuted} action(s) executed`;
      } else {
        showError(response.error || 'Autofill failed');
        autofillStatus.classList.add('hidden');
      }
    } catch (err) {
      showError(err.message || 'Autofill failed');
      autofillStatus.classList.add('hidden');
    }
    autofillBtn.disabled = false;
  });

  function renderDocuments(items) {
    documentsList.innerHTML = '';
    if (!items || items.length === 0) {
      documentsList.innerHTML = '<div class="document-item" style="cursor:default"><span>No documents found. Upload files to your Yutori folder.</span></div>';
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'document-item';
      div.innerHTML = `
        <span class="document-icon">${getFileIcon(item.mimeType)}</span>
        <div class="document-info">
          <div class="document-name" title="${item.name}">${item.name}</div>
          <div class="document-type">${getFileTypeLabel(item.mimeType)}</div>
        </div>
      `;
      div.addEventListener('click', async () => {
        hideError();
        showLoading(true);
        try {
          const { landingAiKey } = await chrome.storage.local.get('landingAiKey');
          const response = await chrome.runtime.sendMessage({
            action: 'parseDocument',
            fileId: item.id,
            mimeType: item.mimeType,
            fileName: item.name,
            landingAiKey
          });
          if (response.success) {
            lastExtraction = response.extraction;
            contentTitle.textContent = item.name;
            contentBody.textContent = JSON.stringify(response.extraction, null, 2);
            documentsSection.classList.add('hidden');
            contentSection.classList.remove('hidden');
            autofillStatus.classList.add('hidden');
          } else {
            showError(response.error || 'Failed to parse document');
          }
        } catch (err) {
          showError(err.message || 'Failed to parse document');
        }
        showLoading(false);
      });
      documentsList.appendChild(div);
    });
  }

  function getFileIcon(mimeType) {
    const icons = {
      'application/vnd.google-apps.document': '📄',
      'application/vnd.google-apps.spreadsheet': '📊',
      'application/vnd.google-apps.presentation': '📽️',
      'application/pdf': '📕',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📄',
      'text/plain': '📝'
    };
    return icons[mimeType] || '📄';
  }

  function getFileTypeLabel(mimeType) {
    const types = {
      'application/vnd.google-apps.document': 'Google Doc',
      'application/vnd.google-apps.spreadsheet': 'Google Sheet',
      'application/vnd.google-apps.presentation': 'Google Slides',
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Doc',
      'text/plain': 'Text'
    };
    return types[mimeType] || 'File';
  }
});
