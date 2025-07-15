# Mindful Reply Assistant - Chrome Extension

## 🚀 Introduction
Mindful Reply Assistant is a Chrome extension designed to help you communicate more effectively and mindfully in your web-based chats. It integrates directly into your chat applications (like WhatsApp Web, Telegram Web, etc.) and provides context-aware reply suggestions based on your own predefined strategies.

This tool is for developers looking to build a powerful, personalized communication assistant. The code is provided as a robust starting point, with key areas for customization clearly marked.

## ✨ Features
- **Automatic Suggestions:** Proactively generates reply suggestions when a new message is received.
- **Manual Refinement:** Allows you to draft a reply and ask the AI to refine or rephrase it.
- **Custom Reply Strategies:** Set a detailed communication strategy (tone, rules, boundaries) for each contact.
- **Context Persistence:** Remembers your strategy for each person, ensuring consistent and appropriate suggestions.
- **Mindful UI/UX:** A beautiful, minimal interface inspired by Headspace to promote calm and focus.
- **Easy to Customize:** Built with clean HTML, CSS, and vanilla JavaScript, with clear placeholders for DOM interaction logic.

## 📂 Folder Structure
The project is organized into the following files:

```
mindful-reply-assistant/
├── manifest.json         # Core extension configuration, permissions, and scripts.
├── styles.css            # All CSS for the UI, following the "Mindful Minimal" theme.
├── background.js         # Service worker; handles all AI API calls and background logic.
├── content.js            # Injected into the webpage; handles UI, DOM interaction, and events.
└── images/
    └── (icon files)      # Icons for the extension toolbar.
```

## 🛠️ How to Run and Test Locally
Follow these steps to load and test the extension in your Chrome browser.

### Step 1: Prepare the Files
1.  Create a folder on your computer named `mindful-reply-assistant`.
2.  Inside this folder, create the files (`manifest.json`, `styles.css`, `background.js`, `content.js`) and the `images` subfolder as outlined in the structure above.
3.  Copy the code from the "Complete Chrome Extension Project Files" document into the corresponding files.
4.  (Optional) Create some simple 16x16, 48x48, and 128x128 pixel PNG icons and place them in the `images` folder. If you don't, the extension will still work but might show a default icon.

### Step 2: Load the Extension in Chrome
1.  Open Google Chrome.
2.  Navigate to the extensions page by typing `chrome://extensions` in your address bar and pressing Enter.
3.  In the top-right corner, toggle on **"Developer mode"**.
4.  Three new buttons will appear. Click on **"Load unpacked"**.
5.  A file selection dialog will open. Navigate to and select the `mindful-reply-assistant` folder you created.
6.  The "Mindful Reply Assistant" will now appear in your list of extensions, and its icon should be visible in your Chrome toolbar.

### Step 3: Testing the Extension
The extension is currently configured with placeholder functions for interacting with a chat application. This means it will work on any webpage, but it won't read the actual chat content until you customize it.

1.  Navigate to any website (e.g., google.com or web.whatsapp.com).
2.  You should see the AI Assistant panel appear in the bottom-right corner.
3.  The panel will show a placeholder contact name ("Jane Doe") and some mock suggestions. This confirms the UI is loading correctly.
4.  Test the Features:
    *   **Settings:** Click the `⚙️` icon. The settings modal should appear. Type a strategy and click "✔️ Save Strategy". The modal will close. Re-open it to see that your strategy was saved.
    *   **Manual Refinement:** Type something in any text box on the page (like the Google search bar). The "✨ Refine My Reply" button should appear in the panel. Click it to see mock "refined" suggestions.
    *   **Clipboard:** Click on any suggestion. It should display "Copied!" and the text will be in your clipboard.

## 🔧 IMPORTANT: Customization for a Real Chat App
To make the extension work on a specific site like WhatsApp Web, you must update the placeholder functions in `content.js`.

1.  Open `content.js` and go to **Section 5: DOM INTERACTION**.
2.  `getCurrentContactId()`: Use Chrome's DevTools (Right-click -> Inspect) on the chat page to find the CSS selector for the contact's name in the header and update the function.
3.  `getChatHistory()`: Find the selectors for the chat message bubbles. You will need to loop through them, identify who sent the message (them vs. you), and extract the text content.
4.  `getChatInputNode()`: Find the selector for the text input field where you type your messages.
5.  `observeChatForNewMessages()`: Find the selector for the main container that holds all the chat messages. The `MutationObserver` will watch this element for newly added messages.

By updating these functions with the correct selectors for your target website, the extension will transition from a mock-up to a fully functional tool.

