import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates a list of verification prompts, one for each generated client file.
 * @param {string} hash - The build hash (e.g., '0a4b6f...') used in the folder path.
 * @returns {Array<{hash: string, clientId: string, pageType: string, prompt: string}>} List of verification tasks.
 */
function verifyExternalConfidence(hash) {
  // 1. Resolve Paths
  // UPDATED: Adjusted path to ../apps/example-ski-shop
  const dynamicDir = path.join(
    __dirname,
    '../apps/example-ski-shop/public/components/dynamicHome',
    hash
  );
  // UPDATED: Adjusted path to ../apps/example-ski-shop
  const defaultFilePath = path.join(
    __dirname,
    '../apps/example-ski-shop/public/components/homePage.js'
  );

  // 2. Read Default Home Page
  let defaultContent = '';
  try {
    defaultContent = fs.readFileSync(defaultFilePath, 'utf-8');
  } catch (err) {
    console.error(`❌ Error reading default file at ${defaultFilePath}:`, err);
    return [];
  }

  // 3. Read All Generated Client Files for Hash
  let clientFiles = [];
  try {
    if (fs.existsSync(dynamicDir)) {
      clientFiles = fs
        .readdirSync(dynamicDir)
        .filter((file) => file.startsWith('homePage-') && file.endsWith('.js'));
    } else {
      console.error(`❌ Hash directory not found: ${dynamicDir}`);
      return [];
    }
  } catch (err) {
    console.error(`❌ Error reading dynamic files:`, err);
    return [];
  }

  if (clientFiles.length === 0) {
    console.warn(`⚠️ No 'homePage-*.js' files found in ${dynamicDir}`);
    return [];
  }

  // 4. Construct a prompt object for each file
  return clientFiles.map((fileName) => {
    // Extract Client ID (e.g. "homePage-CLIENT-002.js" -> "CLIENT-002")
    const clientId = fileName.replace('homePage-', '').replace('.js', '');
    const fileContent = fs.readFileSync(
      path.join(dynamicDir, fileName),
      'utf-8'
    );

    const prompt = `
TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
${defaultContent}
----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: ${fileName}
Content:
${fileContent}
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "${fileName}": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}
`.trim();

    return {
      hash,
      clientId,
      pageType: 'home',
      prompt,
    };
  });
}

const test = verifyExternalConfidence(
  '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a'
);

test;

export default verifyExternalConfidence;
