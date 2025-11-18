# GCS Migration - Complete Setup Script
# This script automates the entire GCS migration process

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   4DVoyager - GCS Migration Tool      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Configuration
Write-Host "Step 1: Configuration" -ForegroundColor Yellow
Write-Host "──────────────────────────────────────────" -ForegroundColor Gray
$bucketName = Read-Host "Enter your GCS bucket name"

if ([string]::IsNullOrWhiteSpace($bucketName)) {
    Write-Host "❌ Bucket name is required!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Bucket: $bucketName" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continue with this configuration? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "❌ Setup cancelled." -ForegroundColor Red
    exit 0
}

# Step 2: Update Configuration Files
Write-Host ""
Write-Host "Step 2: Updating configuration files..." -ForegroundColor Yellow
Write-Host "──────────────────────────────────────────" -ForegroundColor Gray

try {
    node scripts/quick-setup.js
    if ($LASTEXITCODE -ne 0) {
        throw "Configuration update failed"
    }
    Write-Host "✅ Configuration updated" -ForegroundColor Green
} catch {
    Write-Host "❌ Configuration failed: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Check Authentication
Write-Host ""
Write-Host "Step 3: Checking GCP authentication..." -ForegroundColor Yellow
Write-Host "──────────────────────────────────────────" -ForegroundColor Gray

if ($env:GOOGLE_APPLICATION_CREDENTIALS) {
    Write-Host "✓ Using service account: $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Green
} else {
    Write-Host "⚠️  No GOOGLE_APPLICATION_CREDENTIALS found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Choose authentication method:" -ForegroundColor Cyan
    Write-Host "  1. Service Account Key (recommended for automation)"
    Write-Host "  2. gcloud CLI (recommended for local development)"
    Write-Host "  3. Skip authentication check"
    Write-Host ""
    
    $authChoice = Read-Host "Enter choice (1-3)"
    
    switch ($authChoice) {
        "1" {
            Write-Host ""
            Write-Host "To use a service account:" -ForegroundColor Cyan
            Write-Host "1. Download your service account key JSON from GCP Console"
            Write-Host "2. Run: `$env:GOOGLE_APPLICATION_CREDENTIALS='C:\path\to\key.json'"
            Write-Host "3. Run this script again"
            Write-Host ""
            exit 0
        }
        "2" {
            Write-Host ""
            Write-Host "Attempting gcloud authentication..." -ForegroundColor Cyan
            gcloud auth application-default login
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ gcloud authentication failed" -ForegroundColor Red
                Write-Host "Install gcloud CLI: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
                exit 1
            }
            Write-Host "✅ Authenticated with gcloud" -ForegroundColor Green
        }
        "3" {
            Write-Host "⚠️  Skipping authentication check - upload may fail" -ForegroundColor Yellow
        }
        default {
            Write-Host "❌ Invalid choice" -ForegroundColor Red
            exit 1
        }
    }
}

# Step 4: Upload Files
Write-Host ""
Write-Host "Step 4: Upload GLB files to GCS..." -ForegroundColor Yellow
Write-Host "──────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""

$uploadConfirm = Read-Host "Start uploading files to GCS? This may take several minutes (y/n)"
if ($uploadConfirm -ne 'y') {
    Write-Host "⚠️  Skipping upload" -ForegroundColor Yellow
} else {
    try {
        node scripts/upload-to-gcs.js
        if ($LASTEXITCODE -ne 0) {
            throw "Upload failed"
        }
        Write-Host "✅ Files uploaded successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Upload failed: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "  • Check your bucket name is correct"
        Write-Host "  • Verify authentication is working"
        Write-Host "  • Ensure you have Storage Admin permissions"
        exit 1
    }
}

# Step 5: Update models.json
Write-Host ""
Write-Host "Step 5: Update models.json files..." -ForegroundColor Yellow
Write-Host "──────────────────────────────────────────" -ForegroundColor Gray

