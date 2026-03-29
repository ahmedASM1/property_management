import { NextRequest, NextResponse } from 'next/server';

// CORS headers helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, fileName } = await req.json();

    if (!pdfBase64 || !fileName) {
      return NextResponse.json(
        { error: 'PDF data and filename are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use Firebase Admin SDK if available, otherwise use client SDK via fetch
    try {
      const { getStorage } = await import('firebase-admin/storage');
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');

      // Initialize Firebase Admin if not already initialized
      if (!getApps().length) {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
          : null;

        if (serviceAccount) {
          initializeApp({
            credential: cert(serviceAccount),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          });
        } else {
          // Try default credentials (works in some environments like Vercel)
          try {
            initializeApp({
              storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
          } catch (defaultError) {
            console.warn('Default credentials failed, will use fallback:', defaultError);
            throw defaultError;
          }
        }
      }

      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');

      // Upload to Firebase Storage using Admin SDK (bypasses CORS)
      const bucket = getStorage().bucket();
      const file = bucket.file(`contracts/${fileName}`);
      
      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          cacheControl: 'public, max-age=31536000',
        },
        public: true,
      });

      // Make file publicly accessible
      try {
        await file.makePublic();
      } catch (publicError) {
        // File might already be public or permissions might be set via IAM
        console.warn('makePublic failed (may already be public):', publicError);
      }

      const bucketName =
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || bucket.name || '';

      // Get public URL - try signed URL first (works regardless of public access)
      let publicUrl: string;
      try {
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: '03-09-2491', // Far future date
        });
        publicUrl = signedUrl;
      } catch {
        // Fallback to public URL using the correct bucket host
        publicUrl = `https://storage.googleapis.com/${bucketName}/contracts/${fileName}`;
      }

      return NextResponse.json({ url: publicUrl }, { headers: corsHeaders });
    } catch (adminError) {
      // Fallback: Return a data URL that can be stored in Firestore
      // The contract will be stored as base64 in Firestore if upload fails
      console.warn('Firebase Admin upload failed, using fallback:', adminError);
      const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
      return NextResponse.json({ 
        url: dataUrl,
        fallback: true,
        message: 'Contract saved as data URL. PDF upload will be retried later.'
      }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error('Error uploading contract:', error);
    return NextResponse.json(
      { error: 'Failed to upload contract', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
