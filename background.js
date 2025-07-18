// =======================================================================
// FILE: background.js
// =======================================================================
// This service worker handles all communication with the AI model
// and manages background tasks.

// Import the API key from the config file, and rename it for clarity
import { apiKey as defaultApiKey } from './config.js';

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
  // Destructure payload, including the optional user-provided API key and model
  const { chatHistory, customStrategy, userDraft, apiKey, model } = payload;

  console.log("Received payload for AI suggestions:", payload);

  // Use the user's API key if provided, otherwise fall back to the default
  const keyToUse = apiKey || defaultApiKey;

  if (!keyToUse) {
    throw new Error("API key is missing. Please add it to config.js or in the extension settings.");
  }

  // Use the user's selected model, or fall back to a default
  const modelToUse = model || 'gemini-2.5-flash-lite-preview-06-17';

  // --- THIS IS THE REAL GEMINI API CALL ---
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${keyToUse}`;

  console.log("Calling Gemini API with payload:", payload);

  // Build a detailed prompt based on the provided payload
  let taskDescription = '';
  if (userDraft) {
    taskDescription = `
    **User's Draft Reply:**
    "${userDraft}"

    **Task:**
    Based on the strategy and history, refine the user's draft reply. Provide 3 improved versions.
    `;
  } else {
    taskDescription = `
    **Task:**
    Based on the strategy and history, suggest 3 potential replies to the last message.
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
    }],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: {
        type: "object",
        properties: {
          "suggestions": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": ["suggestions"]
      }
    }
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
      // The model is now instructed to return a JSON string conforming to the schema.
      const parsedJson = JSON.parse(rawText);
      
      if (!parsedJson.suggestions || !Array.isArray(parsedJson.suggestions)) {
        throw new Error("Invalid JSON structure in API response. 'suggestions' array not found.");
      }
      
      const suggestions = parsedJson.suggestions.map(s => s.trim()).filter(s => s);
      
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
