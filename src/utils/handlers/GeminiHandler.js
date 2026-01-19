import { buildSmartPrompt } from "../modelhandler";

let API_KEY = null;

export const initGemini = async () => {
  try {
    // Dynamic import to avoid build errors if file missing initially
    // User requested keys.json in src/
    // Note: In Vite/React, usually we use import.meta.glob or just import it if it exists.
    // If we are moving this file deeper to src/utils/handlers/, the relative path to keys.json (in src/?) changes.
    // keys.json is likely in src/keys.json
    // So current file: src/utils/handlers/GeminiHandler.js
    // keys.json: src/keys.json -> ../../keys.json
    const keyModule = await import('../../keys.json');
    API_KEY = keyModule.default?.GOOGLE_API_KEY || keyModule.GOOGLE_API_KEY;

    if (!API_KEY) {
      console.error("Gemini key missing in keys.json");
      return false;
    }
    console.log("Gemini initialized with key");
    return true;
  } catch (e) {
    console.error("Failed to load keys.json for Gemini", e);
    return false;
  }
};

export const getGeminiMove = async (tracker, model, queryFormat) => {
  console.log(`[GeminiHandler] Querying ${model}...`);
  
  if (!API_KEY) {
      return { raw: "Error: Gemini API Key not initialized.", san: null };
  }

  const prompt = buildSmartPrompt(tracker, queryFormat, "full", tracker.turn());
  const promptText = prompt.content;
  let rawResponse = "";
  let selectedMove = null;

  try {
    // User specified model override
    const actualModel = "gemini-2.5-flash"; 
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: promptText }]
          }]
        })
      }
    );

    const data = await response.json();
    if (data.candidates && data.candidates[0].content) {
      const text = data.candidates[0].content.parts[0].text;
      rawResponse = text;
      
      const sanRegex = /[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O-O|O-O/g;
      const matches = text.match(sanRegex);
      
      if (matches && matches.length > 0) {
        selectedMove = { san: matches[matches.length - 1] };
      } else {
        selectedMove = { san: text.trim() };
      }
    } else {
      throw new Error("Invalid Gemini response: " + JSON.stringify(data));
    }

  } catch (err) {
    console.error("Gemini API Error:", err);
    rawResponse = "Error contacting Gemini: " + err.message + " (Playing random move)";
    // We could return null or let the fallback happen in the dispatcher, 
    // but the dispatcher expects a result. 
    // Ideally we return the error in raw, and maybe a null/random SAN?
    // For now, let's just return what we have (null san).
    // The GameContext checks result && result.san.
  }

  return {
    raw: rawResponse,
    san: selectedMove ? selectedMove.san : null
  };
};
