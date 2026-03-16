import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminBucket } from '@/lib/firebase-admin';

const MAX_PHOTO_COUNT = 10;
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

function sanitizeFilename(filename: string, index: number) {
  const trimmed = filename.trim().toLowerCase();
  const safe = trimmed.replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-');
  return `${index}-${safe || `photo-${index}.jpg`}`;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const formData = await request.formData();
    const files = formData
      .getAll('photos')
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No photos were provided.' }, { status: 400 });
    }

    if (files.length > MAX_PHOTO_COUNT) {
      return NextResponse.json(
        { error: `A maximum of ${MAX_PHOTO_COUNT} photos can be uploaded.` },
        { status: 400 }
      );
    }

    const bucket = getAdminBucket();
    const timestamp = Date.now();

    const photoUrls = await Promise.all(
      files.map(async (file, index) => {
        if (!file.type.startsWith('image/')) {
          throw new Error('Only image uploads are allowed.');
        }

        if (file.size > MAX_PHOTO_SIZE_BYTES) {
          throw new Error('Each photo must be 10 MB or smaller.');
        }

        const objectPath = `estimates/${decodedToken.uid}/${timestamp}/${sanitizeFilename(file.name, index)}`;
        const bucketFile = bucket.file(objectPath);
        const buffer = Buffer.from(await file.arrayBuffer());

        await bucketFile.save(buffer, {
          resumable: false,
          public: true,
          metadata: {
            contentType: file.type || 'application/octet-stream',
            cacheControl: 'public, max-age=31536000, immutable',
          },
        });

        const bucketName = bucket.name;
        const encodedPath = encodeURIComponent(objectPath);
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;

        return downloadUrl;
      })
    );

    return NextResponse.json({ photoUrls });
  } catch (error: any) {
    console.error('Estimate photo upload failed:', error);

    return NextResponse.json(
      { error: error?.message || 'Failed to upload photos.' },
      { status: 500 }
    );
  }
}
