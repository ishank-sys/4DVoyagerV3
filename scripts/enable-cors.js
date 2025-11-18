/**
 * Enable CORS on Google Cloud Storage bucket
 * 
 * This script applies CORS configuration to your GCS bucket to allow
 * your web application to load GLB files from the bucket.
 * 
 * Prerequisites:
 * 1. Install: npm install @google-cloud/storage
 * 2. Set up GCP credentials (see upload-to-gcs.js for details)
 * 3. Update BUCKET_NAME below
 * 
 * Usage: node scripts/enable-cors.js
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// ============= CONFIGURATION =============
const BUCKET_NAME = 'your-bucket-name-here'; // TODO: Replace with your actual bucket name
const CORS_CONFIG_FILE = path.join(__dirname, 'cors.json');

// Initialize GCS client
const storage = new Storage();

/**
 * Apply CORS configuration to bucket
 */
async function enableCORS() {
  console.log('========================================');
  console.log('   Enable CORS on GCS Bucket            ');
  console.log('========================================\n');
  console.log(`Bucket: ${BUCKET_NAME}\n`);

  // Validate bucket name
  if (BUCKET_NAME === 'your-bucket-name-here') {
    console.error('❌ ERROR: Please update BUCKET_NAME in the script!');
    process.exit(1);
  }

  try {
    // Read CORS configuration
    const corsConfig = JSON.parse(fs.readFileSync(CORS_CONFIG_FILE, 'utf8'));
    console.log('📄 CORS Configuration:');
    console.log(JSON.stringify(corsConfig, null, 2));
    console.log('');

    // Get bucket
    const bucket = storage.bucket(BUCKET_NAME);

    // Check if bucket exists
    const [exists] = await bucket.exists();
    if (!exists) {
      console.error(`❌ ERROR: Bucket '${BUCKET_NAME}' does not exist!`);
      process.exit(1);
    }

    // Set CORS configuration
    console.log('⏳ Applying CORS configuration...');
    await bucket.setCorsConfiguration(corsConfig);
    
    console.log('✅ CORS configuration applied successfully!\n');

    // Verify CORS configuration
    console.log('🔍 Verifying CORS configuration...');
    const [metadata] = await bucket.getMetadata();
    
    if (metadata.cors && metadata.cors.length > 0) {
      console.log('✓ CORS is enabled');
      console.log('\nActive CORS rules:');
      console.log(JSON.stringify(metadata.cors, null, 2));
    } else {
      console.log('⚠️  Warning: Could not verify CORS configuration');
    }

    console.log('\n========================================');
    console.log('              SUMMARY                   ');
    console.log('========================================');
    console.log('✅ CORS enabled on bucket');
    console.log('✅ Your web app can now load GLB files');
    console.log('========================================\n');

    console.log('Next steps:');
    console.log('1. Make bucket publicly readable (optional):');
    console.log(`   gsutil iam ch allUsers:objectViewer gs://${BUCKET_NAME}`);
    console.log('2. Or use signed URLs for private access');
    console.log('3. Test your application');

  } catch (error) {
    console.error('\n❌ Error enabling CORS:', error.message);
    
    if (error.code === 'ENOENT') {
      console.error('   cors.json file not found!');
    } else if (error.code === 403) {
      console.error('   Permission denied. Check your GCP credentials.');
    }
    
    process.exit(1);
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the script
enableCORS().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
