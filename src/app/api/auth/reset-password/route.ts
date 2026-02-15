import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import crypto from 'crypto';
import { sendEmailWithSendGrid } from '@/lib/email-sendgrid';
import { sendEmailWithAWSSES } from '@/lib/email-aws-ses';
import { sendEmailWithNodemailer } from '@/lib/email-nodemailer';
import { getPasswordResetEmailHtml } from '@/lib/email-templates';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store the reset token in the user document
    await updateDoc(doc(db, 'users', userDoc.id), {
      passwordResetToken: resetToken,
      passwordResetExpires: expiresAt.toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create the reset link URL
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}&userId=${userDoc.id}`;

    // Send reset email
    await sendPasswordResetEmail(email, resetLink, userData.fullName);

    return NextResponse.json({ 
      success: true, 
      message: 'Password reset link sent successfully',
      // Don't return the actual link in production
      ...(process.env.NODE_ENV === 'development' && { resetLink })
    });

  } catch (error) {
    console.error('Error sending password reset:', error);
    return NextResponse.json({ error: 'Failed to send password reset link' }, { status: 500 });
  }
}

async function sendPasswordResetEmail(email: string, resetLink: string, fullName: string) {
  const html = getPasswordResetEmailHtml(fullName || '', resetLink, 24);
  const emailData = {
    to: email,
    subject: 'Reset your password – Green Bridge',
    html,
  };

  let sent = false;

  if (process.env.SENDGRID_API_KEY) {
    try {
      await sendEmailWithSendGrid(emailData);
      sent = true;
    } catch (err) {
      console.error('SendGrid password reset email failed:', err);
    }
  }

  if (!sent && process.env.AWS_ACCESS_KEY_ID) {
    try {
      await sendEmailWithAWSSES(emailData);
      sent = true;
    } catch (err) {
      console.error('AWS SES password reset email failed:', err);
    }
  }

  if (!sent && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await sendEmailWithNodemailer(emailData);
      sent = true;
    } catch (err) {
      console.error('Nodemailer password reset email failed:', err);
    }
  }

  if (!sent) {
    throw new Error(
      'No email service configured. Set SENDGRID_API_KEY, or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, or SMTP_USER + SMTP_PASS in your environment (e.g. Vercel).'
    );
  }
}



