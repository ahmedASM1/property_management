# Firebase Storage CORS Configuration for Production

## Problem
When uploading files to Firebase Storage from production (e.g., `greenbridge-my.com`), you may encounter CORS errors:
```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' 
from origin 'https://www.greenbridge-my.com' has been blocked by CORS policy
```

## Solution
Configure CORS on your Firebase Storage bucket to allow requests from your production domain.

## Steps to Configure CORS

### Option 1: Using Google Cloud Console (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **Cloud Storage** → **Buckets**
4. Click on your storage bucket (usually `your-project-id.appspot.com`)
5. Click on the **Permissions** tab
6. Scroll down to **CORS configuration**
7. Click **Edit CORS configuration**
8. Add the following configuration:

```json
[
  {
    "origin": [
      "https://www.greenbridge-my.com",
      "https://greenbridge-my.com",
      "http://localhost:3000"
    ],
    "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "responseHeader": [
      "Content-Type",
      "Content-Length",
      "Content-Disposition",
      "Authorization"
    ],
    "maxAgeSeconds": 3600
  }
]
```

9. Click **Save**

### Option 2: Using gsutil Command Line Tool

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Authenticate: `gcloud auth login`
3. Create a CORS configuration file `cors.json`:

```json
[
  {
    "origin": [
      "https://www.greenbridge-my.com",
      "https://greenbridge-my.com",
      "http://localhost:3000"
    ],
    "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "responseHeader": [
      "Content-Type",
      "Content-Length",
      "Content-Disposition",
      "Authorization"
    ],
    "maxAgeSeconds": 3600
  }
]
```

4. Apply the CORS configuration:
```bash
gsutil cors set cors.json gs://your-bucket-name.appspot.com
```

### Option 3: Using Firebase Admin SDK (Programmatic)

If you have Firebase Admin SDK set up, you can configure CORS programmatically. However, this is more complex and the above methods are recommended.

## Verify CORS Configuration

After setting up CORS, verify it's working:

1. Open your browser's developer console
2. Try uploading a file
3. Check the Network tab - CORS errors should be gone
4. Files should upload successfully

## Fallback Solution

If CORS configuration is not possible or doesn't work immediately, the application includes fallback mechanisms:

1. **Server-side upload API**: The `/api/upload-contract` and `/api/upload-file` routes use Firebase Admin SDK server-side, which bypasses CORS restrictions
2. **Automatic fallback**: The client-side code automatically falls back to the API routes if direct Firebase Storage upload fails

## Important Notes

- CORS changes may take a few minutes to propagate
- Make sure to include both `www` and non-`www` versions of your domain
- Include `localhost:3000` for local development
- The `maxAgeSeconds` value controls how long browsers cache the CORS preflight response (3600 seconds = 1 hour)

## Troubleshooting

If CORS errors persist:

1. Clear your browser cache
2. Wait a few minutes for changes to propagate
3. Check that your domain matches exactly (including `www` prefix)
4. Verify the bucket name is correct
5. Check Firebase Storage security rules allow the operations
