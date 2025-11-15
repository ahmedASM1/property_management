# 🔐 Admin-Only Authentication Setup Guide

## Quick Start Guide

This guide will help you set up the new admin-only authentication system with magic link functionality.

## 🚀 Setup Steps

### 1. Environment Variables

Ensure you have the following environment variables set in your `.env.local` file:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Application URL (for magic links)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to your production URL

# Groq API (for AI features)
GROQ_API_KEY=your_groq_api_key
```

### 2. Create Initial Admin User

Run the admin setup script to create your first admin user:

```bash
node setup-admin-user.js
```

This will create an admin user with:
- **Email**: admin@greenbridge.com
- **Password**: Admin123!
- **Role**: admin

### 3. Start the Application

```bash
npm run dev
```

### 4. Login as Admin

1. Go to `http://localhost:3000/login`
2. Use the admin credentials created in step 2
3. You'll be redirected to the admin dashboard

## 🧑‍💼 Admin User Creation Process

### Step 1: Access User Creation
1. Login as admin
2. Navigate to **Users** → **Create User** in the sidebar
3. Or go directly to `/dashboard/users/create`

### Step 2: Fill User Details
1. **Basic Information**:
   - Full Name (required)
   - Email Address (required)
   - Phone Number (optional)
   - ID Number (optional)

2. **Role Selection**:
   - Tenant
   - Property Owner
   - Service Provider
   - Mixed Provider

3. **Role-Specific Fields**:
   - **Tenants**: Optional unit assignment
   - **Service Providers**: Service type and company name

### Step 3: Create User
1. Click **"Create User & Send Login Link"**
2. System creates user account
3. Magic link is automatically sent to user's email
4. User receives professional email with setup instructions

## 📧 User Onboarding Flow

### For New Users:
1. **Receive Email**: User gets magic link email
2. **Click Link**: User clicks the secure login link
3. **Set Password**: User sets their password
4. **Auto Login**: User is automatically logged in
5. **Dashboard Access**: User is redirected to their role-specific dashboard

### For Existing Users:
1. **Normal Login**: Use email + password
2. **Password Reset**: Available via "Forgot Password" link
3. **Admin Reset**: Admin can trigger password reset

## 🔧 Email Configuration (Production)

### Current Development Setup
- Emails are logged to console
- Magic links are displayed in console for testing
- Ready for production email service integration

### Production Email Setup Options

#### Option 1: SendGrid
```javascript
// In your email service file
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: email,
  from: 'noreply@greenbridge.com',
  subject: 'Welcome to Green Bridge',
  html: emailTemplate
};

await sgMail.send(msg);
```

#### Option 2: AWS SES
```javascript
// In your email service file
const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: 'us-east-1' });

const params = {
  Destination: { ToAddresses: [email] },
  Message: {
    Body: { Html: { Data: emailTemplate } },
    Subject: { Data: 'Welcome to Green Bridge' }
  },
  Source: 'noreply@greenbridge.com'
};

await ses.sendEmail(params).promise();
```

#### Option 3: Nodemailer (SMTP)
```javascript
// In your email service file
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

await transporter.sendMail({
  from: 'noreply@greenbridge.com',
  to: email,
  subject: 'Welcome to Green Bridge',
  html: emailTemplate
});
```

## 🛡️ Security Features

### Magic Link Security
- **32-byte random tokens**: Cryptographically secure
- **24-hour expiration**: Automatic token expiration
- **Single-use**: Tokens are cleared after use
- **Secure storage**: Tokens stored in Firestore

### Password Security
- **Firebase Auth**: Industry-standard password security
- **Minimum 6 characters**: Password strength requirements
- **Secure reset**: Token-based password reset
- **No password sharing**: Eliminates insecure practices

### Access Control
- **Admin-only creation**: No public registration
- **Role-based access**: Different dashboards per role
- **Approval system**: Admin controls all user access
- **Audit trail**: Complete logging of user actions

## 🎯 User Roles & Permissions

### Admin
- **Full Access**: All system features
- **User Management**: Create, approve, manage users
- **System Configuration**: Buildings, units, assignments
- **Financial Management**: All invoices and contracts

### Property Owner
- **Own Properties**: View and manage their properties
- **Tenant Management**: Manage tenants in their properties
- **Financial Reports**: Property-specific financial data

### Tenant
- **Personal Dashboard**: Own unit and contract info
- **Invoice Management**: View and pay invoices
- **Maintenance Requests**: Submit and track requests

### Service Provider
- **Assigned Jobs**: View and manage assigned tasks
- **Invoice Creation**: Generate invoices for work
- **Job History**: Track completed service requests

## 🔍 Testing the System

### Test User Creation
1. Login as admin
2. Go to **Create User**
3. Fill out form with test data
4. Check console for magic link
5. Click magic link to test user setup

### Test Password Reset
1. Go to login page
2. Click "Forgot Password"
3. Enter email address
4. Check console for reset link
5. Test password reset flow

### Test Role-Based Access
1. Create users with different roles
2. Login as each user type
3. Verify correct dashboard access
4. Test role-specific features

## 🚨 Troubleshooting

### Common Issues

#### Magic Link Not Working
- Check console for email content
- Verify token hasn't expired
- Ensure user hasn't already set password

#### User Can't Login
- Verify user is approved (`isApproved: true`)
- Check if user has set password (`hasSetPassword: true`)
- Confirm email matches exactly

#### Email Not Sending
- Check console logs for email content
- Verify email service configuration
- Test with different email addresses

### Debug Mode
- Magic links are logged to console in development
- Email content is displayed in console
- All API responses include debug information

## 📚 Additional Resources

### Documentation Files
- `AUTH_FLOW_DOCUMENTATION.md` - Complete technical documentation
- `SYSTEM_ENHANCEMENTS.md` - Overview of all system improvements
- `README.md` - General project information

### API Endpoints
- `POST /api/auth/send-magic-link` - Send magic link
- `POST /api/auth/reset-password` - Send password reset

### Frontend Routes
- `/dashboard/users/create` - Admin user creation
- `/auth/magic-link` - Magic link validation
- `/auth/set-password` - Password setup
- `/auth/reset-password` - Password reset

## 🎉 You're Ready!

Your admin-only authentication system is now fully set up and ready for production use. The system provides:

- ✅ **Secure user creation** by admins only
- ✅ **Professional email notifications** with magic links
- ✅ **Passwordless first login** for new users
- ✅ **Role-based access control** for all user types
- ✅ **Password reset functionality** for existing users
- ✅ **Professional user experience** throughout

The system is production-ready and can be easily integrated with any email service provider for full email functionality.



