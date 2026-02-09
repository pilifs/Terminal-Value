import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageCodeForLlm = async () => {
  const rootDir = __dirname;

  // The final destination folder
  const destDirName = 'tmp-llm-input';
  const finalDestPath = path.join(rootDir, destDirName);

  // A temporary staging folder to ensure atomic operations (non-destructive failure)
  const tempDirName = `${destDirName}-staging`;
  const tempDestPath = path.join(rootDir, tempDirName);

  // Clean up any leftover staging folder from previous failed runs
  if (fs.existsSync(tempDestPath)) {
    await fs.promises.rm(tempDestPath, { recursive: true, force: true });
  }

  // Create the staging folder
  await fs.promises.mkdir(tempDestPath);

  console.log(`Packaging project...`);
  console.log(`Source:  ${rootDir}`);
  console.log(`Staging: ${tempDestPath}`);

  // Define exclusion logic
  const isExcluded = (name, fullPath) => {
    // 1. Strict Name Exclusions (Files or Directories)
    const excludes = new Set([
      '.env',
      '.gitattributes',
      '.gitignore',
      '.prettierignore',
      '.prettierrc',
      '.vscode',
      'node_modules',
      '.git',
      '.DS_Store',
      destDirName, // Exclude the final output folder itself
      tempDirName, // Exclude the staging folder itself
    ]);

    if (excludes.has(name)) return true;

    // 2. Path Pattern Exclusions
    // Exclude gemini-batch/local-inputs/
    if (fullPath.includes(path.join('gemini-batch', 'local-inputs')))
      return true;

    return false;
  };

  try {
    // Read the root directory contents
    const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });

    // Loop through top-level items individually to avoid "copying root into subdirectory of root" error
    for (const entry of entries) {
      const entryName = entry.name;
      const srcPath = path.join(rootDir, entryName);
      const destPath = path.join(tempDestPath, entryName);

      // Check top-level exclusions
      if (isExcluded(entryName, srcPath)) {
        continue;
      }

      // Recursively copy valid items
      await fs.promises.cp(srcPath, destPath, {
        recursive: true,
        // The filter here handles exclusions deep inside subdirectories (like nested .env files)
        filter: (source, destination) => {
          const basename = path.basename(source);

          // Re-apply exclusion logic for nested files
          if (basename === '.env') return false;
          if (basename === '.vscode') return false;
          if (basename === 'node_modules') return false;
          if (
            source.includes(path.join('gemini-batch', 'local-inputs', 'blog'))
          )
            return false;

          return true;
        },
      });
    }

    // --- SUCCESS: ATOMIC SWAP ---
    console.log('Copy complete. Swapping folders...');

    // 1. Remove the old destination folder if it exists
    if (fs.existsSync(finalDestPath)) {
      await fs.promises.rm(finalDestPath, { recursive: true, force: true });
    }

    // 2. Rename staging to final destination
    await fs.promises.rename(tempDestPath, finalDestPath);

    console.log(`Success! Project packaged to: ${finalDestPath}`);
  } catch (err) {
    console.error('❌ Error packaging code:', err);
    console.log('Existing output folder was NOT modified.');

    // Cleanup the staging folder so we don't leave junk
    try {
      await fs.promises.rm(tempDestPath, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error('Warning: Failed to cleanup staging folder:', cleanupErr);
    }

    process.exit(1);
  }
};

// Execute
packageCodeForLlm();

export { packageCodeForLlm };
