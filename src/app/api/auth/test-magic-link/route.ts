import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    console.log('=== TEST MAGIC LINK API ===');
    
    const { email, userId } = await req.json();
    console.log('Request data:', { email, userId });

    if (!email || !userId) {
      console.log('Missing required fields');
      return NextResponse.json({ error: 'Email and userId are required' }, { status: 400 });
    }

    // Test Firebase connection
    console.log('Testing Firebase connection...');
    const userDocRef = doc(db, 'users', userId);
    console.log('User document reference created:', userDocRef.path);
    
    const userDoc = await getDoc(userDocRef);
    console.log('User document exists:', userDoc.exists());
    
    if (!userDoc.exists()) {
      console.log('User document not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('User document data:', userDoc.data());

    // Test token generation
    console.log('Generating token...');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    console.log('Token generated:', token.substring(0, 10) + '...');
    console.log('Expires at:', expiresAt.toISOString());

    // Test document update
    console.log('Updating user document...');
    await updateDoc(userDocRef, {
      magicLinkToken: token,
      magicLinkExpires: expiresAt.toISOString(),
      updatedAt: new Date().toISOString()
    });
    console.log('User document updated successfully');

    // Test magic link creation
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/magic-link?token=${token}&userId=${userId}`;
    console.log('Magic link created:', magicLink);

    console.log('=== TEST COMPLETED SUCCESSFULLY ===');

    return NextResponse.json({ 
      success: true, 
      message: 'Test completed successfully',
      magicLink: magicLink,
      userId: userId,
      email: email
    });

  } catch (error) {
    console.error('=== TEST FAILED ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json({ 
      error: 'Test failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

