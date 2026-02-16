// Comprehensive client map to enrich the raw DB views with CRM data
const clientDataMap = {
  'CLIENT-010': {
    nickname: 'The Ex-Pro',
    crmNotes: [
      'Former pro racer, extremely technical about edge tuning.',
      'Only skis on hardpack groomers.',
      'Prefers stiff boots and high DIN bindings.',
    ],
  },
  'CLIENT-008': {
    nickname: 'The Team Captain',
    crmNotes: [
      'Client has young family members that are into ski racing.',
      'Buys new gear every November for the kids.',
      'Often asks for bulk discounts or team deals.',
    ],
  },
  'CLIENT-002': {
    nickname: 'The Vail Voyager',
    crmNotes: [
      'Client is taking a big trip to Vail next month and needs to gear up.',
      'Previously complained about boots being too tight, needs wide fit.',
      'High income, value-conscious but willing to pay for durability.',
    ],
  },
  'CLIENT-016': {
    nickname: 'The Shutterbug',
    crmNotes: [
      'Adventure photographer, carries heavy camera gear.',
      'Needs rugged backpacks and stable skis.',
      'Often destroys gear quickly due to rough usage.',
    ],
  },
  'CLIENT-004': {
    nickname: 'The Trust Fund Flash',
    crmNotes: [
      'Client is a trust fund baby that must buy the latest gear.',
      'Impulse buyer, usually buys the most expensive item in the category.',
      'Loves flashy colors and branding.',
    ],
  },
  'CLIENT-018': {
    nickname: 'The Weekend Warrior',
    crmNotes: [
      'Weekend warrior from the city.',
      'Needs versatile gear for changing conditions.',
      'Usually rents high-performance demos before buying.',
    ],
  },
  'CLIENT-014': {
    nickname: 'The Lodge Legend',
    crmNotes: [
      'Retiree skiing 100+ days a year.',
      'Prioritizes comfort above all else.',
      'Loyal to the shop for 10 years, expects coffee when they walk in.',
    ],
  },
  'CLIENT-012': {
    nickname: 'The Remote Worker',
    crmNotes: [
      'Digital nomad, works from the lodge half the day.',
      'Needs gear that transitions well from slope to apres-ski.',
      'Interested in heated gloves and socks.',
    ],
  },
  'CLIENT-020': {
    nickname: 'The Strava Sprinter',
    crmNotes: [
      'Cross-country fitness enthusiast.',
      'Tracks every metric on Strava.',
      'Looking for the lightest possible nordic setup.',
    ],
  },
  'CLIENT-006': {
    nickname: 'The Backcountry Rookie',
    crmNotes: [
      'Client just got into backcountry skiing and is excited to buy new stuff.',
      'Attended an avalanche safety course last month.',
      'Asking about lightweight setups for long tours.',
    ],
  },
};

/**
 * Helper: Extracts class definitions from HTML content.
 * Looks for code between <script> tags if the model returned a full HTML file.
 */
function extractScriptFromHtml(htmlContent) {
  // Regex to find content inside <script> tags, specifically looking for class definitions
  const scriptMatch = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch && scriptMatch[1]) {
    return scriptMatch[1].trim();
  }
  // Fallback: If no script tag, check if the content itself looks like JS (contains class X extends Y)
  if (htmlContent.match(/class\s+\w+\s+extends\s+HTMLElement/)) {
    return htmlContent;
  }
  return null;
}

/**
 * Transforms a single raw DB record into a structured view payload.
 * Handles extracting code from:
 * 1. extractedFiles (JS or HTML)
 * 2. responseResult (Markdown blocks or XML file tags)
 * * @param {Object} viewData - The raw data object from the DB/LLM response.
 * @returns {Object|null} The formatted payload object, or null if invalid.
 */
