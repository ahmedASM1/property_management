# Firebase Setup Guide

To properly configure Firebase for this application, you need to set up environment variables.

## Environment Variables Required

Create a `.env.local` file in the root directory with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Other environment variables
GROQ_API_KEY=your_groq_api_key_here
```

## How to Get Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Go to Project Settings (gear icon)
4. Scroll down to "Your apps" section
5. Click "Add app" and select Web app
6. Copy the configuration values to your `.env.local` file

## Demo Mode

If Firebase is not configured, the application will automatically use mock data for demonstration purposes. This allows you to test the application without setting up Firebase.

## Firestore Rules

Make sure your Firestore rules allow the necessary operations. The current rules are configured in `firestore.rules`.

## Testing

After setting up the environment variables:

1. Restart your development server
2. The application should now connect to Firebase
3. If there are still connection issues, check the browser console for specific error messages


