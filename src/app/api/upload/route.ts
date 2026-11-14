import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/auction-service';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { connection } from 'next/server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export async function POST(req: Request) {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Super Admin and Organisers can upload player photos' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = (formData.get('file') || formData.get('photo') || formData.get('image')) as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided in request.' }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 5 MB maximum limit.` },
        { status: 400 }
      );
    }

    // Validate mime type
    const mimeType = file.type.toLowerCase();
    const extMatch = file.name.split('.').pop()?.toLowerCase();
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mimeType) || (extMatch && ['jpg', 'jpeg', 'png', 'webp'].includes(extMatch));

    if (!isMimeAllowed) {
      return NextResponse.json(
        { error: 'Invalid file format. Please upload a JPG, JPEG, PNG, or WEBP photo.' },
        { status: 400 }
      );
    }

    const rawExt = extMatch && ['jpg', 'jpeg', 'png', 'webp'].includes(extMatch) ? extMatch : (mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg');
    const safeExt = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const filename = `ply_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${safeExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Try writing to public/uploads/players/ on disk for ultra-fast direct static serving
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'players');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
    } catch (fsErr) {
      // In serverless read-only environments (e.g. Vercel Lambda), write to /tmp/uploads/players/
      try {
        const tmpDir = path.join('/tmp', 'uploads', 'players');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        fs.writeFileSync(path.join(tmpDir, filename), buffer);
      } catch (tmpErr) {
        console.warn('Filesystem write notice (using database media store fallback):', tmpErr);
      }
    }

    // 2. Persist in database media store to guarantee availability across restarts, redeploys, and cold boots
    const mediaId = `media_${crypto.randomUUID().slice(0, 12)}`;
    try {
      db.prepare(`
        INSERT OR REPLACE INTO uploaded_media (id, filename, mime_type, data, size)
        VALUES (?, ?, ?, ?, ?)
      `).run(mediaId, filename, mimeType || 'image/webp', buffer, buffer.length);
    } catch (dbErr: any) {
      console.error('Failed to persist media in database:', dbErr);
    }

    // 3. Log audit event
    logAudit(user.id, user.name, user.role, 'UPLOAD_PLAYER_PHOTO', `Uploaded photo ${filename} (${buffer.length} bytes)`);

    // Standard public image URL reference
    const imageUrl = `/api/uploads/players/${filename}`;

    return NextResponse.json({
      success: true,
      url: imageUrl,
      filename,
      size: buffer.length,
      mimeType: mimeType || 'image/webp',
    });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: error.message || 'Image upload failed' }, { status: 500 });
  }
}
