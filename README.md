This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 1) Environment variables (.env.local)

Create a `.env.local` in the project root with your Firebase Web config and optional integrations:

```bash
# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

# AI (Groq)
NEXT_PUBLIC_GROQ_API_KEY=YOUR_GROQ_API_KEY
```

Notes:
- In production, the app will fail fast if any Firebase vars are missing.
- In development, missing vars will log a warning and use safe fallbacks so you can boot locally.

### 2) Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Firebase Setup Tips

- Enable Email/Password in Firebase Console > Authentication.
- Ensure a user document exists at `users/{uid}` after registration.
- For admin access, set the user's Firestore doc `role` to `admin` and `isApproved` to `true`. Sign out/in to refresh.
- Firestore rules are configured to allow user creation and check admin via custom claims or Firestore `role`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
