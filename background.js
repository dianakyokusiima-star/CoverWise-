chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "coverwise-analyze",
    title: "Analyze with CoverWise™",
    contexts: ["image"]
  });

  chrome.storage.local.get("analyses", (data) => {
    if (!data.analyses) chrome.storage.local.set({ analyses: [] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "coverwise-analyze" && info.srcUrl) {
    chrome.storage.local.set({ pendingImageUrl: info.srcUrl }, () => {
      chrome.action.openPopup?.() || chrome.tabs.sendMessage(tab.id, {
        type: "OPEN_POPUP_WITH_IMAGE",
        imageUrl: info.srcUrl
      });
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ANALYZE_COVER") {
    analyzeWithClaude(msg.imageBase64, msg.imageUrl, msg.metadata)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.type === "SAVE_ANALYSIS") {
    chrome.storage.local.get("analyses", (data) => {
      const analyses = data.analyses || [];
      analyses.unshift(msg.analysis);
      if (analyses.length > 20) analyses.pop();
      chrome.storage.local.set({ analyses });
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.type === "GET_ANALYSES") {
    chrome.storage.local.get("analyses", (data) => {
      sendResponse({ analyses: data.analyses || [] });
    });
    return true;
  }
});

async function analyzeWithClaude(imageBase64, imageUrl, metadata) {
  const { title, genre, audience } = metadata;

  const prompt = `You are CoverWise™, an expert AI book cover analyst for self-publishers. Analyze this book cover image and return ONLY a JSON object (no markdown, no explanation).

Book details provided by the author:
- Title: ${title || "Unknown"}
- Genre: ${genre || "Unknown"}  
- Target Audience: ${audience || "General"}

Analyze the cover and return this exact JSON structure:
{
  "overallScore": <number 0-100>,
  "verdict": "<one of: Poor | Weak | Decent | Good | Excellent>",
  "dimensions": {
    "genreMatch": <number 0-100>,
    "thumbnailClarity": <number 0-100>,
    "readability": <number 0-100>,
    "clickPotential": <number 0-100>,
    "professionalDesign": <number 0-100>,
    "emotionalImpact": <number 0-100>
  },
  "thumbnailTest": {
    "titleVisible": <true|false>,
    "subtitleVisible": <true|false>,
    "imageRecognizable": <true|false>,
    "authorVisible": <true|false>,
    "mobileReady": <true|false>
  },
  "suggestions": [
    { "type": "<warn|ok|critical>", "text": "<actionable suggestion under 15 words>" },
    { "type": "<warn|ok|critical>", "text": "<actionable suggestion under 15 words>" },
    { "type": "<warn|ok|critical>", "text": "<actionable suggestion under 15 words>" },
    { "type": "<warn|ok|critical>", "text": "<actionable suggestion under 15 words>" }
  ],
  "genreExpectations": {
    "detected": "<detected or inferred genre>",
    "colorPaletteFit": "<Strong|Moderate|Weak>",
    "typographyFit": "<Strong|Moderate|Weak>",
    "imageryFit": "<Strong|Moderate|Weak>"
  },
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"]
}`;

  const messages = imageBase64
    ? [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
        { type: "text", text: prompt }
      ]}]
    : [{ role: "user", content: prompt + `\n\nNote: No image was provided. Generate a realistic sample analysis for demonstration.` }];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.content?.map(b => b.text || "").join("") || "";

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    throw new Error("Could not parse AI response");
  }
}
