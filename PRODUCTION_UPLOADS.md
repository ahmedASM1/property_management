# Production uploads (receipts, profile picture, contracts)

If uploads work locally but fail in production, check:

1. **Environment variables**  
   Ensure your production env (e.g. Vercel) has:
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (e.g. `your-project.appspot.com`)

2. **Firebase Storage CORS**  
   The browser sends requests to your Storage bucket. If your app domain is not allowed, uploads can fail. In **Google Cloud Console** → **Cloud Storage** → your bucket → **Permissions** / **CORS**, add a CORS configuration. You can use `storage-cors-example.json` in this repo as a reference (replace `"origin": ["*"]` with your app URL in production if you want to restrict origins).

3. **Storage rules**  
   `storage.rules` allow read/write for authenticated users. Deploy them with:
   ```bash
   firebase deploy --only storage
   ```

4. **Firestore rules**  
   Deploy with:
   ```bash
   firebase deploy --only firestore:rules
   ```
