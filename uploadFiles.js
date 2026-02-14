const { GoogleAIFileManager } = require('@google/generative-ai/server');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize with your API Key
const apiKey = process.env.GEMINI_API_KEY;
const fileManager = new GoogleAIFileManager(apiKey);

/**
 * Uploads all files from a specific directory to the Gemini File API.
 * @param {string} directoryPath - The relative or absolute path to the directory.
 * @returns {Promise<Array>} - An array of uploaded file objects.
 */
async function uploadDirectory(directoryPath) {
  try {
    // 1. Read all files in the directory
    const files = fs.readdirSync(directoryPath);

    // Filter out hidden files (like .DS_Store or .git)
    const validFiles = files.filter((file) => !file.startsWith('.'));

    console.log(
      `Found ${validFiles.length} files in ${directoryPath}. Starting upload...`
    );

    // 2. Map files to upload promises
    const uploadPromises = validFiles.map(async (fileName) => {
      const filePath = path.join(directoryPath, fileName);
      const mimeType = getMimeType(filePath);

      // Skip files if we can't determine the MIME type
      if (!mimeType) {
        console.warn(`Skipping ${fileName}: Unknown MIME type.`);
        return null;
      }

      console.log(`Uploading: ${fileName} (${mimeType})...`);

      try {
        const uploadResponse = await fileManager.uploadFile(filePath, {
          mimeType: mimeType,
          displayName: fileName, // Helps you identify the file in the prompt later
        });

        console.log(`✅ Uploaded ${fileName} -> ${uploadResponse.file.uri}`);
        return uploadResponse.file;
      } catch (err) {
        console.error(`❌ Failed to upload ${fileName}:`, err.message);
        return null;
      }
    });

    // 3. Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);

    // Filter out any nulls from failed uploads
    const successfulUploads = results.filter((r) => r !== null);

    console.log(`\n--- Batch Upload Complete ---`);
    console.log(
      `Successfully uploaded: ${successfulUploads.length}/${validFiles.length}`
    );

    return successfulUploads;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
}

/**
 * Helper to map extensions to MIME types accepted by Gemini.
 * You can expand this list based on your needs.
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    // Code
    '.js': 'text/javascript',
    '.py': 'text/x-python',
    '.html': 'text/html',
    '.css': 'text/css',
    '.json': 'application/json',
    '.ts': 'text/typescript',
    '.md': 'text/md',
    // Documents
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    // Images
    '.png': 'image/png',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] || null;
}

// --- usage example ---

// Run this only if executed directly
if (require.main === module) {
  // Replace './my-codebase' with your actual folder path
  const folderToUpload = './my_code_files';

  uploadDirectory(folderToUpload).then((uploadedFiles) => {
    // Example of how to use these files immediately in a prompt
    if (uploadedFiles.length > 0) {
      console.log('\nReady to use in generateContent. Example file URIs:');
      console.log(uploadedFiles.map((f) => f.uri));
    }
  });
}

module.exports = { uploadDirectory };
