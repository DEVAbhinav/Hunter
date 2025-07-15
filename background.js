// =======================================================================
// FILE: background.js
// =======================================================================
// This service worker handles all communication with the AI model
// and manages background tasks.

// Import the API key from the config file
import { apiKey } from './config.js';

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateReplies") {
    // Call the AI suggestion function
    getAiSuggestions(request.payload)
      .then(suggestions => {
        sendResponse({ status: "success", suggestions: suggestions });
      })
      .catch(error => {
        console.error("AI API Error:", error);
        sendResponse({ status: "error", message: error.message });
      });
    // Return true to indicate that we will respond asynchronously
    return true;
  }
});

async function getAiSuggestions(payload) {
  // Destructure payload
  const { chatHistory, customStrategy, userDraft } = payload;

  console.log("Received payload for AI suggestions:", payload);
  // --- THIS IS THE REAL GEMINI API CALL ---
  // The API key is now loaded from config.js
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  console.log("Calling Gemini API with payload:", payload);

  // Build a detailed prompt based on the provided payload
  let taskDescription = '';
  if (userDraft) {
    taskDescription = `
    **User's Draft Reply:**
    "${userDraft}"

    **Task:**
    Based on the strategy and history, refine the user's draft reply. Provide 3 improved versions. Separate each suggestion with a newline and three dashes (\\n---\\n).
    `;
  } else {
    taskDescription = `
    **Task:**
    Based on the strategy and history, suggest 3 potential replies to the last message. Separate each suggestion with a newline and three dashes (\\n---\\n).
    `;
  }

  const prompt = `You are a communication assistant. Your goal is to help the user reply to messages based on a specific strategy.

  **Custom Reply Strategy:**
  ${customStrategy || "Reply in a friendly and supportive tone."}

  **Recent Chat History:**
  ${chatHistory || "(No history available)"}
  
  ${taskDescription}
  `;

  console.log("--- GENERATED PROMPT ---");
  console.log(prompt);
  console.log("----------------------");

  const apiPayload = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }]
  };
  console.log("--- API PAYLOAD ---");
  console.log(JSON.stringify(apiPayload, null, 2));
  console.log("----------------------");

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiPayload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    
    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      
      const rawText = result.candidates[0].content.parts[0].text;
      // The model is instructed to separate suggestions with "\n---\n"
      // We split the string to get an array of suggestions.
      const suggestions = rawText.split('\n---\n').map(s => s.trim()).filter(s => s);
      
      console.log("Received suggestions from AI:", suggestions);
      return suggestions;

    } else {
      console.error("Unexpected API response structure:", result);
      throw new Error("Could not parse suggestions from API response.");
    }

  } catch (error) {
    console.error("Error fetching AI suggestions:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
}
