# 4DVoyager - GCS Setup with Signed URLs

## 🔒 Private Bucket with Signed URLs

This setup uses **temporary signed URLs** to load GLB files from a **private GCS bucket**. This works even with organization policies that restrict public access.

### How It Works:

1. Bucket remains **private** (no public access needed)
2. Script generates **signed URLs** valid for 7 days
3. Your app loads models using these temporary URLs
4. Regenerate URLs before they expire

---

## 🚀 Complete Setup Steps

### Step 1: Authenticate with GCP

```powershell
# Login with browser popup
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable application credentials (for scripts)
gcloud auth application-default login
```

### Step 2: Keep Bucket Private (SKIP making it public)

```powershell
# DO NOT RUN: gsutil iam ch allUsers:objectViewer gs://4dvoyager
# Bucket should remain PRIVATE
```

### Step 3: Generate Signed URLs

```powershell
# Generate signed URLs for all GLB files (valid for 7 days)
npm run gcs:generate-urls
```

This creates `public/signed-urls.json` with temporary URLs for all models.

### Step 4: Test Locally

```powershell
npm run dev
```

Open browser and test:

- http://localhost:5173/viewer.html?project=BSGS
- http://localhost:5173/viewer.html?project=LORRY
- Check console for errors

### Step 5: Deploy

```powershell
git add .
git commit -m "Setup signed URLs for private GCS bucket"
git push
```

---

## 🔄 Important: Regenerate URLs Every 7 Days

Signed URLs expire after 7 days. Before they expire:

```powershell
# Regenerate URLs
npm run gcs:generate-urls

# Commit and deploy
git add public/signed-urls.json
git commit -m "Regenerate signed URLs"
git push
```

**Set a reminder to run this every 6 days!**

---

## 📝 Available Commands

```powershell
# Development
npm run dev              # Start dev server
npm run build            # Build for production

# GCS Setup
npm run gcs:generate-urls # Generate signed URLs (run every 7 days)
npm run gcs:verify       # Verify setup

# Other (if needed)
npm run gcs:setup        # Configure bucket name
npm run gcs:upload       # Upload files to GCS
```

---

## 🔍 Check URL Expiration

Open `public/signed-urls.json` to see when URLs expire:

```json
{
  "generatedAt": "2025-11-17T...",
  "expiresAt": "2025-11-24T...",
  "validityDays": 7,
  "urls": { ... }
}
```

---

## ✅ Benefits of Signed URLs

- ✅ **Private bucket** - No public access needed
- ✅ **Works with org policies** - Domain restrictions don't block it
- ✅ **Secure** - Only your generated URLs work
- ✅ **Temporary** - URLs expire automatically
- ✅ **No CORS issues** - Signed URLs bypass CORS

---

## ⚠️ Important Notes

1. **Regenerate before expiry**: Set calendar reminder for every 6 days
2. **Commit signed-urls.json**: Must be deployed with your app
3. **Keep credentials safe**: Never commit service account keys
4. **URL validity**: Default is 7 days (adjustable in script)

---

## 🆘 Troubleshooting

**Error: "signed-urls.json not found"**

```powershell
npm run gcs:generate-urls
```

**Error: "Signed URLs have expired"**

```powershell
npm run gcs:generate-urls
git add public/signed-urls.json
git commit -m "Regenerate signed URLs"
git push
```

**Error: "Authentication failed"**

```powershell
gcloud auth application-default login
```

**Check if files exist in bucket:**

```powershell
gsutil ls gs://4dvoyager/BSGS/
```

---

## 📁 File Structure

```
public/
├── signed-urls.json      ← Generated URLs (commit this!)
├── BSGS/models.json      ← Still used for file list
├── CUP/models.json
├── LORRY/models.json
├── WRC/models.json
└── 1/models.json

scripts/
└── generate-signed-urls.js ← Generates signed URLs
```

---

## 🔄 Automated URL Regeneration (Optional)

### Using GitHub Actions (Recommended)

Create `.github/workflows/regenerate-urls.yml`:

```yaml
name: Regenerate Signed URLs

on:
  schedule:
    - cron: "0 0 */6 * *" # Every 6 days
  workflow_dispatch: # Manual trigger

jobs:
  regenerate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm install

      - name: Setup GCP Auth
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Generate signed URLs
        run: npm run gcs:generate-urls

      - name: Commit and push
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add public/signed-urls.json
          git commit -m "Auto-regenerate signed URLs [skip ci]"
          git push
```

Add `GCP_SA_KEY` secret in GitHub repository settings.

---

## 🎯 Summary

**Your bucket is now PRIVATE** ✅

- No public access required
- Works with strict org policies
- Signed URLs provide temporary access
- Must regenerate every 7 days

**Quick reminder:**

```powershell
npm run gcs:generate-urls  # Every 6 days
git push                   # Deploy new URLs
```
