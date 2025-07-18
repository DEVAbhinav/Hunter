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

    // Restore panel position
    chrome.storage.local.get('panelPosition', (data) => {
        if (data.panelPosition) {
            panel.style.top = data.panelPosition.top;
            panel.style.left = data.panelPosition.left;
        }
    });

    // Settings Modal
    const modal = document.createElement('div');
    modal.id = 'ai-settings-modal';
    modal.innerHTML = `
      <div class="ai-settings-content">
        <h3>Custom Strategy for <strong class="contact-name">...</strong></h3>
        <p style="font-size: 13px; margin-top: 0; color: #666;">Define how the AI should reply to this person.</p>
        <textarea id="ai-strategy-input" placeholder="e.g., Always be empathetic, but firm about my boundaries..."></textarea>
        
        <h3 style="margin-top: 15px;">Model Selection</h3>
        <p style="font-size: 13px; margin-top: 0; color: #666;">Choose the AI model for generating suggestions.</p>
        <select id="ai-model-select" style="width: 98%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-flash-lite-preview-06-17">Gemini 2.5 Flash-Lite (Preview)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
        </select>
        <p id="ai-model-description" style="font-size: 12px; color: #666; margin-top: 5px; min-height: 40px;"></p>

        <h3 style="margin-top: 15px;">API Key</h3>
        <p style="font-size: 13px; margin-top: 0; color: #666;">Optional: Use your own API key.</p>
        <input type="password" id="ai-api-key-input" placeholder="Enter your API key" style="width: 95%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;"/>
        <div class="ai-settings-controls">
          <button id="ai-settings-cancel">Cancel</button>
          <button id="ai-settings-save">✔️ Save Settings</button>
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

    // Draggable Panel Logic
    const panelHeader = document.querySelector('.ai-panel-header');
    panelHeader.addEventListener('mousedown', onDragStart);

    // Settings Modal Controls
    document.getElementById('ai-settings-save').addEventListener('click', saveSettings);
    document.getElementById('ai-settings-cancel').addEventListener('click', closeSettings);
    document.getElementById('ai-settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'ai-settings-modal') closeSettings();
    });

    // Model selection description
    const modelSelect = document.getElementById('ai-model-select');
    const modelDescriptionEl = document.getElementById('ai-model-description');
    const modelDescriptions = {
        "gemini-2.5-pro": "Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more.",
        "gemini-2.5-flash": "Adaptive thinking, cost efficiency.",
        "gemini-2.5-flash-lite-preview-06-17": "Most cost-efficient model supporting high throughput.",
        "gemini-2.0-flash": "Next generation features, speed, and realtime streaming."
    };
    modelSelect.addEventListener('change', (e) => {
        modelDescriptionEl.textContent = modelDescriptions[e.target.value] || '';
    });
    // Set initial description
    modelDescriptionEl.textContent = modelDescriptions[modelSelect.value];

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

  let isDragging = false;
  let offsetX, offsetY;

  function onDragStart(e) {
    // Prevent dragging when clicking on buttons
    if (e.target.tagName === 'BUTTON') return;

    isDragging = true;
    const panel = document.getElementById('ai-mindful-panel');
    panel.classList.add('dragging'); // Disable transitions while dragging
    const panelHeader = document.querySelector('.ai-panel-header');
    
    // Calculate offset from the top-left of the panel
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    panelHeader.style.cursor = 'grabbing';

    // Add listeners to the document to capture mouse movement anywhere on the page
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd, { once: true }); // { once: true } automatically removes the listener after it's called
  }

  function onDragMove(e) {
    if (!isDragging) return;
    
    const panel = document.getElementById('ai-mindful-panel');
    
    // Calculate new position
    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    // Constrain movement within the viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + panelWidth > viewportWidth) newLeft = viewportWidth - panelWidth;
    if (newTop + panelHeight > viewportHeight) newTop = viewportHeight - panelHeight;

    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
    
    // Remove fixed bottom/right positioning if it exists
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function onDragEnd() {
    isDragging = false;
    const panel = document.getElementById('ai-mindful-panel');
    panel.classList.remove('dragging'); // Re-enable transitions
    const panelHeader = document.querySelector('.ai-panel-header');
    panelHeader.style.cursor = 'grab';

    document.removeEventListener('mousemove', onDragMove);
    
    // Save the final position
    const position = { top: panel.style.top, left: panel.style.left };
    chrome.storage.local.set({ panelPosition: position });
  }
  
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

    // Load API key and model before sending the message
    chrome.storage.local.get(['apiKey', 'selectedModel'], (data) => {
        const apiKey = data.apiKey || null;
        const selectedModel = data.selectedModel || null;

        const payload = {
          chatHistory: getChatHistory(),
          customStrategy: currentStrategy,
          userDraft: userDraft,
          apiKey: apiKey, // Pass the API key in the payload
          model: selectedModel // Pass the selected model
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
    // Load and display API key and model
    chrome.storage.local.get(['apiKey', 'selectedModel'], (data) => {
        if (data.apiKey) {
            document.getElementById('ai-api-key-input').value = data.apiKey;
        }
        const modelSelect = document.getElementById('ai-model-select');
        if (data.selectedModel) {
            modelSelect.value = data.selectedModel;
        }
        // Trigger change to update description
        modelSelect.dispatchEvent(new Event('change'));
    });
    document.getElementById('ai-settings-modal').style.display = 'flex';
  }

  function closeSettings() {
    document.getElementById('ai-settings-modal').style.display = 'none';
  }

  function saveSettings() {
    const newStrategy = document.getElementById('ai-strategy-input').value;
    const newApiKey = document.getElementById('ai-api-key-input').value;
    const selectedModel = document.getElementById('ai-model-select').value;

    currentStrategy = newStrategy;

    const settingsToSave = {
        [currentContactName]: newStrategy,
        selectedModel: selectedModel
    };

    if (newApiKey) {
        settingsToSave.apiKey = newApiKey;
    }

    // Save strategy and API key
    chrome.storage.local.set(settingsToSave, () => {
      if (!newApiKey) {
          chrome.storage.local.remove('apiKey');
      }
      console.log(`Settings saved for ${currentContactName}`);
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
    // More specific selector for the contact name in the main chat panel header
    const contactElement = document.querySelector('#main header .x78zum5.xdt5ytf.x1iyjqo2 .x1iyjqo2.x6ikm8r');
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

  function observeForActiveChatChange(appObserver) {
    const sidePanel = document.querySelector('#pane-side');
    if (sidePanel) {
        console.log("Mindful AI: Side panel detected. Observing for active chat changes.");
        const chatListObserver = new MutationObserver((mutations) => {
            // Check if the active chat has changed
            const newContactName = getCurrentContactName();
            if (newContactName && newContactName !== currentContactName) {
                console.log("Mindful AI: Active chat changed, handling it.");
                handleChatChange();
            }
        });

        // Observe for changes in attributes of chat items, which indicates a change in active chat
        chatListObserver.observe(sidePanel, { 
            childList: true, 
            subtree: true, 
            attributes: true, 
            attributeFilter: ['class'] 
        });
        
        // Disconnect the app observer as we have found what we need
        if(appObserver) appObserver.disconnect();
    }
  }
  
  async function handleChatChange() {
    try {
      const contactName = getCurrentContactName();
      
      if (contactName && contactName !== currentContactName) {
        console.log(`Switching contact to: ${contactName}`);
        currentContactName = contactName;
  
        document.querySelectorAll('.contact-name').forEach(el => el.textContent = currentContactName);
        await loadStrategyForContact(currentContactName);
        triggerSuggestionGeneration();
        observeChatForNewMessages();
      }
    } catch (error) {
      console.error("Mindful AI: Error during chat change:", error);
    }
  }

  // --- 6. INITIALIZATION ---
  function main() {
    initializeUI();

    const appObserver = new MutationObserver((mutations, obs) => {
        // First, try to set up the more specific observer for active chat changes
        observeForActiveChatChange(obs);

        // Fallback to observing the main panel if the side panel isn't there yet
        const mainPanel = document.querySelector('#main');
        if (mainPanel && !document.querySelector('#pane-side')) {
            console.log("Mindful AI: Main panel detected. Setting up chat change observer as fallback.");
            
            handleChatChange(); // Initial call

            const mainPanelObserver = new MutationObserver(() => {
                setTimeout(handleChatChange, 150);
            });
            mainPanelObserver.observe(mainPanel.querySelector('header'), { childList: true, subtree: true, characterData: true });

            obs.disconnect();
        }
    });

    appObserver.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('load', main);

})();
