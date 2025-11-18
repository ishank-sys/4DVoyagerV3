/**
 * Generate Signed URLs for GLB files
 * 
 * This script generates temporary signed URLs for all GLB files in your GCS bucket.
 * These URLs are valid for a specified duration and work even with private buckets.
 * 
 * Usage: node scripts/generate-signed-urls.js
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// ============= CONFIGURATION =============
const BUCKET_NAME = '4dvoyager';
const PROJECT_FOLDERS = ['1', 'BSGS', 'CUP', 'LORRY', 'WRC'];
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// URL validity: 7 days (in seconds)
const URL_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

// Path to service account key (relative to project root)
const SERVICE_ACCOUNT_KEY = process.env.GCS_SERVICE_ACCOUNT_KEY || path.join(__dirname, '..', 'service-account-key.json');

// Initialize GCS client with service account
let storage;
let bucket;

try {
  if (fs.existsSync(SERVICE_ACCOUNT_KEY)) {
    // Use service account key file
    storage = new Storage({
      keyFilename: SERVICE_ACCOUNT_KEY
    });
    console.log('✓ Using service account credentials');
  } else {
    // Fallback to Application Default Credentials
    console.log('⚠️  Service account key not found. Using Application Default Credentials.');
    console.log('   Note: ADC may not support signed URL generation.');
    console.log('   Please create a service account key file: service-account-key.json\n');
    storage = new Storage();
  }
  bucket = storage.bucket(BUCKET_NAME);
} catch (error) {
  console.error('❌ Error initializing Google Cloud Storage:', error.message);
  process.exit(1);
}

/**
 * Generate signed URL for a file
 */
async function generateSignedUrl(filePath) {
  try {
    const file = bucket.file(filePath);
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + (URL_EXPIRATION_SECONDS * 1000),
    });
    
    return url;
  } catch (error) {
    console.error(`Error generating signed URL for ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Get all GLB files from models.json
 */
function getModelsFromJson(projectFolder) {
  const modelsJsonPath = path.join(PUBLIC_DIR, projectFolder, 'models.json');
  
  if (!fs.existsSync(modelsJsonPath)) {
    return [];
  }
  
  try {
    const content = fs.readFileSync(modelsJsonPath, 'utf8');
    const models = JSON.parse(content);
    
    if (!Array.isArray(models)) {
      return [];
    }
    
    // Extract just filenames (remove any existing URLs)
    return models.map(model => {
      if (typeof model === 'string') {
        return path.basename(model);
      }
      return model;
    });
  } catch (error) {
    console.error(`Error reading ${modelsJsonPath}:`, error.message);
    return [];
  }
}

/**
 * Generate signed URLs for all models
 */
async function generateAllSignedUrls() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Generate Signed URLs for GLB Files  ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`URL Validity: ${URL_EXPIRATION_SECONDS / 86400} days\n`);
  
  const signedUrlsMap = {};
  let totalFiles = 0;
  let successCount = 0;
  let failCount = 0;
  
  for (const folder of PROJECT_FOLDERS) {
    console.log(`\n📁 Processing: ${folder}`);
    console.log('─'.repeat(50));
    
    const models = getModelsFromJson(folder);
    
    if (models.length === 0) {
      console.log(`   No models found in ${folder}/models.json`);
      continue;
    }
    
    console.log(`   Found ${models.length} models`);
    signedUrlsMap[folder] = [];
    totalFiles += models.length;
    
    for (const modelFile of models) {
      const gcsPath = `${folder}/${modelFile}`;
      const signedUrl = await generateSignedUrl(gcsPath);
      
      if (signedUrl) {
        signedUrlsMap[folder].push(signedUrl);
        console.log(`   ✓ ${modelFile}`);
        successCount++;
      } else {
        signedUrlsMap[folder].push(null);
        console.log(`   ✗ ${modelFile} - Failed`);
        failCount++;
      }
    }
  }
  
  // Save signed URLs to JSON file
  const outputPath = path.join(PUBLIC_DIR, 'signed-urls.json');
  const expiresAt = new Date(Date.now() + (URL_EXPIRATION_SECONDS * 1000)).toISOString();
  
  const output = {
    generatedAt: new Date().toISOString(),
    expiresAt: expiresAt,
    validityDays: URL_EXPIRATION_SECONDS / 86400,
    urls: signedUrlsMap
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  
  // Summary
  console.log('\n════════════════════════════════════════');
  console.log('              SUMMARY                    ');
  console.log('════════════════════════════════════════');
  console.log(`Total files:      ${totalFiles}`);
  console.log(`✓ Successful:     ${successCount}`);
  console.log(`✗ Failed:         ${failCount}`);
  console.log('════════════════════════════════════════');
  console.log(`\n✅ Signed URLs saved to: public/signed-urls.json`);
  console.log(`📅 URLs expire on: ${expiresAt}`);
  console.log(`\n⚠️  Remember to regenerate URLs before they expire!`);
  console.log(`   Run this script again in ~6 days.\n`);
  
  if (failCount > 0) {
    console.log('⚠️  Some URLs failed to generate. Check errors above.');
    process.exit(1);
  }
}

// Run the script
generateAllSignedUrls().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
