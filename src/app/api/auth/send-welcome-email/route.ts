import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email, userId, role, userData, emailType } = await req.json();

    if (!email || !userId || !role) {
      return NextResponse.json({ error: 'Email, userId, and role are required' }, { status: 400 });
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store the magic link token in the user document
    await updateDoc(doc(db, 'users', userId), {
      magicLinkToken: token,
      magicLinkExpires: expiresAt.toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create the magic link URL
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/magic-link?token=${token}&userId=${userId}`;

    // Send role-specific welcome email
    await sendRoleSpecificWelcomeEmail(email, magicLink, role, userData);

    return NextResponse.json({ 
      success: true, 
      message: 'Welcome email sent successfully',
      // Don't return the actual link in production
      ...(process.env.NODE_ENV === 'development' && { magicLink })
    });

  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
  }
}

async function sendRoleSpecificWelcomeEmail(email: string, magicLink: string, role: string, userData: any) {
  console.log('Welcome email would be sent to:', email);
  console.log('Magic link:', magicLink);
  console.log('User role:', role);
  console.log('User data:', userData);
  
  try {
    let emailContent;

    switch (role) {
      case 'propertyOwner':
        emailContent = generatePropertyOwnerWelcomeEmail(userData, magicLink);
        break;
      case 'tenant':
        emailContent = generateTenantWelcomeEmail(userData, magicLink);
        break;
      case 'service':
      case 'mixedProvider':
        emailContent = generateServiceProviderWelcomeEmail(userData, magicLink);
        break;
      default:
        emailContent = generateGenericWelcomeEmail(userData, magicLink);
    }

    // In production, replace this with actual email sending
    // await emailService.send(emailContent);
    
    console.log('Email content prepared:', emailContent);
    
  } catch (error) {
    console.error('Error preparing welcome email:', error);
    throw error;
  }
}

function generatePropertyOwnerWelcomeEmail(userData: any, magicLink: string) {
  return {
    to: userData.email,
    subject: 'Welcome to Green Bridge Property Management - Owner Portal Access',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to Green Bridge</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Property Management Portal</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9;">
          <h2 style="color: #059669; margin-top: 0;">Welcome, ${userData.fullName}!</h2>
          
          <p>Your property owner account has been created successfully. You now have access to our comprehensive property management platform.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="margin-top: 0; color: #059669;">Your Account Details:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Name:</strong> ${userData.fullName}</li>
              <li><strong>Email:</strong> ${userData.email}</li>
              <li><strong>Phone:</strong> ${userData.phoneNumber}</li>
              <li><strong>Role:</strong> Property Owner</li>
              ${userData.assignedProperties?.length > 0 ? `<li><strong>Assigned Properties:</strong> ${userData.assignedProperties.length} properties</li>` : ''}
            </ul>
          </div>
          
          <h3 style="color: #059669;">What You Can Do:</h3>
          <ul style="padding-left: 20px;">
            <li>View and manage your properties</li>
            <li>Monitor tenant information and contracts</li>
            <li>Track rental income and expenses</li>
            <li>Request maintenance services</li>
            <li>Generate financial reports</li>
            <li>Communicate with tenants and service providers</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Set Password & Access Portal
            </a>
          </div>
          
          <div style="background-color: #e6f7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #1890ff;">Important Information:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li>This link will expire in 24 hours</li>
              <li>After setting your password, you can log in normally</li>
              <li>Contact support if you need assistance</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${magicLink}" style="color: #059669;">${magicLink}</a>
          </p>
        </div>
        
        <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 Green Bridge Property Management</p>
          <p style="margin: 5px 0 0 0;">Professional Property Management Services</p>
        </div>
      </div>
    `
  };
}

function generateTenantWelcomeEmail(userData: any, magicLink: string) {
  return {
    to: userData.email,
    subject: 'Welcome to Your New Home - Green Bridge Tenant Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Welcome Home!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Green Bridge Tenant Portal</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9;">
          <h2 style="color: #059669; margin-top: 0;">Hello, ${userData.fullName}!</h2>
          
          <p>Welcome to your new home! Your tenant account has been created and you now have access to our convenient tenant portal.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="margin-top: 0; color: #059669;">Your Account Details:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Name:</strong> ${userData.fullName}</li>
              <li><strong>Email:</strong> ${userData.email}</li>
              <li><strong>Phone:</strong> ${userData.phoneNumber}</li>
              <li><strong>Role:</strong> Tenant</li>
              ${userData.moveInDate ? `<li><strong>Move-in Date:</strong> ${new Date(userData.moveInDate).toLocaleDateString()}</li>` : ''}
            </ul>
          </div>
          
          <h3 style="color: #059669;">What You Can Do:</h3>
          <ul style="padding-left: 20px;">
            <li>View your unit details and rental information</li>
            <li>Pay rent and utilities online</li>
            <li>Submit maintenance requests</li>
            <li>View your rental contract</li>
            <li>Track payment history</li>
            <li>Communicate with property management</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Set Password & Access Portal
            </a>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h4 style="margin-top: 0; color: #856404;">Getting Started:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li>Set your password using the link above</li>
              <li>Complete your profile information</li>
              <li>Familiarize yourself with the tenant portal</li>
              <li>Contact us if you have any questions</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${magicLink}" style="color: #059669;">${magicLink}</a>
          </p>
        </div>
        
        <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 Green Bridge Property Management</p>
          <p style="margin: 5px 0 0 0;">Your Home, Our Care</p>
        </div>
      </div>
    `
  };
}

function generateServiceProviderWelcomeEmail(userData: any, magicLink: string) {
  return {
    to: userData.email,
    subject: 'Welcome to Green Bridge Service Network - Provider Portal Access',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to Our Network</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Green Bridge Service Provider Portal</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9;">
          <h2 style="color: #059669; margin-top: 0;">Hello, ${userData.fullName}!</h2>
          
          <p>Welcome to the Green Bridge service provider network! Your account has been created and you now have access to our service provider portal.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="margin-top: 0; color: #059669;">Your Account Details:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Name:</strong> ${userData.fullName}</li>
              <li><strong>Email:</strong> ${userData.email}</li>
              <li><strong>Phone:</strong> ${userData.phoneNumber}</li>
              <li><strong>Role:</strong> Service Provider</li>
              ${userData.serviceType ? `<li><strong>Service Type:</strong> ${userData.serviceType}</li>` : ''}
              ${userData.companyName ? `<li><strong>Company:</strong> ${userData.companyName}</li>` : ''}
              ${userData.hourlyRate ? `<li><strong>Hourly Rate:</strong> RM ${userData.hourlyRate}</li>` : ''}
            </ul>
          </div>
          
          <h3 style="color: #059669;">What You Can Do:</h3>
          <ul style="padding-left: 20px;">
            <li>View assigned maintenance requests</li>
            <li>Update job status and progress</li>
            <li>Communicate with tenants and property owners</li>
            <li>Generate invoices for completed work</li>
            <li>Track your work history and earnings</li>
            <li>Manage your service schedule</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Set Password & Access Portal
            </a>
          </div>
          
          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
            <h4 style="margin-top: 0; color: #0c5460;">Service Provider Guidelines:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li>Respond to job assignments promptly</li>
              <li>Update job status regularly</li>
              <li>Maintain professional communication</li>
              <li>Submit invoices within 48 hours of job completion</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${magicLink}" style="color: #059669;">${magicLink}</a>
          </p>
        </div>
        
        <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 Green Bridge Property Management</p>
          <p style="margin: 5px 0 0 0;">Professional Service Network</p>
        </div>
      </div>
    `
  };
}

function generateGenericWelcomeEmail(userData: any, magicLink: string) {
  return {
    to: userData.email,
    subject: 'Welcome to Green Bridge - Account Setup',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to Green Bridge</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Property Management System</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9;">
          <h2 style="color: #059669; margin-top: 0;">Welcome, ${userData.fullName}!</h2>
          
          <p>Your account has been created successfully. You now have access to our property management platform.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="margin-top: 0; color: #059669;">Your Account Details:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Name:</strong> ${userData.fullName}</li>
              <li><strong>Email:</strong> ${userData.email}</li>
              <li><strong>Phone:</strong> ${userData.phoneNumber}</li>
              <li><strong>Role:</strong> ${userData.role}</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Set Password & Access Portal
            </a>
          </div>
          
          <div style="background-color: #e6f7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #1890ff;">Important Information:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li>This link will expire in 24 hours</li>
              <li>After setting your password, you can log in normally</li>
              <li>Contact support if you need assistance</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${magicLink}" style="color: #059669;">${magicLink}</a>
          </p>
        </div>
        
        <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 Green Bridge Property Management</p>
          <p style="margin: 5px 0 0 0;">Professional Property Management Services</p>
        </div>
      </div>
    `
  };
}

