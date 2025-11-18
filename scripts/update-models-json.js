/**
 * Update models.json files to use GCS URLs
 * 
 * This script updates all models.json files to reference GLB files from Google Cloud Storage
 * instead of local paths. It creates backup files before making changes.
 * 
 * Prerequisites:
 * 1. Files must already be uploaded to GCS (run upload-to-gcs.js first)
 * 2. Update GCS_BUCKET_URL below with your actual bucket URL
 * 
 * Usage: node scripts/update-models-json.js
 */

const fs = require('fs');
const path = require('path');

// ============= CONFIGURATION =============
const GCS_BUCKET_URL = 'https://storage.googleapis.com/your-bucket-name'; // TODO: Update this
const PROJECT_FOLDERS = ['1', 'BSGS', 'CUP', 'LORRY', 'WRC'];
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Update a single models.json file
 */
function updateModelsJson(projectFolder) {
  const modelsJsonPath = path.join(PUBLIC_DIR, projectFolder, 'models.json');
  
  if (!fs.existsSync(modelsJsonPath)) {
    console.log(`⚠️  Skipping ${projectFolder}: models.json not found`);
    return false;
  }

  try {
    // Read current models.json
    const content = fs.readFileSync(modelsJsonPath, 'utf8');
    const models = JSON.parse(content);

    if (!Array.isArray(models)) {
      console.error(`✗ ${projectFolder}: models.json is not an array`);
      return false;
    }

    // Create backup
    const backupPath = modelsJsonPath.replace('.json', '.backup.json');
    fs.writeFileSync(backupPath, content, 'utf8');
    console.log(`   Created backup: ${path.basename(backupPath)}`);

    // Update each model path to GCS URL
    const updatedModels = models.map(modelPath => {
      // If already a full URL, skip it
      if (modelPath.startsWith('http://') || modelPath.startsWith('https://')) {
        return modelPath;
      }

      // Extract just the filename
      const filename = path.basename(modelPath);
      
      // Return GCS URL
      return `${GCS_BUCKET_URL}/${projectFolder}/${filename}`;
    });

    // Write updated models.json
    fs.writeFileSync(
      modelsJsonPath,
      JSON.stringify(updatedModels, null, 2),
      'utf8'
    );

    console.log(`✓ Updated ${projectFolder}/models.json (${models.length} files)`);
    return true;

  } catch (error) {
    console.error(`✗ Error updating ${projectFolder}:`, error.message);
    return false;
  }
}

/**
 * Restore models.json from backup
 */
function restoreFromBackup(projectFolder) {
  const modelsJsonPath = path.join(PUBLIC_DIR, projectFolder, 'models.json');
  const backupPath = modelsJsonPath.replace('.json', '.backup.json');

  if (!fs.existsSync(backupPath)) {
    console.log(`   No backup found for ${projectFolder}`);
    return false;
  }

  fs.copyFileSync(backupPath, modelsJsonPath);
  console.log(`✓ Restored ${projectFolder}/models.json from backup`);
  return true;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const isRestore = args.includes('--restore');

  console.log('========================================');
  console.log('   Update models.json for GCS URLs      ');
  console.log('========================================\n');

  if (isRestore) {
    console.log('🔄 RESTORE MODE - Restoring from backups...\n');
    let restoreCount = 0;
    
    for (const folder of PROJECT_FOLDERS) {
      console.log(`📁 ${folder}`);
      if (restoreFromBackup(folder)) {
        restoreCount++;
      }
    }

    console.log(`\n✅ Restored ${restoreCount} files from backup`);
    return;
  }

  // Validate GCS URL
  if (GCS_BUCKET_URL === 'https://storage.googleapis.com/your-bucket-name') {
    console.error('❌ ERROR: Please update GCS_BUCKET_URL in the script!');
    console.error('   Example: https://storage.googleapis.com/my-project-glb-files');
    process.exit(1);
  }

  console.log(`GCS Base URL: ${GCS_BUCKET_URL}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const folder of PROJECT_FOLDERS) {
    console.log(`📁 Processing: ${folder}`);
    if (updateModelsJson(folder)) {
      successCount++;
    } else {
      failCount++;
    }
    console.log('');
  }

  // Summary
  console.log('========================================');
  console.log('              SUMMARY                   ');
  console.log('========================================');
  console.log(`✓ Successfully updated: ${successCount}`);
  console.log(`✗ Failed:              ${failCount}`);
  console.log('========================================\n');

  if (successCount > 0) {
    console.log('✅ models.json files updated successfully!');
    console.log('\n📝 Note: Backup files created with .backup.json extension');
    console.log('   To restore: node scripts/update-models-json.js --restore');
    console.log('\nNext steps:');
    console.log('1. Test your application locally');
    console.log('2. If working correctly, commit and deploy');
    console.log('3. If issues occur, run with --restore flag to revert');
  }
}

// Run the script
main();