function createViewPayload(viewData) {
  if (!viewData || !viewData.customId) return null;

  let sourceCode = null;

  // --- STRATEGY 1: Check Pre-Extracted Files ---
  if (viewData.extractedFiles && viewData.extractedFiles.length > 0) {
    // Priority 1a: Look for a dedicated JavaScript file
    const jsFile = viewData.extractedFiles.find(
      (f) => f.lang === 'javascript' || f.fileName.endsWith('.js')
    );
    if (jsFile) {
      sourceCode = jsFile.content;
    }
    // Priority 1b: Look for HTML file and extract the script
    else {
      const htmlFile = viewData.extractedFiles.find(
        (f) => f.lang === 'html' || f.fileName.endsWith('.html')
      );
      if (htmlFile) {
        sourceCode =
          extractScriptFromHtml(htmlFile.content) || htmlFile.content;
      }
    }
  }

  // --- STRATEGY 2: Parse Raw Response (Fallback) ---
  if (!sourceCode && viewData.responseResult) {
    const raw = viewData.responseResult;

    // Pattern A: XML-like tags <file name="index.html"> (Common in full file dumps)
    const xmlFilePattern = /<file name=["'](.*?)["']>([\s\S]*?)<\/file>/g;
    let match;
    while ((match = xmlFilePattern.exec(raw)) !== null) {
      const fileName = match[1];
      const content = match[2];

      // If we find a JS file or an HTML file containing our class, use it
      if (fileName.endsWith('.js')) {
        sourceCode = content.trim();
        break;
      } else if (
        fileName.endsWith('.html') &&
        content.includes('class BaseHomePage')
      ) {
        sourceCode = extractScriptFromHtml(content);
        if (sourceCode) break;
      }
    }

    // Pattern B: Standard Markdown Code Blocks (```javascript or ```html)
    if (!sourceCode) {
      const jsBlock = raw.match(/```(?:javascript|js)\s*([\s\S]*?)```/i);
      if (jsBlock && jsBlock[1]) {
        sourceCode = jsBlock[1].trim();
      } else {
        // Try finding HTML block containing the class
        const htmlBlock = raw.match(/```html\s*([\s\S]*?)```/i);
        if (
          htmlBlock &&
          htmlBlock[1] &&
          htmlBlock[1].includes('class BaseHomePage')
        ) {
          sourceCode = extractScriptFromHtml(htmlBlock[1]);
        }
      }
    }
  }

  // 4. Lookup Client Context
  const clientInfo = clientDataMap[viewData.customId] || {
    nickname: 'Unknown Client',
    crmNotes: [],
  };

  // 5. Clean up Strategy Text
  let strategyText = viewData.conversationalText;
  if (!strategyText && viewData.responseResult) {
    // Remove code blocks and file tags to leave only the text
    strategyText = viewData.responseResult
      .replace(/```[\s\S]*?```/g, '') // Remove markdown blocks
      .replace(/<file[\s\S]*?<\/file>/g, '') // Remove xml file blocks
      .trim();
  }

  return {
    metadata: {
      clientId: viewData.customId,
      nickname: clientInfo.nickname,
      crmNotes: clientInfo.crmNotes,
      pageType: viewData.pageType,
      model: viewData.modelId,
      fileHash: viewData.fileHash,
      promptId: viewData.promptId,
      generatedAt: new Date().toISOString(),
    },
    content: {
      code: sourceCode,
      strategy: strategyText,
    },
  };
}

/**
 * Generates the final map of dynamic web component views.
 * Uses a composite key of ClientID:PageType:FileHash to ensure uniqueness
 * across different model iterations.
 * * @param {Array} db - Array of raw LLM response objects.
 * @returns {Object} Map of processed views.
 */
export function generateFinalDynamicViews(db) {
  const finalViews = {};

  if (!Array.isArray(db)) {
    console.warn('generateFinalDynamicViews: dbExample is not an array.');
    return finalViews;
  }

  db.forEach((viewData) => {
    const payload = createViewPayload(viewData);

    if (payload && payload.content.code) {
      // Composite Key: ClientId:PageType:FileHash
      // Using FileHash allows multiple versions for the same client to exist simultaneously
      const compositeKey = `${viewData.customId}:${viewData.pageType}:${viewData.fileHash}`;
      finalViews[compositeKey] = payload;
    }
  });

  return finalViews;
}
