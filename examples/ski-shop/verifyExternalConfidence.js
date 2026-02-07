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
  const dynamicDir = path.join(
    __dirname,
    'public/components/dynamicHome',
    hash
  );
  const defaultFilePath = path.join(__dirname, 'public/components/homePage.js');

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
5. Provide a confidence score (High/Medium/Low) and a brief justification for the file in the form of a JSON object like this so it can be programatically accessed:
{
  "${fileName}": { 
    "confidence": "High",
    "justification": "The component renders correctly, maintains all core functionalities, and the personalization is consistent with the client's profile."
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

export default verifyExternalConfidence;
