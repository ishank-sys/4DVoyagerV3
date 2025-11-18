# Service Account Setup for Signed URLs

To generate signed URLs, you need a Google Cloud service account with proper credentials.

## Steps to Create Service Account

### 1. Go to Google Cloud Console

Visit: https://console.cloud.google.com/

### 2. Select Your Project

Select: `veone-471008`

### 3. Navigate to Service Accounts

- Click on **☰ Menu** (top left)
- Go to **IAM & Admin** > **Service Accounts**

### 4. Create Service Account

- Click **+ CREATE SERVICE ACCOUNT**
- **Name**: `4dvoyager-signer`
- **Description**: Service account for generating signed URLs for 4DVoyager GLB files
- Click **CREATE AND CONTINUE**

### 5. Grant Permissions

Select role: **Storage Object Admin**

- Click **CONTINUE**
- Click **DONE**

### 6. Create and Download Key

- Click on the service account you just created
- Go to the **KEYS** tab
- Click **ADD KEY** > **Create new key**
- Select **JSON** format
- Click **CREATE**
- The JSON file will download automatically

### 7. Move Key to Project

- Rename the downloaded JSON file to: `service-account-key.json`
- Move it to your project root: `C:\Users\Aryan\Desktop\WORK\glbview\4DVoyager - GCP\service-account-key.json`

## Alternative: Use Environment Variable (for Vercel)

For production deployment on Vercel, you'll need to set the service account key as an environment variable:

1. Copy the **entire content** of `service-account-key.json`
2. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
3. Create new variable:
   - **Name**: `GCS_SERVICE_ACCOUNT_KEY_JSON`
   - **Value**: (paste the entire JSON content)
4. Save

Then update the script to read from environment variable in production.

## Security Notes

⚠️ **IMPORTANT**:

- **NEVER** commit `service-account-key.json` to Git
- The file is already added to `.gitignore`
- Keep this file secure - it grants access to your GCS bucket
- For production, use Vercel environment variables instead

## After Setup

Once you have the service account key in place, run:

```powershell
npm run gcs:generate-urls
```

This will generate signed URLs that work with your private bucket.
