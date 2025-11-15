import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import crypto from 'crypto';

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
  // This is a placeholder for email sending
  // You can integrate with services like SendGrid, AWS SES, etc.
  
  console.log('Password reset email would be sent to:', email);
  console.log('Reset link:', resetLink);
  
  try {
    // Example email template
    const emailContent = {
      to: email,
      subject: 'Reset Your Green Bridge Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
            <h1>Password Reset Request</h1>
          </div>
          <div style="padding: 20px; background-color: #f9f9f9;">
            <h2>Hello ${fullName},</h2>
            <p>You requested to reset your password for your Green Bridge account. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              This link will expire in 24 hours. If you didn't request this password reset, please ignore this email.
            </p>
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetLink}">${resetLink}</a>
            </p>
          </div>
          <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            © 2024 Green Bridge Property Management
          </div>
        </div>
      `
    };

    // In production, replace this with actual email sending
    // await emailService.send(emailContent);
    
    console.log('Password reset email content prepared:', emailContent);
    
  } catch (error) {
    console.error('Error preparing password reset email:', error);
    throw error;
  }
}



