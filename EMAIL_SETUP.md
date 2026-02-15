# Sending emails from your domain (Green Bridge)

Verification and password-reset emails use a shared design and can be sent **from your own domain** (e.g. `noreply@greenbridge-my.com`) once your provider and DNS are set up.

---

## Why am I still getting emails from Firebase (noreply@…firebaseapp.com)?

If you see **“Verify your email for …”** from **`noreply@….firebaseapp.com`** (and it goes to spam), the app is using **Firebase’s default email** because the **custom verification API** is failing or not configured. When the API returns an error, the app falls back to Firebase’s built-in sender.

To **switch to your own domain** and the designed Green Bridge emails, you need **all** of the following.

### Step 1: Firebase Admin SDK (required for verification API)

The verification API must verify the user’s token with Firebase Admin. Add to `.env.local`:

| Variable | Where to get it |
|----------|------------------|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console → Project Settings → General (already used by client). |
| `FIREBASE_CLIENT_EMAIL` | Firebase Console → Project Settings → **Service accounts** → **Generate new private key** → in the JSON: `client_email`. |
| `FIREBASE_PRIVATE_KEY` | Same JSON file: `private_key`. Copy the full value including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`. In `.env.local` you can wrap in quotes and keep `\n` as literal backslash-n, or use real newlines. |

Without these, the API cannot run and the app will keep using Firebase’s email.

### Step 2: One email provider (SendGrid, AWS SES, or SMTP)

Add **one** of these to `.env.local`:

- **SendGrid:** `SENDGRID_API_KEY=SG.xxx` (from SendGrid → API Keys).
- **AWS SES:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_REGION`.
- **SMTP:** `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`.

### Step 3: Send from your domain (recommended)

- `MAIL_FROM_EMAIL=noreply@greenbridge-my.com` (or your domain).
- `MAIL_FROM_NAME=Green Bridge`
- Verify your domain in SendGrid/SES/SMTP and add any DNS records they give you (SPF, DKIM) so mail from your domain is trusted and less likely to be marked spam.

After Step 1 and Step 2 (and optionally Step 3), **restart the dev server** and register again. The verification email should be the Green Bridge template and come from your address instead of Firebase.

---

## 1. Environment variables (one place for “from” and support)

Add these to `.env.local` (or your host’s env, e.g. Vercel). They are used by **all** providers (SendGrid, AWS SES, Nodemailer).

| Variable | Example | Purpose |
|----------|---------|--------|
| `MAIL_FROM_EMAIL` | `noreply@greenbridge-my.com` | “From” address (your domain). |
| `MAIL_FROM_NAME` | `Green Bridge` | “From” display name. |
| `MAIL_SUPPORT_EMAIL` | `info@greenbridge-my.com` | Shown in email footer and used as Reply-To where applicable. |
| `NEXT_PUBLIC_APP_URL` | `https://greenbridge-my.com` | Base URL for links in emails (verify, reset password). |

Provider-specific “from” (e.g. `SENDGRID_FROM_EMAIL`, `AWS_SES_FROM_EMAIL`, `SMTP_FROM_EMAIL`) are still supported; `MAIL_FROM_*` overrides them when set.

## 2. Sending from your domain

To have emails **show as from your domain** (e.g. `@greenbridge-my.com`) and land in inboxes reliably:

### Option A: SendGrid

1. In [SendGrid](https://sendgrid.com) go to **Settings → Sender Authentication**.
2. **Authenticate your domain** (e.g. `greenbridge-my.com`) and add the DNS records they give you (SPF, DKIM, etc.) at your DNS host.
3. Set in env:
   - `MAIL_FROM_EMAIL=noreply@greenbridge-my.com` (or another address on that domain).
   - `MAIL_FROM_NAME=Green Bridge`
   - `SENDGRID_API_KEY=...`

### Option B: AWS SES

1. In [AWS SES](https://console.aws.amazon.com/ses/) go to **Verified identities** and add your domain (e.g. `greenbridge-my.com`).
2. Add the DKIM (and optional SPF) records to your DNS.
3. (If the account is in sandbox) Request production access so you can send to any address.
4. Set in env:
   - `MAIL_FROM_EMAIL=noreply@greenbridge-my.com`
   - `MAIL_FROM_NAME=Green Bridge`
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_REGION`.

### Option C: SMTP (Nodemailer) with your host

If your host (e.g. your domain provider or a dedicated SMTP service) lets you send from `@greenbridge-my.com`:

1. Create an account/address like `noreply@greenbridge-my.com` and get SMTP host, port, user, and password.
2. Set in env:
   - `MAIL_FROM_EMAIL=noreply@greenbridge-my.com`
   - `MAIL_FROM_NAME=Green Bridge`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (and `SMTP_SECURE` if needed).

## 3. What uses these settings

- **Verification email** (after registration) and **password reset** use the shared templates in `src/lib/email-templates.ts`. They show Green Bridge branding and use `NEXT_PUBLIC_APP_URL` and `MAIL_SUPPORT_EMAIL` for links and footer.
- **Magic link / welcome** (set password) uses the template in `src/lib/email-sendgrid.ts` (same branding idea).
- All transactional sends (SendGrid, SES, Nodemailer) use `MAIL_FROM_EMAIL` and `MAIL_FROM_NAME` when set, so one config applies across the app.

## 4. Quick checklist

- [ ] Domain verified with your email provider (SendGrid / SES / SMTP host).
- [ ] DNS records (SPF, DKIM) added and propagated.
- [ ] `MAIL_FROM_EMAIL` and `MAIL_FROM_NAME` set to your domain and name.
- [ ] `NEXT_PUBLIC_APP_URL` set to your live app URL.
- [ ] `MAIL_SUPPORT_EMAIL` set for footer and replies (e.g. `info@greenbridge-my.com`).
- [ ] One of: `SENDGRID_API_KEY`, or AWS SES credentials, or `SMTP_USER` + `SMTP_PASS` configured.

After that, verification and password-reset emails will be well-designed and sent from your domain.
