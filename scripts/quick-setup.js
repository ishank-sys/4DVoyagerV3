/**
 * Quick Setup Script for GCS Configuration
 * 
 * This interactive script helps you configure all GCS-related files
 * with your bucket information in one go.
 * 
 * Usage: node scripts/quick-setup.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   GCS Quick Setup Configuration        ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log('This script will update all configuration files with your GCS bucket info.\n');

  // Get bucket name
  const bucketName = await question('Enter your GCS bucket name: ');
  
  if (!bucketName || bucketName.trim() === '') {
    console.error('\n❌ Bucket name is required!');
    rl.close();
    process.exit(1);
  }

  const trimmedBucketName = bucketName.trim();
  const bucketUrl = `https://storage.googleapis.com/${trimmedBucketName}`;

  console.log('\n📝 Configuration Summary:');
  console.log('─'.repeat(50));
  console.log(`Bucket Name: ${trimmedBucketName}`);
  console.log(`Bucket URL:  ${bucketUrl}`);
  console.log('─'.repeat(50));

  const confirm = await question('\nProceed with this configuration? (y/n): ');
  
  if (confirm.toLowerCase() !== 'y') {
    console.log('\n❌ Setup cancelled.');
    rl.close();
    process.exit(0);
  }

  console.log('\n🔧 Updating configuration files...\n');

  let successCount = 0;
  let failCount = 0;

  // Update upload-to-gcs.js
  try {
    const uploadScriptPath = path.join(__dirname, 'upload-to-gcs.js');
    let content = fs.readFileSync(uploadScriptPath, 'utf8');
    content = content.replace(
      /const BUCKET_NAME = ['"].*?['"]/,
      `const BUCKET_NAME = '${trimmedBucketName}'`
    );
    fs.writeFileSync(uploadScriptPath, content, 'utf8');
    console.log('✓ Updated scripts/upload-to-gcs.js');
    successCount++;
  } catch (error) {
    console.error('✗ Failed to update upload-to-gcs.js:', error.message);
    failCount++;
  }

  // Update update-models-json.js
  try {
    const updateScriptPath = path.join(__dirname, 'update-models-json.js');
    let content = fs.readFileSync(updateScriptPath, 'utf8');
    content = content.replace(
      /const GCS_BUCKET_URL = ['"].*?['"]/,
      `const GCS_BUCKET_URL = '${bucketUrl}'`
    );
    fs.writeFileSync(updateScriptPath, content, 'utf8');
    console.log('✓ Updated scripts/update-models-json.js');
    successCount++;
  } catch (error) {
    console.error('✗ Failed to update update-models-json.js:', error.message);
    failCount++;
  }

  // Update enable-cors.js
  try {
    const corsScriptPath = path.join(__dirname, 'enable-cors.js');
    let content = fs.readFileSync(corsScriptPath, 'utf8');
    content = content.replace(
      /const BUCKET_NAME = ['"].*?['"]/,
      `const BUCKET_NAME = '${trimmedBucketName}'`
    );
    fs.writeFileSync(corsScriptPath, content, 'utf8');
    console.log('✓ Updated scripts/enable-cors.js');
    successCount++;
  } catch (error) {
    console.error('✗ Failed to update enable-cors.js:', error.message);
    failCount++;
  }

  // Update vercel.json
  try {
    const vercelJsonPath = path.join(__dirname, '..', 'vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    
    if (!vercelConfig.env) {
      vercelConfig.env = {};
    }
    
    vercelConfig.env.GCS_BUCKET_URL = bucketUrl;
    vercelConfig.env.GCS_BUCKET_NAME = trimmedBucketName;
    
    fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelConfig, null, 2), 'utf8');
    console.log('✓ Updated vercel.json');
    successCount++;
  } catch (error) {
    console.error('✗ Failed to update vercel.json:', error.message);
    failCount++;
  }

  // Summary
  console.log('\n════════════════════════════════════════');
  console.log('              SUMMARY                    ');
  console.log('════════════════════════════════════════');
  console.log(`✓ Successfully updated: ${successCount} files`);
  if (failCount > 0) {
    console.log(`✗ Failed:              ${failCount} files`);
  }
  console.log('════════════════════════════════════════\n');

  if (successCount > 0) {
    console.log('✅ Configuration complete!\n');
    console.log('Next steps:');
    console.log('1. Set up authentication:');
    console.log('   - Option A: $env:GOOGLE_APPLICATION_CREDENTIALS="path\\to\\key.json"');
    console.log('   - Option B: gcloud auth application-default login');
    console.log('');
    console.log('2. Upload files:');
    console.log('   node scripts/upload-to-gcs.js');
    console.log('');
    console.log('3. Update models.json:');
    console.log('   node scripts/update-models-json.js');
    console.log('');
    console.log('4. Enable CORS:');
    console.log('   node scripts/enable-cors.js');
    console.log('');
    console.log('See GCS_SETUP_GUIDE.md for detailed instructions.');
  }

  rl.close();
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  rl.close();
  process.exit(1);
});
