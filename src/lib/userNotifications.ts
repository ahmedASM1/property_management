// Email notification functions for user approval/rejection
import { sendEmail } from './email';

export interface UserApprovalNotification {
  userEmail: string;
  userName: string;
  status: 'approved' | 'rejected';
  role?: string;
  adminName?: string;
}

export async function sendUserApprovalEmail(notification: UserApprovalNotification) {
  const { userEmail, userName, status, role, adminName } = notification;
  
  const subject = status === 'approved' 
    ? `✅ Your Green Bridge account has been approved!`
    : `❌ Your Green Bridge account application status`;

  const htmlContent = status === 'approved' 
    ? generateApprovalEmailHTML(userName, role, adminName, userEmail)
    : generateRejectionEmailHTML(userName, adminName);

  try {
    await sendEmail({
      to: userEmail,
      subject,
      html: htmlContent,
    });
    console.log(`Approval email sent to ${userEmail}`);
  } catch (error) {
    console.error('Failed to send approval email:', error);
    throw error;
  }
}

function generateApprovalEmailHTML(userName: string, role?: string, adminName?: string, userEmail?: string): string {
  const roleDisplay = role ? getRoleDisplayName(role) : 'your assigned role';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Approved - Green Bridge</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .success-icon { font-size: 48px; margin-bottom: 20px; }
        .button { display: inline-block; background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #059669; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        .role-badge { background: #EFF6FF; color: #1E40AF; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">✅</div>
          <h1>Welcome to Green Bridge!</h1>
          <p>Your account has been approved</p>
        </div>
        
        <div class="content">
          <h2>Hello ${userName}!</h2>
          
          <p>Great news! Your Green Bridge Realty account has been approved by our administrator${adminName ? ` (${adminName})` : ''}.</p>
          
          <div style="text-align: center;">
            <div class="role-badge">Role: ${roleDisplay}</div>
          </div>
          
          <p>You can now access your dashboard and start using all the features available to ${roleDisplay.toLowerCase()}s.</p>
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" class="button">
              Access Your Dashboard
            </a>
          </div>
          
          <h3>What's Next?</h3>
          <ul>
            <li>Log in to your account using your registered email and password</li>
            <li>Complete your profile setup</li>
            <li>Explore the features available for your role</li>
            <li>Contact support if you need any assistance</li>
          </ul>
          
          <p>If you have any questions or need help getting started, please don't hesitate to contact our support team.</p>
          
          <p>Welcome to the Green Bridge community!</p>
          
          <p><strong>The Green Bridge Team</strong></p>
        </div>
        
        <div class="footer">
          <p>This email was sent to ${userEmail || 'your registered email'}</p>
          <p>Green Bridge Realty Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateRejectionEmailHTML(userName: string, adminName?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Application Status - Green Bridge</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #EF4444, #DC2626); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        .contact-info { background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">❌</div>
          <h1>Application Status Update</h1>
          <p>Green Bridge Realty</p>
        </div>
        
        <div class="content">
          <h2>Hello ${userName},</h2>
          
          <p>Thank you for your interest in joining Green Bridge Realty. After careful review by our administrator${adminName ? ` (${adminName})` : ''}, we regret to inform you that your account application has not been approved at this time.</p>
          
          <div class="contact-info">
            <h3>Need More Information?</h3>
            <p>If you believe this decision was made in error or if you have additional information that might be relevant to your application, please contact our support team:</p>
            <ul>
              <li>Email: info@greenbridge-my.com</li>
              <li>Phone: +60 3-1234 5678</li>
              <li>Office Hours: Monday - Friday, 9:00 AM - 6:00 PM</li>
            </ul>
          </div>
          
          <p>We appreciate your interest in Green Bridge Realty and encourage you to reapply in the future if your circumstances change.</p>
          
          <p>Thank you for your understanding.</p>
          
          <p><strong>The Green Bridge Team</strong></p>
        </div>
        
        <div class="footer">
          <p>This email was sent to ${userName}</p>
          <p>Green Bridge Realty Management System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getRoleDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    'tenant': 'Tenant',
    'property_owner': 'Property Owner',
    'service_provider': 'Service Provider',
    'admin': 'Administrator',
    'mixedProvider': 'Mixed Provider'
  };
  return roleMap[role] || role;
}

