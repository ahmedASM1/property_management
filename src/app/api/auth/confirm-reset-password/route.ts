import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, userId, newPassword } = body as { token?: string; userId?: string; newPassword?: string };

    if (!token || !userId || !newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: 'Token, userId, and newPassword are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8 || newPassword.length > 15) {
      return NextResponse.json(
        { error: 'Password must be 8–15 characters' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const storedToken = userData?.passwordResetToken;
    const expiresAt = userData?.passwordResetExpires ? new Date(userData.passwordResetExpires) : null;

    if (!storedToken || storedToken !== token) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }
    if (expiresAt && expiresAt < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    await adminAuth.updateUser(userId, { password: newPassword });

    await db.collection('users').doc(userId).update({
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('Confirm reset password error:', error);
    return NextResponse.json(
      { error: 'Failed to update password. Please try again or request a new reset link.' },
      { status: 500 }
    );
  }
}
