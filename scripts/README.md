# GCS Migration Scripts

This folder contains scripts to migrate your GLB files from local storage to Google Cloud Storage.

## 🚀 Quick Start (Easiest Method)

### Windows (PowerShell)

```powershell
.\scripts\migrate-to-gcs.ps1
```

This interactive script will guide you through:

1. Configuration
2. Authentication
3. File upload
4. Update models.json
5. Enable CORS
6. Make bucket public

### Manual Method

If you prefer to run each step manually:

```powershell
# 1. Configure (interactive)
node scripts/quick-setup.js

# 2. Upload files
node scripts/upload-to-gcs.js

# 3. Update models.json
node scripts/update-models-json.js

# 4. Enable CORS
node scripts/enable-cors.js
```

## 📁 Scripts Overview

### `migrate-to-gcs.ps1`

**Interactive PowerShell script** - Runs entire migration process

- Configures all files
- Handles authentication
- Uploads files
- Updates configuration
- Enables CORS
- Makes bucket public

### `quick-setup.js`

**Configuration helper** - Updates all config files with your bucket name

```powershell
node scripts/quick-setup.js
```

### `upload-to-gcs.js`

**Upload GLB files** - Uploads all GLB files from public/ folders to GCS

- Uploads: 1/, BSGS/, CUP/, LORRY/, WRC/
- Sets proper cache headers
- Shows progress
- Creates folder structure in GCS

**Before running:**

- Update `BUCKET_NAME` in the script
- Or run `quick-setup.js` first

```powershell
node scripts/upload-to-gcs.js
```

### `update-models-json.js`

**Update models.json** - Replaces local paths with GCS URLs

- Creates backup files (\*.backup.json)
- Updates all models.json files
- Can restore from backup

```powershell
# Update to GCS URLs
node scripts/update-models-json.js

# Restore from backup
node scripts/update-models-json.js --restore
```

### `enable-cors.js`

**Enable CORS** - Configures CORS on your GCS bucket

- Applies settings from cors.json
- Required for web access
- Verifies configuration

```powershell
node scripts/enable-cors.js
```

### `cors.json`

**CORS configuration** - CORS rules for GCS bucket

- Allows GET, HEAD, OPTIONS
- Allows all origins (\*)
- Sets proper headers

Used by `enable-cors.js` and can be used with gsutil:

```powershell
gsutil cors set scripts/cors.json gs://your-bucket-name
```

## 🔑 Authentication

### Option 1: Service Account (Recommended for CI/CD)

1. Create service account in GCP Console
2. Download JSON key
3. Set environment variable:
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\key.json"
   ```

### Option 2: gcloud CLI (Recommended for local development)

1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install
2. Authenticate:
   ```powershell
   gcloud auth application-default login
   ```

## 📊 What Gets Uploaded

```
From local:                    To GCS:
public/BSGS/*.glb     →       gs://bucket/BSGS/*.glb
public/CUP/*.glb      →       gs://bucket/CUP/*.glb
public/LORRY/*.glb    →       gs://bucket/LORRY/*.glb
public/WRC/*.glb      →       gs://bucket/WRC/*.glb
public/1/*.glb        →       gs://bucket/1/*.glb
```

## 🔄 models.json Transformation

**Before (local paths):**

```json
["BSGSifc.glb", "BSGSifc-1.glb"]
```

**After (GCS URLs):**

```json
[
  "https://storage.googleapis.com/your-bucket/BSGS/BSGSifc.glb",
  "https://storage.googleapis.com/your-bucket/BSGS/BSGSifc-1.glb"
]
```

## ⚠️ Important Notes

1. **Backups**: `update-models-json.js` creates backups before modifying files
2. **Reversible**: Use `--restore` flag to revert changes
3. **Public Access**: Bucket must be public for web access
4. **CORS Required**: Must enable CORS for browser access
5. **Cost**: Check GCS pricing - ~$18/month with CDN for typical usage

## 🧪 Testing

After migration:

```powershell
# Start dev server
npm run dev

# Test in browser
# http://localhost:5173/viewer.html?project=BSGS
# http://localhost:5173/viewer.html?project=LORRY
```

Check browser console for:

- ✅ No CORS errors
- ✅ Models loading from GCS
- ✅ Correct URLs being fetched

## 🔧 Troubleshooting

### Upload fails

```powershell
# Check authentication
gcloud auth application-default print-access-token

# Check bucket exists
gsutil ls gs://your-bucket-name

# Verify permissions
gsutil iam get gs://your-bucket-name
```

### CORS errors

```powershell
# Re-apply CORS
node scripts/enable-cors.js

# Or with gsutil
gsutil cors set scripts/cors.json gs://your-bucket-name

# Verify
gsutil cors get gs://your-bucket-name
```

### 403 Forbidden

```powershell
# Make bucket public
gsutil iam ch allUsers:objectViewer gs://your-bucket-name

# Or for specific files
gsutil -m acl ch -u AllUsers:R gs://your-bucket-name/**/*.glb
```

### Files not found

```powershell
# List files in bucket
gsutil ls gs://your-bucket-name/BSGS/

# Check specific file
gsutil stat gs://your-bucket-name/BSGS/BSGSifc.glb
```

## 📈 Performance Tips

1. **Enable Cloud CDN** (in GCP Console)

   - Reduces latency worldwide
   - Caches at edge locations
   - Lowers costs

2. **Cache Headers** (already set in upload script)

   - 1 year cache for GLB files
   - Reduces bandwidth costs

3. **Compression** (optional)
   ```powershell
   gsutil -m setmeta -h "Content-Encoding:gzip" gs://bucket/**/*.glb
   ```

## 📝 Script Configuration

Each script has configuration at the top:

```javascript
// upload-to-gcs.js
const BUCKET_NAME = "your-bucket-name-here";
const PROJECT_FOLDERS = ["1", "BSGS", "CUP", "LORRY", "WRC"];

// update-models-json.js
const GCS_BUCKET_URL = "https://storage.googleapis.com/your-bucket-name";
const PROJECT_FOLDERS = ["1", "BSGS", "CUP", "LORRY", "WRC"];

// enable-cors.js
const BUCKET_NAME = "your-bucket-name-here";
```

Use `quick-setup.js` to update all at once!

## 🆘 Support

For detailed information, see:

- `../GCS_SETUP_GUIDE.md` - Complete setup guide
- Google Cloud Storage docs: https://cloud.google.com/storage/docs
- Vercel deployment: https://vercel.com/docs

## ✅ Checklist

Before running scripts:

- [ ] GCS bucket created
- [ ] Service account with Storage Admin role
- [ ] Authentication configured
- [ ] `@google-cloud/storage` npm package installed
- [ ] Bucket name configured in scripts

After running scripts:

- [ ] Files uploaded to GCS
- [ ] models.json updated with GCS URLs
- [ ] CORS enabled
- [ ] Bucket made public
- [ ] Tested locally
- [ ] Environment variables set in Vercel
- [ ] Deployed and tested
