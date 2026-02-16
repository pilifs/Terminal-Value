import { db } from './db.js';
import { generateFinalDynamicViews } from './generateFinalDynamicViews.js';
import { extractViewsToFolder } from './fileUtils.js';

// 1. Process the raw DB data
const views = generateFinalDynamicViews(db);

// 2. Write to disk
extractViewsToFolder(views, './output');
