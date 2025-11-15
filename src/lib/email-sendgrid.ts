// SendGrid Email Service Integration
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmailWithSendGrid(emailData: EmailData): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured');
    }

    const msg = {
      to: emailData.to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@greenbridge.com',
        name: process.env.SENDGRID_FROM_NAME || 'Green Bridge'
      },
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || emailData.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    console.log('📧 Sending email via SendGrid to:', emailData.to);
    const response = await sgMail.send(msg);
    
    console.log('✅ Email sent successfully via SendGrid');
    console.log('SendGrid response:', response[0].statusCode);
    
    return true;
  } catch (error) {
    console.error('❌ SendGrid email error:', error);
    throw error;
  }
}

// Email templates for different user types
export function generateWelcomeEmailTemplate(
  userData: any, 
  magicLink: string, 
  role: string
): EmailData {
  const roleDisplayNames = {
    admin: 'Administrator',
    propertyOwner: 'Property Owner',
    tenant: 'Tenant',
    service: 'Service Provider',
    mixedProvider: 'Mixed Service Provider'
  };

  const roleDescriptions = {
    admin: 'You have full administrative access to the Green Bridge property management system.',
    propertyOwner: 'You can manage your properties, view tenant information, and access financial reports.',
    tenant: 'You can view your rental information, pay invoices, and submit maintenance requests.',
    service: 'You can view assigned maintenance jobs and create invoices for completed work.',
    mixedProvider: 'You can manage assigned properties, view maintenance jobs, and create invoices.'
  };

  const roleColors = {
    admin: '#dc2626', // red
    propertyOwner: '#059669', // green
    tenant: '#2563eb', // blue
    service: '#ea580c', // orange
    mixedProvider: '#7c3aed' // purple
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Green Bridge</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white;">
        <!-- Header -->
        <div style="background-color: ${roleColors[role] || '#059669'}; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Welcome to Green Bridge</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Property Management Portal</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px;">
          <h2 style="color: ${roleColors[role] || '#059669'}; margin-top: 0; font-size: 24px;">
            Welcome, ${userData.fullName}!
          </h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
            Your ${roleDisplayNames[role] || role} account has been created successfully. 
            You now have access to our comprehensive property management platform.
          </p>
          
          <!-- Account Details -->
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${roleColors[role] || '#059669'};">
            <h3 style="margin-top: 0; color: ${roleColors[role] || '#059669'}; font-size: 18px;">Your Account Details:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #374151;">
              <li><strong>Name:</strong> ${userData.fullName}</li>
              <li><strong>Email:</strong> ${userData.email}</li>
              <li><strong>Phone:</strong> ${userData.phoneNumber || 'Not provided'}</li>
              <li><strong>Role:</strong> ${roleDisplayNames[role] || role}</li>
              ${userData.assignedProperties?.length > 0 ? `<li><strong>Assigned Properties:</strong> ${userData.assignedProperties.length} properties</li>` : ''}
              ${userData.unitId ? `<li><strong>Unit:</strong> ${userData.unitId}</li>` : ''}
              ${userData.serviceType ? `<li><strong>Service Type:</strong> ${userData.serviceType}</li>` : ''}
            </ul>
          </div>
          
          <!-- Role-specific information -->
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="margin-top: 0; color: #1e40af; font-size: 18px;">What You Can Do:</h3>
            <p style="margin: 0; color: #1e40af; line-height: 1.6;">
              ${roleDescriptions[role] || 'You have access to the Green Bridge property management system.'}
            </p>
          </div>
          
          <!-- Call to Action -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" 
               style="background-color: ${roleColors[role] || '#059669'}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              Set Password & Access Portal
            </a>
          </div>
          
          <!-- Security Notice -->
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="margin-top: 0; color: #92400e; font-size: 16px;">Important Security Information:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px;">
              <li>This link will expire in 24 hours</li>
              <li>After setting your password, you can log in normally</li>
              <li>Keep your login credentials secure</li>
              <li>Contact support if you need assistance</li>
            </ul>
          </div>
          
          <!-- Fallback Link -->
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              <strong>If the button doesn't work:</strong> Copy and paste this link into your browser:<br>
              <a href="${magicLink}" style="color: ${roleColors[role] || '#059669'}; word-break: break-all;">${magicLink}</a>
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #1f2937; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 Green Bridge Property Management</p>
          <p style="margin: 5px 0 0 0; opacity: 0.8;">Professional Property Management Services</p>
          <p style="margin: 5px 0 0 0; opacity: 0.8;">
            <a href="mailto:support@greenbridge.com" style="color: white;">support@greenbridge.com</a> | 
            <a href="tel:+60123456789" style="color: white;">+60 12-345 6789</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    to: userData.email,
    subject: `Welcome to Green Bridge - ${roleDisplayNames[role] || role} Portal Access`,
    html: html
  };
}

