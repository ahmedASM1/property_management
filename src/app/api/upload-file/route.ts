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
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'uploads';

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file size (15MB max)
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be under 15MB' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, JPEG, PNG, WebP' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use Firebase Admin SDK if available
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
          // Try default credentials
          initializeApp({
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          });
        }
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Generate unique filename
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'bin';
      const fileName = `${folder}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      // Upload to Firebase Storage using Admin SDK (bypasses CORS)
      const bucket = getStorage().bucket();
      const storageFile = bucket.file(fileName);
      
      await storageFile.save(buffer, {
        metadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000',
        },
        public: true,
      });

      // Make file publicly accessible
      try {
        await storageFile.makePublic();
      } catch (publicError) {
        // File might already be public or permissions might be set via IAM
        console.warn('makePublic failed (may already be public):', publicError);
      }

      // Use bucket name that works for public access (firebasestorage.app for Firebase Storage)
      const bucketName = (bucket.name || '').replace('waeliweb.appspot.com', 'waeliweb.firebasestorage.app');

      // Get public URL - try signed URL first, then public URL
      let publicUrl: string;
      try {
        const [signedUrl] = await storageFile.getSignedUrl({
          action: 'read',
          expires: '03-09-2491', // Far future date
        });
        publicUrl = signedUrl;
      } catch {
        // Fallback to public URL using the correct bucket host
        publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      }

      return NextResponse.json({ 
        url: publicUrl,
        fileName: file.name,
        size: file.size,
        type: file.type
      }, { headers: corsHeaders });
    } catch (adminError) {
      console.error('Firebase Admin upload failed:', adminError);
      return NextResponse.json(
        { 
          error: 'Failed to upload file', 
          details: adminError instanceof Error ? adminError.message : 'Unknown error',
          fallback: true
        },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
