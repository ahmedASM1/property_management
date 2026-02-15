import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

const VERIFY_COLLECTION = 'emailVerificationTokens';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const tokenDoc = await db.collection(VERIFY_COLLECTION).doc(token).get();
    if (!tokenDoc.exists) {
      return NextResponse.json({ error: 'Invalid or expired verification link' }, { status: 400 });
    }

    const data = tokenDoc.data();
    if (!data?.uid || !data?.email) {
      return NextResponse.json({ error: 'Invalid token data' }, { status: 400 });
    }

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && expiresAt < new Date()) {
      await db.collection(VERIFY_COLLECTION).doc(token).delete();
      return NextResponse.json({ error: 'Verification link has expired' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    await adminAuth.updateUser(data.uid, { emailVerified: true });

    await db.collection('users').doc(data.uid).update({
      emailVerified: true,
      updatedAt: new Date().toISOString(),
    });

    await db.collection(VERIFY_COLLECTION).doc(token).delete();

    return NextResponse.json({
      success: true,
      message: 'Your email has been verified. You can sign in once an administrator approves your registration.',
    });
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json(
      { error: 'Verification failed. The link may be invalid or expired.' },
      { status: 500 }
    );
  }
}