$modelsConfirm = Read-Host "Update models.json with GCS URLs? (y/n)"
if ($modelsConfirm -ne 'y') {
    Write-Host "⚠️  Skipping models.json update" -ForegroundColor Yellow
} else {
    try {
        node scripts/update-models-json.js
        if ($LASTEXITCODE -ne 0) {
            throw "Update failed"
        }
        Write-Host "✅ models.json files updated" -ForegroundColor Green
    } catch {
        Write-Host "❌ Update failed: $_" -ForegroundColor Red
        Write-Host "To restore: node scripts/update-models-json.js --restore" -ForegroundColor Yellow
        exit 1
    }
}

# Step 6: Enable CORS
Write-Host ""
Write-Host "Step 6: Enable CORS on GCS bucket..." -ForegroundColor Yellow
Write-Host "──────────────────────────────────────────" -ForegroundColor Gray

$corsConfirm = Read-Host "Enable CORS on bucket? (y/n)"
if ($corsConfirm -ne 'y') {
    Write-Host "⚠️  Skipping CORS setup" -ForegroundColor Yellow
} else {
    try {
        node scripts/enable-cors.js
        if ($LASTEXITCODE -ne 0) {
            throw "CORS setup failed"
        }
        Write-Host "✅ CORS enabled" -ForegroundColor Green
    } catch {
        Write-Host "❌ CORS setup failed: $_" -ForegroundColor Red
        Write-Host "You can enable CORS manually:" -ForegroundColor Yellow
        Write-Host "  gsutil cors set scripts/cors.json gs://$bucketName" -ForegroundColor Gray
    }
}

# Step 7: Make Bucket Public
Write-Host ""
Write-Host "Step 7: Make bucket publicly readable..." -ForegroundColor Yellow
Write-Host "──────────────────────────────────────────" -ForegroundColor Gray

$publicConfirm = Read-Host "Make bucket public? Required for web access (y/n)"
if ($publicConfirm -ne 'y') {
    Write-Host "⚠️  Bucket not made public - files won't be accessible" -ForegroundColor Yellow
} else {
    try {
        Write-Host "Making bucket public..." -ForegroundColor Cyan
        gsutil iam ch allUsers:objectViewer gs://$bucketName
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to make bucket public"
        }
        Write-Host "✅ Bucket is now publicly readable" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to make bucket public: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "You can make it public in GCP Console:" -ForegroundColor Yellow
        Write-Host "  1. Go to Cloud Storage > Buckets > $bucketName" -ForegroundColor Gray
        Write-Host "  2. Click Permissions tab" -ForegroundColor Gray
        Write-Host "  3. Grant 'Storage Object Viewer' to 'allUsers'" -ForegroundColor Gray
    }
}

# Final Summary
Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "         MIGRATION COMPLETE! 🎉         " -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Bucket:       $bucketName" -ForegroundColor White
Write-Host "  Bucket URL:   https://storage.googleapis.com/$bucketName" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Test locally: npm run dev" -ForegroundColor White
Write-Host "  2. Check browser console for any errors" -ForegroundColor White
Write-Host "  3. Visit: http://localhost:5173/viewer.html?project=BSGS" -ForegroundColor White
Write-Host "  4. If working, commit and deploy to Vercel" -ForegroundColor White
Write-Host ""
Write-Host "Vercel Environment Variables (add in dashboard):" -ForegroundColor Yellow
Write-Host "  GCS_BUCKET_URL  = https://storage.googleapis.com/$bucketName" -ForegroundColor Gray
Write-Host "  GCS_BUCKET_NAME = $bucketName" -ForegroundColor Gray
Write-Host ""
Write-Host "Optional Optimizations:" -ForegroundColor Yellow
Write-Host "  • Enable Cloud CDN for faster loading worldwide" -ForegroundColor White
Write-Host "  • Set up lifecycle rules for cost optimization" -ForegroundColor White
Write-Host "  • Monitor usage in GCP Console" -ForegroundColor White
Write-Host ""
Write-Host "Documentation: See GCS_SETUP_GUIDE.md for details" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
