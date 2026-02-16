# Quick Fix for Production CORS Issues

## The Problem
You're seeing CORS errors when trying to generate contracts in production. The error shows `waeliweb.appspot.com` bucket.

## Two Issues to Fix

### Issue 1: Deploy Updated Code
The code has been updated with API fallback mechanisms, but **it needs to be deployed to production**.

**Action:** Deploy your code changes to production (Vercel/Netlify/etc.)

### Issue 2: Configure CORS on `waeliweb.appspot.com` Bucket

The error shows `waeliweb.appspot.com`, but we configured CORS for `waeliweb.firebasestorage.app`. These might be the same bucket or different buckets.

**Action:** Configure CORS on `waeliweb.appspot.com` bucket:

1. Go to Google Cloud Console → Cloud Storage → Buckets
2. Find and click on `waeliweb.appspot.com` bucket
3. Go to **Configuration** tab
4. Scroll to **Cross-origin resource sharing (CORS)**
5. Click **Edit CORS configuration**
6. Add this configuration:

```
Origins: http://localhost:3000, https://www.greenbridge-my.com, https://greenbridge-my.com
Methods: GET, PUT, POST, DELETE, HEAD (all checked)
Response headers: Content-Type, Content-Length, Content-Disposition, Authorization
Cache expiry: 3600
```

7. Click **Save**

## After Both Fixes

1. **Deploy code** - Uploads will work via API fallback even if CORS isn't fully propagated
2. **Configure CORS** - Direct Firebase Storage uploads will work after CORS propagates (5-60 minutes)

## Verify It's Working

After deploying and configuring CORS:
1. Try generating a contract
2. Check browser console - CORS errors should be gone
3. Contract should save successfully
