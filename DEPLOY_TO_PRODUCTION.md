# Deploy to Production (Vercel)

Your app uses Vercel. Here’s how to deploy the latest code so contract generation and profile saves work with the API fallback.

---

## Option 1: Deploy via Git (recommended)

If the project is connected to GitHub/GitLab/Bitbucket:

### 1. Commit and push your changes

In your project folder, run:

```bash
git add .
git commit -m "Fix: Add API fallback for uploads (contracts, profile, account)"
git push origin main
```

(Use your real branch name if it’s not `main`, e.g. `master`.)

### 2. Let Vercel deploy

- Vercel will detect the push and start a new deployment.
- Open the [Vercel Dashboard](https://vercel.com/dashboard), select the **greenbridge** (or waeli_web) project.
- Wait for the latest deployment to finish (status: **Ready**).

### 3. Check the deployment

- Open your production URL (e.g. `https://www.greenbridge-my.com`).
- Try generating a contract and saving a profile; they should use the API fallback when CORS blocks direct uploads.

---

## Option 2: Deploy with Vercel CLI

If you prefer to deploy from your machine without pushing to Git:

### 1. Install Vercel CLI (once)

```bash
npm i -g vercel
```

### 2. Log in (once)

```bash
vercel login
```

Follow the prompts in the browser to log in.

### 3. Deploy from project folder

```bash
cd c:\ApEven\greenbridge\greenbridge
vercel --prod
```

- `--prod` deploys to your **production** domain (e.g. greenbridge-my.com).
- First time: Vercel will ask to link this folder to a project; confirm and choose the right project if you have more than one.
- When the command finishes, it will print the production URL.

### 4. Test

Open the printed URL (or your custom domain) and test contract generation and profile save.

---

## Environment variables (important for API fallback)

For the upload API fallback to work in production, the **same** env vars must be set in Vercel:

1. **Vercel Dashboard** → Your project → **Settings** → **Environment Variables**.
2. Add (or update) for **Production**:

| Variable | Purpose |
|----------|--------|
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | e.g. `waeliweb.appspot.com` or `waeliweb.firebasestorage.app` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Full JSON string of your Firebase service account key (for server-side uploads) |

To get the service account key:

- Firebase Console → Project Settings → **Service accounts** → **Generate new private key**.
- Copy the whole JSON, then in Vercel create `FIREBASE_SERVICE_ACCOUNT_KEY` and paste the JSON as the value (one line is fine).

3. **Redeploy** after changing env vars: **Deployments** → latest deployment → **⋯** → **Redeploy**.

---

## Quick checklist

- [ ] Code committed and pushed (Option 1) or `vercel --prod` run (Option 2).
- [ ] Deployment finished and status is **Ready** in Vercel.
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` and `FIREBASE_SERVICE_ACCOUNT_KEY` set in Vercel for Production.
- [ ] Test: generate contract and save profile on production URL.

After this, the latest code (with API fallback) is live and uploads should work even when CORS blocks direct Firebase Storage access.
