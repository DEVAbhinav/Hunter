(function() {
  let currentContactName = null;
  let currentStrategy = '';
  let chatObserver = null;

  // --- 1. CREATE AND INJECT UI ---
  function initializeUI() {
    // Main Panel
    const panel = document.createElement('div');
    panel.id = 'ai-mindful-panel';
    panel.innerHTML = `
      <div class="ai-panel-header">
        <span>AI Assistant for <strong class="contact-name">...</strong></span>
        <div class="ai-panel-controls">
          <button id="ai-minimize-btn" title="Minimize">－</button>
          <button id="ai-settings-btn" title="Settings">⚙️</button>
          <button id="ai-refresh-btn" title="Refresh Suggestions">🔄</button>
        </div>
      </div>
      <div class="ai-panel-body">
        <div id="ai-suggestions-container">
          <div class="ai-status-message">Waiting for new message...</div>
        </div>
        <div id="ai-refine-container" style="display: none;">
          <button class="ai-refine-button">✨ Refine My Reply</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Settings Modal
    const modal = document.createElement('div');
    modal.id = 'ai-settings-modal';
    modal.innerHTML = `
      <div class="ai-settings-content">
        <h3>Custom Strategy for <strong class="contact-name">...</strong></h3>
        <p style="font-size: 13px; margin-top: 0; color: #666;">Define how the AI should reply to this person.</p>
        <textarea id="ai-strategy-input" placeholder="e.g., Always be empathetic, but firm about my boundaries..."></textarea>
        <div class="ai-settings-controls">
          <button id="ai-settings-cancel">Cancel</button>
          <button id="ai-settings-save">✔️ Save Strategy</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    addEventListeners();
  }

  // --- 2. ADD EVENT LISTENERS ---
  function addEventListeners() {
    // Panel Controls
    document.getElementById('ai-minimize-btn').addEventListener('click', toggleMinimizePanel);
    document.getElementById('ai-settings-btn').addEventListener('click', openSettings);
    document.getElementById('ai-refresh-btn').addEventListener('click', () => triggerSuggestionGeneration());
    document.getElementById('ai-minimize-btn').addEventListener('click', toggleMinimizePanel);

    // Settings Modal Controls
    document.getElementById('ai-settings-save').addEventListener('click', saveSettings);
    document.getElementById('ai-settings-cancel').addEventListener('click', closeSettings);
    document.getElementById('ai-settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'ai-settings-modal') closeSettings();
    });

    // Refine Button
    document.querySelector('.ai-refine-button').addEventListener('click', () => {
        const userDraft = getChatInputText();
        if(userDraft) {
            triggerSuggestionGeneration(userDraft);
        }
    });

    // Suggestions container (for dynamically added suggestions)
    document.getElementById('ai-suggestions-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion')) {
            navigator.clipboard.writeText(e.target.textContent).then(() => {
                e.target.textContent = 'Copied!';
                setTimeout(() => {
                    // This is a simplified restore. A better way would be to store original text.
                    triggerSuggestionGeneration();
                }, 1000);
            });
        }
    });

    // Listen for user typing in the chat input
    const chatInput = getChatInputNode();
    if (chatInput) {
        chatInput.addEventListener('input', handleChatInput);
    }
  }

  // --- 3. CORE LOGIC ---
  
  function toggleMinimizePanel() {
    const panel = document.getElementById('ai-mindful-panel');
    panel.classList.toggle('minimized');
  }

  function triggerSuggestionGeneration(userDraft = null) {
    // Check for "context invalidated" error
    if (chrome.runtime?.id === undefined) {
        console.warn("Extension context invalidated. Aborting API call.");
        return;
    }
    const suggestionsContainer = document.getElementById('ai-suggestions-container');
    suggestionsContainer.innerHTML = `<div class="ai-status-message">Generating...</div>`;

    const payload = {
      chatHistory: getChatHistory(),
      customStrategy: currentStrategy,
      userDraft: userDraft
    };

    chrome.runtime.sendMessage({ action: "generateReplies", payload }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Chrome runtime error:", chrome.runtime.lastError.message);
        suggestionsContainer.innerHTML = `<div class="ai-status-message">Error: Could not connect to the extension. Please reload the page.</div>`;
        return;
      }
      if (response && response.status === 'success') {
        displaySuggestions(response.suggestions);
      } else {
        suggestionsContainer.innerHTML = `<div class="ai-status-message">Error: ${response?.message || 'Could not get suggestions.'}</div>`;
      }
    });
  }

  function handleChatInput(e) {
      const refineContainer = document.getElementById('ai-refine-container');
      if (e.target.textContent.trim().length > 0) {
          refineContainer.style.display = 'block';
      } else {
          refineContainer.style.display = 'none';
      }
  }

  function displaySuggestions(suggestions) {
    const container = document.getElementById('ai-suggestions-container');
    container.innerHTML = '';
    if (suggestions && suggestions.length > 0) {
        suggestions.forEach(text => {
            const div = document.createElement('div');
            div.className = 'suggestion';
            div.textContent = text;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = `<div class="ai-status-message">No suggestions found.</div>`;
    }
  }

  // --- 4. SETTINGS & STORAGE ---
  function openSettings() {
    document.getElementById('ai-strategy-input').value = currentStrategy;
    document.getElementById('ai-settings-modal').style.display = 'flex';
  }

  function closeSettings() {
    document.getElementById('ai-settings-modal').style.display = 'none';
  }

  function saveSettings() {
    const newStrategy = document.getElementById('ai-strategy-input').value;
    currentStrategy = newStrategy;
    // Save strategy using the contact's name as the key
    chrome.storage.local.set({ [currentContactName]: newStrategy }, () => {
      console.log(`Strategy saved for ${currentContactName}`);
      closeSettings();
      triggerSuggestionGeneration();
    });
  }

  async function loadStrategyForContact(contactName) {
    return new Promise((resolve, reject) => {
      // Check for "context invalidated" error
      if (chrome.runtime?.id === undefined) {
        return reject(new Error("Extension context invalidated."));
      }
      chrome.storage.local.get(contactName, (result) => {
        if (chrome.runtime.lastError) {
          console.error("Chrome runtime error:", chrome.runtime.lastError.message);
          return reject(new Error(chrome.runtime.lastError.message));
        }
        currentStrategy = result[contactName] || '';
        console.log(`Loaded strategy for ${contactName}:`, currentStrategy);
        resolve();
      });
    });
  }
  
  // --- 5. DOM INTERACTION & OBSERVATION ---
  function getCurrentContactName() {
    const contactElement = document.querySelector('#main header div[role="button"] span[dir="auto"]');
    return contactElement ? contactElement.textContent.trim() : null;
  }
  
  function getChatHistory() {
    const messages = [];
    const messageNodes = document.querySelectorAll('.message-in, .message-out');
    messageNodes.forEach(node => {
      const textElement = node.querySelector('.selectable-text.copyable-text > span');
      if (textElement) {
        const author = node.classList.contains('message-in') ? getCurrentContactName() || 'Them' : 'Me';
        messages.push(`${author}: ${textElement.textContent}`);
      }
    });
    return messages.slice(-10).join('\n');
  }

  function getChatInputNode() {
    return document.querySelector('footer div[role="textbox"][contenteditable="true"]');
  }
  
  function getChatInputText() {
    const node = getChatInputNode();
    return node ? node.textContent.trim() : '';
  }

  function observeChatForNewMessages() {
    if (chatObserver) {
      chatObserver.disconnect();
    }
    const chatContainer = document.querySelector('#main .copyable-area');
    if (!chatContainer) {
      console.warn("Mindful AI: Could not find chat container to observe.");
      return;
    }

    chatObserver = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          let isIncomingMessage = false;
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.querySelector && node.querySelector('.message-in')) {
              isIncomingMessage = true;
            }
          });
          if (isIncomingMessage) {
            console.log('New message detected!');
            clearTimeout(window.aiDebounce);
            window.aiDebounce = setTimeout(() => triggerSuggestionGeneration(), 1000);
            break;
          }
        }
      }
    });

    chatObserver.observe(chatContainer, { childList: true, subtree: true });
    console.log("Mindful AI: Observing for new messages in current chat.");
  }
  
  async function handleChatChange() {
    const contactName = getCurrentContactName();
    
    if (contactName && contactName !== currentContactName) {
      console.log(`Switching contact to: ${contactName}`);
      currentContactName = contactName;

      document.querySelectorAll('.contact-name').forEach(el => el.textContent = currentContactName);
      await loadStrategyForContact(currentContactName);
      triggerSuggestionGeneration();
      observeChatForNewMessages();
    }
  }

  // --- 6. INITIALIZATION ---
  function main() {
    initializeUI();

    const appObserver = new MutationObserver((mutations, obs) => {
      const mainPanel = document.querySelector('#main');
      if (mainPanel) {
        console.log("Mindful AI: Main panel detected. Setting up chat change observer.");
        
        handleChatChange();

        const mainPanelObserver = new MutationObserver(handleChatChange);
        mainPanelObserver.observe(mainPanel, { childList: true, subtree: true });

        obs.disconnect();
      }
    });

    appObserver.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('load', main);

})();
