import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import crypto from 'crypto';

// Import email services
import { sendEmailWithSendGrid, generateWelcomeEmailTemplate } from '@/lib/email-sendgrid';
import { sendEmailWithAWSSES } from '@/lib/email-aws-ses';
import { sendEmailWithNodemailer } from '@/lib/email-nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { email, userId } = await req.json();

    console.log('Magic link request received:', { email, userId });

    if (!email || !userId) {
      console.error('Missing required fields:', { email, userId });
      return NextResponse.json({ error: 'Email and userId are required' }, { status: 400 });
    }

    // Check if user document exists
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.error('User document not found:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    console.log('Generated token for user:', userId);

    // Store the magic link token in the user document
    await updateDoc(userDocRef, {
      magicLinkToken: token,
      magicLinkExpires: expiresAt.toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log('Updated user document with magic link token');

    // Create the magic link URL
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/magic-link?token=${token}&userId=${userId}`;

    console.log('Created magic link:', magicLink);

    // Send email using configured email service
    await sendWelcomeEmail(email, magicLink, userId);

    console.log('Magic link email sent successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'Magic link sent successfully',
      // Don't return the actual link in production
      ...(process.env.NODE_ENV === 'development' && { magicLink })
    });

  } catch (error) {
    console.error('Error sending magic link:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json({ 
      error: 'Failed to send magic link',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}

async function sendWelcomeEmail(email: string, magicLink: string, userId: string) {
  try {
    console.log('Preparing welcome email for:', email);
    
    // Get user data for personalized email
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('User not found for email');
    }
    
    const userData = userDoc.data();
    const role = userData.role || 'tenant';
    
    // Generate professional email template
    const emailData = generateWelcomeEmailTemplate(userData, magicLink, role);
    
    // Try to send email using configured service
    let emailSent = false;
    
    // Try SendGrid first
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sendEmailWithSendGrid(emailData);
        emailSent = true;
        console.log('✅ Email sent via SendGrid');
      } catch (error) {
        console.log('❌ SendGrid failed, trying other services:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // Try AWS SES if SendGrid failed
    if (!emailSent && process.env.AWS_ACCESS_KEY_ID) {
      try {
        await sendEmailWithAWSSES(emailData);
        emailSent = true;
        console.log('✅ Email sent via AWS SES');
      } catch (error) {
        console.log('❌ AWS SES failed, trying Nodemailer:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // Try Nodemailer if others failed
    if (!emailSent && process.env.SMTP_USER) {
      try {
        await sendEmailWithNodemailer(emailData);
        emailSent = true;
        console.log('✅ Email sent via Nodemailer');
      } catch (error) {
        console.log('❌ Nodemailer failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // If no email service is configured, log the email content
    if (!emailSent) {
      console.log('📧 No email service configured. Email content:');
      console.log('To:', emailData.to);
      console.log('Subject:', emailData.subject);
      console.log('Magic Link:', magicLink);
      console.log('📄 Email template generated successfully');
      
      // In development, we'll consider this successful
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Development mode: Email logged successfully');
        return true;
      } else {
        throw new Error('No email service configured');
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('Error sending welcome email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send welcome email: ${errorMessage}`);
  }
}


