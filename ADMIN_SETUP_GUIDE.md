# 🔐 Admin User Setup Guide
## Green Bridge Property Management

This guide explains how to create the initial admin user for your property management system. You have **three secure options** to choose from.

## 🎯 Why Do We Need Admin Setup?

Since your system uses **admin-only user creation**, you need a way to create the very first admin user who can then create all other users (property owners, tenants, service providers).

## 📋 Setup Options

### Option 1: Interactive Setup Script (Recommended)
**Best for**: First-time setup, when you want full control over the process

```bash
# Run the interactive setup script
node scripts/setup-admin.js
```

**Features:**
- ✅ Interactive prompts for all information
- ✅ Password strength validation
- ✅ Hidden password input (secure)
- ✅ Checks for existing admin users
- ✅ Comprehensive error handling
- ✅ Security confirmations

**What it does:**
1. Prompts for admin details (name, email, phone, password)
2. Validates password strength
3. Creates Firebase Auth user
4. Creates Firestore user document with admin permissions
5. Provides setup confirmation and next steps

### Option 2: Web Interface Setup Page
**Best for**: When you prefer a web-based setup process

1. **Navigate to**: `http://localhost:3000/setup-admin`
2. **Fill out the form** with admin details
3. **Click "Create Admin Account"**

**Features:**
- ✅ Web-based interface
- ✅ Real-time password validation
- ✅ Visual feedback and progress indicators
- ✅ Checks for existing admin users
- ✅ Professional UI design
- ✅ Automatic redirect to login

**Security Notes:**
- Only works if no admin exists yet
- Automatically redirects to login after creation
- Shows security warnings about admin privileges

### Option 3: Environment Variables (CI/CD)
**Best for**: Automated deployments, CI/CD pipelines, Docker containers

```bash
# Set environment variables and run
ADMIN_EMAIL=admin@greenbridge.com \
ADMIN_PASSWORD=SecurePass123! \
ADMIN_NAME="System Administrator" \
ADMIN_PHONE="+60 12-345 6789" \
node scripts/create-admin-from-env.js
```

**Features:**
- ✅ Fully automated (no user interaction)
- ✅ Perfect for deployment scripts
- ✅ Environment variable configuration
- ✅ Checks for existing admin users
- ✅ Detailed logging output

## 🔒 Security Requirements

### Password Requirements
All methods enforce strong password requirements:
- **Minimum 8 characters**
- **At least one uppercase letter**
- **At least one lowercase letter**
- **At least one number**
- **At least one special character**
- **Not a common password**

### Admin Permissions
The created admin user gets full system permissions:
- **User Management**: Create, read, update, delete all users
- **Property Management**: Full property and unit control
- **Financial Management**: All invoices and financial reports
- **Contract Management**: All contract operations
- **Maintenance Management**: All maintenance requests
- **System Settings**: Full system configuration access

## 🚀 Step-by-Step Setup

### Method 1: Interactive Script Setup

1. **Open terminal** in your project directory
2. **Run the setup script**:
   ```bash
   node scripts/setup-admin.js
   ```
3. **Follow the prompts**:
   - Enter full name
   - Enter email address
   - Enter phone number (optional)
   - Enter strong password
   - Confirm password
   - Confirm security warning
4. **Wait for completion** - script will create the admin user
5. **Go to login page** and use your credentials

### Method 2: Web Interface Setup

1. **Start your development server**:
   ```bash
   npm run dev
   ```
2. **Navigate to setup page**:
   ```
   http://localhost:3000/setup-admin
   ```
3. **Fill out the form**:
   - Full Name
   - Email Address
   - Phone Number (optional)
   - Password (with real-time validation)
   - Confirm Password
4. **Click "Create Admin Account"**
5. **You'll be redirected** to the login page

### Method 3: Environment Variables Setup

1. **Set environment variables**:
   ```bash
   export ADMIN_EMAIL="admin@greenbridge.com"
   export ADMIN_PASSWORD="SecurePass123!"
   export ADMIN_NAME="System Administrator"
   export ADMIN_PHONE="+60 12-345 6789"
   ```
2. **Run the script**:
   ```bash
   node scripts/create-admin-from-env.js
   ```
3. **Check the output** for success confirmation
4. **Use the credentials** to log in

## 🔍 Verification

After creating the admin user, verify it works:

1. **Go to login page**: `http://localhost:3000/login`
2. **Enter your admin credentials**
3. **You should see the admin dashboard** with full access
4. **Check user management**: Go to Users → Create User
5. **Verify you can create other users**

## 🛡️ Security Best Practices

### After Admin Creation

1. **Store credentials securely**:
   - Use a password manager
   - Don't share admin credentials
   - Consider using a dedicated admin email

2. **Create backup admin users**:
   - Create additional admin users for backup access
   - Use different email addresses
   - Store backup credentials separately

3. **Enable monitoring**:
   - Monitor admin login attempts
   - Review admin activity logs
   - Set up alerts for suspicious activity

4. **Regular security reviews**:
   - Change admin passwords periodically
   - Review admin user permissions
   - Audit admin access logs

## 🚨 Troubleshooting

### Common Issues

#### "Admin Already Exists"
- **Cause**: An admin user has already been created
- **Solution**: Use existing admin credentials or create additional admin users through the admin panel

#### "Firebase Configuration Not Found"
- **Cause**: Missing or incorrect Firebase configuration
- **Solution**: Check your `.env.local` file contains all required Firebase variables

#### "Password Too Weak"
- **Cause**: Password doesn't meet strength requirements
- **Solution**: Use a stronger password that meets all requirements

#### "Email Already in Use"
- **Cause**: The email address is already registered
- **Solution**: Use a different email address or reset the existing account

### Getting Help

If you encounter issues:

1. **Check the console output** for detailed error messages
2. **Verify Firebase configuration** in your `.env.local` file
3. **Ensure Firebase project** is properly set up
4. **Check Firestore security rules** allow user creation
5. **Review the implementation guide** for additional setup steps

## 📋 Environment Variables Reference

### Required Firebase Configuration
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Optional Admin Setup Variables (Method 3)
```env
ADMIN_EMAIL=admin@greenbridge.com
ADMIN_PASSWORD=SecurePass123!
ADMIN_NAME=System Administrator
ADMIN_PHONE=+60 12-345 6789
```

## 🎯 Next Steps After Admin Setup

1. **Log in as admin** using your credentials
2. **Create property owners** for your clients
3. **Assign properties** to property owners
4. **Create tenants** for each property
5. **Set up service providers** for maintenance
6. **Configure system settings** as needed
7. **Test the complete user flow** with different user types

## 🔄 Creating Additional Admin Users

Once you have an admin user, you can create additional admin users through the web interface:

1. **Log in as existing admin**
2. **Go to Users → Create User**
3. **Select "Admin" role** (if available in the enhanced form)
4. **Fill out admin details**
5. **Send welcome email** with magic link

---

**Choose the setup method that works best for your deployment strategy!** All methods are secure and will create a fully functional admin user with complete system access.

