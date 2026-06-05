import { NextRequest, NextResponse } from 'next/server';

import {
  canMutateEstimate,
  type ExistingEstimateSnapshot,
} from '@/domains/estimate/application/lifecycle/estimate-lifecycle';
import { getAdminAuth, getAdminBucket, getAdminDb } from '@/lib/firebase-admin';

const MAX_PHOTO_COUNT = 10;
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function sanitizeFilename(filename: string, index: number) {
  const trimmed = filename.trim().toLowerCase();
  const safe = trimmed.replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-');
  return `${index}-${safe || `photo-${index}.jpg`}`;
}

function getObjectOwnerUid(objectPath: string) {
  const match = /^estimates\/([^/]+)\//.exec(objectPath);
  return match?.[1];
}

function buildPhotoObjectPath(args: {
  uid: string;
  estimateId?: string;
  timestamp: number;
  filename: string;
  index: number;
}) {
  const safeFilename = sanitizeFilename(args.filename, args.index);
  return args.estimateId
    ? `estimates/${args.uid}/${args.estimateId}/${args.timestamp}-${safeFilename}`
    : `estimates/${args.uid}/${args.timestamp}/${safeFilename}`;
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
  } catch (error: unknown) {
    console.error('Estimate photo download failed:', error);
    const message = getErrorMessage(error, 'Failed to download photo.');

    return NextResponse.json(
      { error: message },
      { status: message === 'Authentication is required.' ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const uploadedPaths: string[] = [];

  try {
    const decodedToken = await verifyRequestToken(request);
    const formData = await request.formData();
    const estimateIdValue = formData.get('estimateId');
    const estimateId =
      typeof estimateIdValue === 'string' && estimateIdValue.trim().length > 0
        ? estimateIdValue.trim()
        : undefined;
    const files = formData
      .getAll('photos')
      .filter((value): value is File => value instanceof File);

    if (estimateId?.includes('/')) {
      return NextResponse.json({ error: 'Invalid estimate ID.' }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No photos were provided.' }, { status: 400 });
    }

    if (files.length > MAX_PHOTO_COUNT) {
      return NextResponse.json(
        { error: `A maximum of ${MAX_PHOTO_COUNT} photos can be uploaded.` },
        { status: 400 }
      );
    }

    if (estimateId) {
      const snapshot = await getAdminDb().collection('estimates').doc(estimateId).get();
      const existing = snapshot.data() as ExistingEstimateSnapshot | undefined;
      const isAdmin = decodedToken.admin === true;

      if (!snapshot.exists || !existing || !canMutateEstimate(existing, decodedToken.uid, isAdmin)) {
        return NextResponse.json(
          { error: 'You do not have permission to upload photos to this estimate.' },
          { status: 403 }
        );
      }
    }

    const bucket = getAdminBucket();
    const timestamp = Date.now();

    for (const [index, file] of files.entries()) {
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image uploads are allowed.');
      }

      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        throw new Error('Each photo must be 10 MB or smaller.');
      }

      const objectPath = buildPhotoObjectPath({
        uid: decodedToken.uid,
        estimateId,
        timestamp,
        filename: file.name,
        index,
      });
      const bucketFile = bucket.file(objectPath);
      const buffer = Buffer.from(await file.arrayBuffer());

      await bucketFile.save(buffer, {
        resumable: false,
        metadata: {
          contentType: file.type || 'application/octet-stream',
          cacheControl: 'private, max-age=3600',
        },
      });
      uploadedPaths.push(objectPath);
    }

    return NextResponse.json({ photoPaths: uploadedPaths });
  } catch (error: unknown) {
    if (uploadedPaths.length > 0) {
      try {
        const bucket = getAdminBucket();
        await Promise.all(
          uploadedPaths.map((objectPath) =>
            bucket.file(objectPath).delete({ ignoreNotFound: true })
          )
        );
      } catch (cleanupError) {
        console.error('Estimate photo upload rollback failed:', cleanupError);
      }
    }

    console.error('Estimate photo upload failed:', error);
    const message = getErrorMessage(error, 'Failed to upload photos.');

    return NextResponse.json(
      { error: message },
      { status: message === 'Authentication is required.' ? 401 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const decodedToken = await verifyRequestToken(request);
    const payload = (await request.json().catch(() => null)) as { photoPaths?: unknown } | null;
    const photoPaths = Array.isArray(payload?.photoPaths)
      ? payload.photoPaths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
      : [];

    if (photoPaths.length === 0) {
      return NextResponse.json({ error: 'Photo paths are required.' }, { status: 400 });
    }

    if (photoPaths.length > MAX_PHOTO_COUNT) {
      return NextResponse.json(
        { error: `A maximum of ${MAX_PHOTO_COUNT} photos can be deleted at once.` },
        { status: 400 }
      );
    }

    const isAdmin = decodedToken.admin === true;
    for (const objectPath of photoPaths) {
      const ownerUid = getObjectOwnerUid(objectPath);
      if (!ownerUid) {
        return NextResponse.json({ error: 'Invalid photo path.' }, { status: 400 });
      }

      if (!isAdmin && decodedToken.uid !== ownerUid) {
        return NextResponse.json({ error: 'You are not allowed to delete this photo.' }, { status: 403 });
      }
    }

    const bucket = getAdminBucket();
    await Promise.all(
      photoPaths.map((objectPath) =>
        bucket.file(objectPath).delete({ ignoreNotFound: true })
      )
    );

    return NextResponse.json({ deleted: photoPaths.length });
  } catch (error: unknown) {
    console.error('Estimate photo cleanup failed:', error);
    const message = getErrorMessage(error, 'Failed to clean up photos.');

    return NextResponse.json(
      { error: message },
      { status: message === 'Authentication is required.' ? 401 : 500 }
    );
  }
}
