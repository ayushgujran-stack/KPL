import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return new Response('File not found', { status: 404 });
    }

    // Extract filename and sanitize
    const filename = pathSegments[pathSegments.length - 1].replace(/[^a-zA-Z0-9._-]/g, '');
    if (!filename) {
      return new Response('Invalid filename', { status: 400 });
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      webp: 'image/webp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      svg: 'image/svg+xml',
    };
    let contentType = ext ? contentTypeMap[ext] || 'image/jpeg' : 'image/jpeg';

    // 1. Check local public/uploads directory
    const publicDiskPath = path.join(process.cwd(), 'public', 'uploads', ...pathSegments);
    if (fs.existsSync(publicDiskPath)) {
      const fileBuffer = fs.readFileSync(publicDiskPath);
      return new Response(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 2. Check /tmp/uploads directory (used in serverless environments)
    const tmpDiskPath = path.join('/tmp', 'uploads', ...pathSegments);
    if (fs.existsSync(tmpDiskPath)) {
      const fileBuffer = fs.readFileSync(tmpDiskPath);
      return new Response(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 3. Fallback to SQLite uploaded_media database store
    try {
      const mediaRecord = db
        .prepare('SELECT mime_type, data FROM uploaded_media WHERE filename = ?')
        .get(filename) as { mime_type: string; data: Buffer } | undefined;

      if (mediaRecord && mediaRecord.data) {
        contentType = mediaRecord.mime_type || contentType;

        // Optionally cache to /tmp for faster future reads
        try {
          const cacheDir = path.dirname(tmpDiskPath);
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
          }
          fs.writeFileSync(tmpDiskPath, mediaRecord.data);
        } catch {}

        return new Response(new Uint8Array(mediaRecord.data), {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    } catch (dbErr) {
      console.warn('Database media lookup error:', dbErr);
    }

    // 4. If media not found, serve default player avatar
    const defaultAvatarPath = path.join(process.cwd(), 'public', 'default-player-avatar.svg');
    if (fs.existsSync(defaultAvatarPath)) {
      const avatarBuffer = fs.readFileSync(defaultAvatarPath);
      return new Response(new Uint8Array(avatarBuffer), {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new Response('Not found', { status: 404 });
  } catch (error: any) {
    console.error('Error serving uploaded media:', error);
    return new Response('Error loading image', { status: 500 });
  }
}
