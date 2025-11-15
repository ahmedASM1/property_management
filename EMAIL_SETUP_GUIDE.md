# 📧 Email Service Setup Guide

## 🎯 **Overview**

Your Green Bridge application now supports **3 professional email services** to send magic link login emails to users. Choose the option that best fits your needs:

## 🚀 **Option 1: SendGrid (Recommended)**

**Best for**: Professional email delivery, excellent deliverability, easy setup

### **Setup Steps:**

1. **Create SendGrid Account:**
   - Go to [sendgrid.com](https://sendgrid.com)
   - Sign up for a free account (100 emails/day free)

2. **Get API Key:**
   - Go to Settings → API Keys
   - Create a new API key with "Full Access"
   - Copy the API key

3. **Verify Sender Email:**
   - Go to Settings → Sender Authentication
   - Verify your domain or single sender email

4. **Add to Environment Variables:**
   ```env
   # .env.local
   SENDGRID_API_KEY=your_sendgrid_api_key_here
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   SENDGRID_FROM_NAME=Green Bridge
   ```

### **Pricing:**
- **Free**: 100 emails/day
- **Essentials**: $19.95/month for 50,000 emails
- **Pro**: $89.95/month for 100,000 emails

---

## 🚀 **Option 2: AWS SES**

**Best for**: Cost-effective, scalable, AWS integration

### **Setup Steps:**

1. **Create AWS Account:**
   - Go to [aws.amazon.com](https://aws.amazon.com)
   - Sign up for AWS account

2. **Set up SES:**
   - Go to AWS Console → Simple Email Service (SES)
   - Verify your email address or domain
   - Request production access (if needed)

3. **Create IAM User:**
   - Go to IAM → Users → Create User
   - Attach policy: `AmazonSESFullAccess`
   - Create access keys

4. **Add to Environment Variables:**
   ```env
   # .env.local
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=us-east-1
   AWS_SES_FROM_EMAIL=noreply@yourdomain.com
   AWS_SES_REPLY_TO=support@yourdomain.com
   ```

### **Pricing:**
- **Free**: 62,000 emails/month (if sent from EC2)
- **Paid**: $0.10 per 1,000 emails
- **Very cost-effective** for high volume

---

## 🚀 **Option 3: Nodemailer (SMTP)**

**Best for**: Simple setup, works with any email provider

### **Setup Steps:**

#### **For Gmail:**
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password:**
   - Go to Google Account → Security → App passwords
   - Generate password for "Mail"
3. **Add to Environment Variables:**
   ```env
   # .env.local
   SMTP_SERVICE=gmail
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your_app_password
   SMTP_FROM_EMAIL=your-email@gmail.com
   SMTP_FROM_NAME=Green Bridge
   ```

#### **For Custom SMTP:**
```env
# .env.local
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_smtp_password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Green Bridge
```

### **Popular SMTP Providers:**
- **Gmail**: Free, 500 emails/day limit
- **Outlook/Hotmail**: Free, 300 emails/day limit
- **Mailgun**: $35/month for 50,000 emails
- **Postmark**: $10/month for 10,000 emails

---

## 🔧 **Installation & Setup**

### **1. Install Dependencies:**
```bash
npm install @sendgrid/mail aws-sdk nodemailer
npm install --save-dev @types/nodemailer
```

### **2. Create Environment File:**
Create `.env.local` in your project root:

```env
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Choose ONE email service:

# Option 1: SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Green Bridge

# Option 2: AWS SES
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
AWS_SES_REPLY_TO=support@yourdomain.com

# Option 3: Nodemailer (SMTP)
SMTP_SERVICE=gmail
SMTP_USER=your-email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Green Bridge
```

### **3. Test Email Service:**
```bash
# Test the email API
curl -X POST http://localhost:3000/api/test-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","userId":"test-user-id"}'
```

---

## 📧 **Email Features**

### **Professional Email Templates:**
- ✅ **Role-specific branding** (Admin, Property Owner, Tenant, Service Provider)
- ✅ **Personalized content** with user details
- ✅ **Responsive design** works on all devices
- ✅ **Security information** and instructions
- ✅ **Fallback links** if buttons don't work
- ✅ **Professional footer** with contact information

### **Email Content Includes:**
- **Welcome message** with user's name
- **Account details** (name, email, phone, role)
- **Role-specific information** about what they can do
- **Magic link button** to set password
- **Security notices** and expiration info
- **Contact information** for support

### **Automatic Fallback:**
The system tries email services in this order:
1. **SendGrid** (if configured)
2. **AWS SES** (if SendGrid fails)
3. **Nodemailer** (if others fail)
4. **Console logging** (if no service configured)

---

## 🧪 **Testing**

### **Development Mode:**
- Emails are logged to console
- Magic links are displayed in API response
- No actual emails sent (unless service configured)

### **Production Mode:**
- Real emails sent via configured service
- Magic links not returned in API response
- Full error handling and logging

### **Test Commands:**
```bash
# Test Firebase connection
curl http://localhost:3000/api/test-firebase

# Test magic link generation
curl -X POST http://localhost:3000/api/test-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","userId":"test-user-id"}'
```

---

## 🔒 **Security Features**

### **Magic Link Security:**
- ✅ **24-hour expiration** for security
- ✅ **Single-use tokens** (invalidated after use)
- ✅ **Secure random generation** (32 bytes)
- ✅ **User verification** before sending
- ✅ **Rate limiting** protection

### **Email Security:**
- ✅ **HTTPS-only** magic links
- ✅ **Domain verification** for sending
- ✅ **SPF/DKIM records** (recommended)
- ✅ **No sensitive data** in email content

---

## 📊 **Monitoring & Analytics**

### **Email Delivery Tracking:**
- **SendGrid**: Built-in analytics dashboard
- **AWS SES**: CloudWatch metrics
- **Nodemailer**: Custom logging required

### **Key Metrics to Monitor:**
- **Delivery rate** (emails successfully sent)
- **Open rate** (emails opened by recipients)
- **Click rate** (magic links clicked)
- **Bounce rate** (invalid email addresses)
- **Spam complaints** (emails marked as spam)

---

## 🚨 **Troubleshooting**

### **Common Issues:**

#### **"No email service configured"**
- **Solution**: Add at least one email service to `.env.local`
- **Check**: Environment variables are loaded correctly

#### **"SendGrid API key invalid"**
- **Solution**: Verify API key in SendGrid dashboard
- **Check**: API key has correct permissions

#### **"AWS credentials not configured"**
- **Solution**: Add AWS credentials to `.env.local`
- **Check**: IAM user has SES permissions

#### **"SMTP authentication failed"**
- **Solution**: Use App Password for Gmail
- **Check**: 2FA is enabled on email account

#### **"Email not received"**
- **Check**: Spam/junk folder
- **Check**: Email address is correct
- **Check**: Sender domain is verified

### **Debug Commands:**
```bash
# Check environment variables
node -e "console.log(process.env.SENDGRID_API_KEY ? 'SendGrid configured' : 'SendGrid not configured')"

# Test email service directly
node -e "
const { sendEmailWithSendGrid } = require('./src/lib/email-sendgrid');
sendEmailWithSendGrid({
  to: 'test@example.com',
  subject: 'Test',
  html: '<h1>Test</h1>'
}).then(() => console.log('Success')).catch(console.error);
"
```

---

## 🎯 **Recommendations**

### **For Small Business (Startup):**
- **Use Gmail with Nodemailer** (free, easy setup)
- **Upgrade to SendGrid** when you need more emails

### **For Growing Business:**
- **Use SendGrid** (professional, reliable, good deliverability)
- **Monitor delivery rates** and upgrade plan as needed

### **For Enterprise:**
- **Use AWS SES** (cost-effective, scalable, AWS integration)
- **Set up custom domain** with SPF/DKIM records
- **Implement email analytics** and monitoring

---

## 📞 **Support**

If you need help setting up email services:

1. **Check the console logs** for detailed error messages
2. **Test with the debug endpoints** I created
3. **Verify your environment variables** are correct
4. **Check the email service documentation** for your chosen provider

The system is designed to be **fault-tolerant** - it will try multiple services and provide detailed error messages to help you troubleshoot any issues!

