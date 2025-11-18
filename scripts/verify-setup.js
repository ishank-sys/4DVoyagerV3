/**
 * Verify GCS Migration Setup
 * 
 * This script checks if your GCS migration is properly configured
 * and provides a health check report.
 * 
 * Usage: node scripts/verify-setup.js
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PROJECT_FOLDERS = ['1', 'BSGS', 'CUP', 'LORRY', 'WRC'];

let bucketName = '';
let bucketUrl = '';

// Read bucket name from upload-to-gcs.js
function getBucketConfig() {
  try {
    const uploadScript = fs.readFileSync(path.join(__dirname, 'upload-to-gcs.js'), 'utf8');
    const match = uploadScript.match(/const BUCKET_NAME = ['"](.+?)['"]/);
    if (match && match[1] !== 'your-bucket-name-here') {
      bucketName = match[1];
      bucketUrl = `https://storage.googleapis.com/${bucketName}`;
      return true;
    }
  } catch (error) {
    console.error('Error reading bucket configuration:', error.message);
  }
  return false;
}

// Check if authentication is configured
function checkAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(keyPath)) {
      return { status: 'ok', method: 'Service Account', path: keyPath };
    } else {
      return { status: 'error', message: 'Key file not found at specified path' };
    }
  }
  
  // Check for gcloud CLI auth
  const homeDir = process.env.USERPROFILE || process.env.HOME;
  const gcloudPath = path.join(homeDir, '.config', 'gcloud', 'application_default_credentials.json');
  if (fs.existsSync(gcloudPath)) {
    return { status: 'ok', method: 'gcloud CLI', path: gcloudPath };
  }
  
  return { status: 'warning', message: 'No authentication configured' };
}

// Check if bucket exists and is accessible
async function checkBucket() {
  try {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const [exists] = await bucket.exists();
    
    if (!exists) {
      return { status: 'error', message: 'Bucket does not exist' };
    }
    
    const [metadata] = await bucket.getMetadata();
    return { 
      status: 'ok', 
      location: metadata.location,
      storageClass: metadata.storageClass 
    };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

// Check CORS configuration
async function checkCORS() {
  try {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const [metadata] = await bucket.getMetadata();
    
    if (metadata.cors && metadata.cors.length > 0) {
      return { status: 'ok', rules: metadata.cors.length };
    } else {
      return { status: 'warning', message: 'No CORS rules configured' };
    }
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

// Check if models.json files are updated with GCS URLs
function checkModelsJson() {
  const results = {};
  let allUpdated = true;
  
  for (const folder of PROJECT_FOLDERS) {
    const modelsPath = path.join(PUBLIC_DIR, folder, 'models.json');
    
    if (!fs.existsSync(modelsPath)) {
      results[folder] = { status: 'missing', message: 'models.json not found' };
      allUpdated = false;
      continue;
    }
    
    try {
      const content = fs.readFileSync(modelsPath, 'utf8');
      const models = JSON.parse(content);
      
      if (!Array.isArray(models) || models.length === 0) {
        results[folder] = { status: 'error', message: 'Empty or invalid' };
        allUpdated = false;
        continue;
      }
      
      const firstModel = models[0];
      if (firstModel.startsWith('http://') || firstModel.startsWith('https://')) {
        results[folder] = { status: 'ok', count: models.length, type: 'GCS URLs' };
      } else {
        results[folder] = { status: 'warning', count: models.length, type: 'Local paths' };
        allUpdated = false;
      }
    } catch (error) {
      results[folder] = { status: 'error', message: error.message };
      allUpdated = false;
    }
  }
  
  return { allUpdated, results };
}

// Check if a sample file is accessible
function checkFileAccess(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        resolve({ status: 'ok', statusCode: res.statusCode });
      } else if (res.statusCode === 403) {
        resolve({ status: 'error', message: 'Bucket not public (403 Forbidden)' });
      } else if (res.statusCode === 404) {
        resolve({ status: 'error', message: 'File not found (404)' });
      } else {
        resolve({ status: 'error', message: `HTTP ${res.statusCode}` });
      }
    }).on('error', (error) => {
      resolve({ status: 'error', message: error.message });
    });
  });
}

// Main verification function
async function verify() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   GCS Migration Setup Verification    ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  let issueCount = 0;
  let warningCount = 0;
  
  // 1. Check bucket configuration
  console.log('1️⃣  Bucket Configuration');
  console.log('─'.repeat(50));
  
  if (getBucketConfig()) {
    console.log(`✓ Bucket name: ${bucketName}`);
    console.log(`✓ Bucket URL:  ${bucketUrl}`);
  } else {
    console.log('✗ Bucket not configured');
    console.log('  Run: node scripts/quick-setup.js');
    issueCount++;
  }
  console.log('');
  
  // 2. Check authentication
  console.log('2️⃣  Authentication');
  console.log('─'.repeat(50));
  const auth = checkAuth();
  
  if (auth.status === 'ok') {
    console.log(`✓ Authenticated via: ${auth.method}`);
    console.log(`  Path: ${auth.path}`);
  } else if (auth.status === 'warning') {
    console.log(`⚠ ${auth.message}`);
    console.log('  Configure auth:');
    console.log('    • Service Account: $env:GOOGLE_APPLICATION_CREDENTIALS="path\\to\\key.json"');
    console.log('    • gcloud CLI: gcloud auth application-default login');
    warningCount++;
  } else {
    console.log(`✗ ${auth.message}`);
    issueCount++;
  }
  console.log('');
  
  if (!bucketName || bucketName === 'your-bucket-name-here') {
    console.log('\n⚠️  Skipping remaining checks - bucket not configured\n');
    printSummary(issueCount, warningCount);
    return;
  }
  
  // 3. Check bucket exists
  console.log('3️⃣  Bucket Accessibility');
  console.log('─'.repeat(50));
  const bucket = await checkBucket();
  
  if (bucket.status === 'ok') {
    console.log('✓ Bucket exists and is accessible');
    console.log(`  Location:      ${bucket.location}`);
    console.log(`  Storage Class: ${bucket.storageClass}`);
  } else {
    console.log(`✗ ${bucket.message}`);
    if (bucket.status === 'error') {
      issueCount++;
      console.log('\n⚠️  Cannot continue - bucket not accessible\n');
      printSummary(issueCount, warningCount);
      return;
    }
  }
  console.log('');
  
  // 4. Check CORS
  console.log('4️⃣  CORS Configuration');
  console.log('─'.repeat(50));
  const cors = await checkCORS();
  
  if (cors.status === 'ok') {
    console.log(`✓ CORS enabled (${cors.rules} rule(s))`);
  } else if (cors.status === 'warning') {
    console.log(`⚠ ${cors.message}`);
    console.log('  Run: node scripts/enable-cors.js');
    warningCount++;
  } else {
    console.log(`✗ ${cors.message}`);
    issueCount++;
  }
  console.log('');
  
  // 5. Check models.json files
  console.log('5️⃣  models.json Files');
  console.log('─'.repeat(50));
  const modelsCheck = checkModelsJson();
  
  for (const [folder, result] of Object.entries(modelsCheck.results)) {
    if (result.status === 'ok') {
      console.log(`✓ ${folder}: ${result.count} models (${result.type})`);
    } else if (result.status === 'warning') {
      console.log(`⚠ ${folder}: ${result.count} models (${result.type})`);
      warningCount++;
    } else if (result.status === 'missing') {
      console.log(`⚠ ${folder}: ${result.message}`);
      warningCount++;
    } else {
      console.log(`✗ ${folder}: ${result.message}`);
      issueCount++;
    }
  }
  
  if (!modelsCheck.allUpdated) {
    console.log('\n  💡 Tip: Run `node scripts/update-models-json.js` to update paths');
  }
  console.log('');
  
  // 6. Check file accessibility
  console.log('6️⃣  File Accessibility Test');
  console.log('─'.repeat(50));
  
  // Try to access a sample file from BSGS
  const sampleUrl = `${bucketUrl}/BSGS/BSGSifc.glb`;
  console.log(`Testing: ${sampleUrl}`);
  
  const access = await checkFileAccess(sampleUrl);
  
  if (access.status === 'ok') {
    console.log('✓ Files are publicly accessible');
  } else {
    console.log(`✗ ${access.message}`);
    if (access.message.includes('403')) {
      console.log('  Make bucket public: gsutil iam ch allUsers:objectViewer gs://' + bucketName);
    }
    issueCount++;
  }
  console.log('');
  
  // Print summary
  printSummary(issueCount, warningCount);
}

function printSummary(issueCount, warningCount) {
  console.log('════════════════════════════════════════');
  console.log('              SUMMARY                    ');
  console.log('════════════════════════════════════════');
  
  if (issueCount === 0 && warningCount === 0) {
    console.log('✅ All checks passed! Your setup is ready.');
    console.log('');
    console.log('Next steps:');
    console.log('  • Test locally: npm run dev');
    console.log('  • Deploy to Vercel');
    console.log('  • Add environment variables in Vercel dashboard');
  } else {
    if (issueCount > 0) {
      console.log(`❌ ${issueCount} issue(s) found - action required`);
    }
    if (warningCount > 0) {
      console.log(`⚠️  ${warningCount} warning(s) - optional improvements`);
    }
    console.log('');
    console.log('Fix issues above, then run verification again.');
  }
  
  console.log('════════════════════════════════════════\n');
}

// Run verification
verify().catch((error) => {
  console.error('\n❌ Verification failed:', error.message);
  process.exit(1);
});
