import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { sendEmailWithSendGrid } from '@/lib/email-sendgrid';
import { sendEmailWithAWSSES } from '@/lib/email-aws-ses';
import { sendEmailWithNodemailer } from '@/lib/email-nodemailer';
import { getVerificationEmailHtml } from '@/lib/email-templates';

const TOKEN_EXPIRY_HOURS = 24;
const VERIFY_COLLECTION = 'emailVerificationTokens';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, fullName } = body as { idToken?: string; fullName?: string };

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    const hasEmailService =
      !!process.env.SENDGRID_API_KEY ||
      (!!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY) ||
      (!!process.env.SMTP_USER && !!process.env.SMTP_PASS);
    if (!hasEmailService) {
      return NextResponse.json(
        {
          error:
            'Email is not configured. Add SENDGRID_API_KEY, or AWS SES (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY), or SMTP (SMTP_USER, SMTP_PASS) to .env.local or Vercel.',
        },
        { status: 500 }
      );
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;
    if (!email) {
      return NextResponse.json({ error: 'Email not found for user' }, { status: 400 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    const db = getAdminFirestore();
    await db.collection(VERIFY_COLLECTION).doc(token).set({
      uid,
      email,
      fullName: fullName || '',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://greenbridge-my.com';
    const verifyLink = `${baseUrl}/auth/verify-email?token=${token}`;
    const html = getVerificationEmailHtml(fullName || '', verifyLink, TOKEN_EXPIRY_HOURS);
    const emailData = {
      to: email,
      subject: 'Verify your email – Green Bridge',
      html,
    };

    let sent = false;
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sendEmailWithSendGrid(emailData);
        sent = true;
      } catch (e) {
        console.error('SendGrid verification email failed:', e);
      }
    }
    if (!sent && process.env.AWS_ACCESS_KEY_ID) {
      try {
        await sendEmailWithAWSSES(emailData);
        sent = true;
      } catch (e) {
        console.error('AWS SES verification email failed:', e);
      }
    }
    if (!sent && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await sendEmailWithNodemailer(emailData);
        sent = true;
      } catch (e) {
        console.error('Nodemailer verification email failed:', e);
      }
    }

    if (!sent) {
      return NextResponse.json(
        { error: 'No email service configured. Add SENDGRID_API_KEY, or AWS SES credentials, or SMTP_USER and SMTP_PASS in your environment (e.g. .env.local or Vercel).' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Send verification email error:', err);
    const message = err.message || 'Failed to send verification email';
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        error: isDev ? message : 'Failed to send verification email',
        ...(isDev && { detail: err.message }),
      },
      { status: 500 }
    );
  }
}
