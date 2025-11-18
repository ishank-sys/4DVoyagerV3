/**
 * Upload GLB files to Google Cloud Storage
 * 
 * Prerequisites:
 * 1. Install: npm install @google-cloud/storage
 * 2. Set up GCP credentials:
 *    - Option A: Set GOOGLE_APPLICATION_CREDENTIALS env variable to path of service account key JSON
 *    - Option B: Use gcloud CLI authentication: gcloud auth application-default login
 * 3. Update BUCKET_NAME below with your actual GCS bucket name
 * 
 * Usage: node scripts/upload-to-gcs.js
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// ============= CONFIGURATION =============
const BUCKET_NAME = 'your-bucket-name-here'; // TODO: Replace with your actual bucket name
const PROJECT_FOLDERS = ['1', 'BSGS', 'CUP', 'LORRY', 'WRC'];
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Initialize GCS client
const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

/**
 * Upload a single file to GCS
 */
async function uploadFile(localPath, gcsPath) {
  try {
    const options = {
      destination: gcsPath,
      metadata: {
        cacheControl: 'public, max-age=31536000', // Cache for 1 year (GLB files are immutable)
        contentType: 'model/gltf-binary',
      },
      resumable: false, // Faster for smaller files
    };

    await bucket.upload(localPath, options);
    console.log(`✓ Uploaded: ${gcsPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to upload ${gcsPath}:`, error.message);
    return false;
  }
}

/**
 * Get all GLB files in a project folder
 */
function getGLBFiles(projectFolder) {
  const folderPath = path.join(PUBLIC_DIR, projectFolder);
  const files = fs.readdirSync(folderPath);
  return files.filter(file => file.toLowerCase().endsWith('.glb'));
}

/**
 * Main upload function
 */
async function uploadAllFiles() {
  console.log('========================================');
  console.log('   GLB Upload to Google Cloud Storage   ');
  console.log('========================================\n');
  console.log(`Bucket: ${BUCKET_NAME}\n`);

  // Validate bucket name
  if (BUCKET_NAME === 'your-bucket-name-here') {
    console.error('❌ ERROR: Please update BUCKET_NAME in the script with your actual GCS bucket name!');
    process.exit(1);
  }

  let totalFiles = 0;
  let successCount = 0;
  let failCount = 0;

  for (const folder of PROJECT_FOLDERS) {
    console.log(`\n📁 Processing folder: ${folder}`);
    console.log('─'.repeat(50));

    const glbFiles = getGLBFiles(folder);
    
    if (glbFiles.length === 0) {
      console.log(`   No GLB files found in ${folder}`);
      continue;
    }

    console.log(`   Found ${glbFiles.length} GLB files`);
    totalFiles += glbFiles.length;

    for (const file of glbFiles) {
      const localPath = path.join(PUBLIC_DIR, folder, file);
      const gcsPath = `${folder}/${file}`;
      
      const success = await uploadFile(localPath, gcsPath);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('           UPLOAD SUMMARY               ');
  console.log('========================================');
  console.log(`Total files:      ${totalFiles}`);
  console.log(`✓ Successful:     ${successCount}`);
  console.log(`✗ Failed:         ${failCount}`);
  console.log('========================================\n');

  if (failCount > 0) {
    console.log('⚠️  Some files failed to upload. Check the errors above.');
    process.exit(1);
  } else {
    console.log('✅ All files uploaded successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: node scripts/update-models-json.js');
    console.log('2. Run: node scripts/enable-cors.js');
    console.log('3. Update vercel.json with GCS_BUCKET_URL');
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the upload
uploadAllFiles().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
