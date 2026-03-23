import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminBucket } from '@/lib/firebase-admin';

const MAX_PHOTO_COUNT = 10;
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

function sanitizeFilename(filename: string, index: number) {
  const trimmed = filename.trim().toLowerCase();
  const safe = trimmed.replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-');
  return `${index}-${safe || `photo-${index}.jpg`}`;
}

function getObjectOwnerUid(objectPath: string) {
  const match = /^estimates\/([^/]+)\//.exec(objectPath);
  return match?.[1];
}

async function verifyRequestToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Authentication is required.');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  return getAdminAuth().verifyIdToken(idToken);
}

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyRequestToken(request);
    const objectPath = request.nextUrl.searchParams.get('path')?.trim();

    if (!objectPath) {
      return NextResponse.json({ error: 'Photo path is required.' }, { status: 400 });
    }

    const ownerUid = getObjectOwnerUid(objectPath);
    if (!ownerUid) {
      return NextResponse.json({ error: 'Invalid photo path.' }, { status: 400 });
    }

    const isAdmin = decodedToken.admin === true;
    if (!isAdmin && decodedToken.uid !== ownerUid) {
      return NextResponse.json({ error: 'You are not allowed to access this photo.' }, { status: 403 });
    }

    const bucketFile = getAdminBucket().file(objectPath);
    const [exists] = await bucketFile.exists();
    if (!exists) {
      return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
    }

    const [metadata, buffer] = await Promise.all([
      bucketFile.getMetadata().then(([fileMetadata]) => fileMetadata),
      bucketFile.download().then(([fileBuffer]) => fileBuffer),
    ]);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': metadata.contentType || 'application/octet-stream',
      },
    });
  } catch (error: any) {
    console.error('Estimate photo download failed:', error);

    return NextResponse.json(
      { error: error?.message || 'Failed to download photo.' },
      { status: error?.message === 'Authentication is required.' ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await verifyRequestToken(request);
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

    const photoPaths = await Promise.all(
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
          metadata: {
            contentType: file.type || 'application/octet-stream',
            cacheControl: 'private, max-age=3600',
          },
        });

        return objectPath;
      })
    );

    return NextResponse.json({ photoPaths });
  } catch (error: any) {
    console.error('Estimate photo upload failed:', error);

    return NextResponse.json(
      { error: error?.message || 'Failed to upload photos.' },
      { status: error?.message === 'Authentication is required.' ? 401 : 500 }
    );
  }
}
