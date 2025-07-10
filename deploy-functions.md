# Firebase Functions Deployment Guide

## Prerequisites
1. Make sure you have Firebase CLI installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Make sure you're in the correct project:
   ```bash
   firebase use your-project-id
   ```

## Deploy Functions

1. Navigate to the functions directory:
   ```bash
   cd functions
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Deploy the functions:
   ```bash
   npm run deploy
   ```

   Or from the root directory:
   ```bash
   firebase deploy --only functions
   ```

## Deploy Firestore Rules

From the root directory:
```bash
firebase deploy --only firestore:rules
```

## Deploy Storage Rules

From the root directory:
```bash
firebase deploy --only storage
```

## Set Up Admin User

1. First, create a regular user account through your app
2. Get the user's UID from Firebase Console or your app
3. Run the admin claim script:
   ```bash
   node setAdminClaim.js <USER_UID>
   ```

## Verify Deployment

1. Check Firebase Console > Functions to see your deployed functions
2. Check Firebase Console > Firestore > Rules to see your updated rules
3. Test the registration flow to ensure admin notifications are working

## Troubleshooting

### Common Issues:

1. **Functions not deploying**: Make sure you have the correct Node.js version (22)
2. **Permission errors**: Ensure your Firebase project has the necessary APIs enabled
3. **Admin claims not working**: Make sure you're using the correct UID and have proper permissions

### Enable Required APIs:
- Cloud Functions API
- Cloud Firestore API
- Firebase Authentication API

### Check Function Logs:
```bash
firebase functions:log
```

## Testing the System

1. Register a new user through your app
2. Check the admin dashboard for notifications
3. Approve/reject the user
4. Verify the user can/cannot log in based on approval status 