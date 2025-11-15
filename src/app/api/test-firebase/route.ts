import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(req: NextRequest) {
  try {
    console.log('=== FIREBASE CONNECTION TEST ===');
    
    // Test basic connection
    console.log('Testing Firebase connection...');
    console.log('Firebase app:', db.app.name);
    console.log('Firebase project ID:', db.app.options.projectId);
    
    // Test reading from users collection
    console.log('Testing users collection read...');
    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);
    console.log('Users collection exists:', usersSnapshot.size, 'documents found');
    
    // Test reading a specific document (if any exist)
    if (usersSnapshot.size > 0) {
      const firstDoc = usersSnapshot.docs[0];
      console.log('First user document ID:', firstDoc.id);
      console.log('First user document data:', firstDoc.data());
      
      // Test reading by document reference
      const userDocRef = doc(db, 'users', firstDoc.id);
      const userDoc = await getDoc(userDocRef);
      console.log('Document read by reference:', userDoc.exists());
    }
    
    console.log('=== FIREBASE TEST COMPLETED SUCCESSFULLY ===');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Firebase connection test successful',
      projectId: db.app.options.projectId,
      usersCount: usersSnapshot.size,
      firstUserId: usersSnapshot.size > 0 ? usersSnapshot.docs[0].id : null
    });

  } catch (error) {
    console.error('=== FIREBASE TEST FAILED ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json({ 
      error: 'Firebase connection test failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

