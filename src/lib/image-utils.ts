/**
 * Image processing and validation utilities for KPL Player Photos.
 */

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const DEFAULT_PLAYER_AVATAR = '/default-player-avatar.svg';

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: File): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // Type validation
  const fileType = file.type.toLowerCase();
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];

  const isTypeValid = ALLOWED_IMAGE_TYPES.includes(fileType) || (fileExtension && validExtensions.includes(fileExtension));

  if (!isTypeValid) {
    return {
      valid: false,
      error: `Unsupported file format (${file.type || fileExtension || 'unknown'}). Please upload a JPG, JPEG, PNG, or WEBP photo.`,
    };
  }

  // Size validation (Max 5MB)
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeInMB} MB) exceeds the 5 MB maximum limit. Please select a smaller photo.`,
    };
  }

  return { valid: true };
}

/**
 * Automatically resizes and compresses player photos to an optimal high-quality web format.
 * Limits max dimensions to 800x800 while preserving native aspect ratio to prevent face distortion.
 */
export async function compressPlayerPhoto(
  file: File,
  maxDimension: number = 800,
  quality: number = 0.88
): Promise<{ file: File; dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    // If running in an environment without DOM/Image, fallback to original
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve({ file, dataUrl: '', width: 0, height: 0 });
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;

      // Scale down proportionally if larger than maxDimension
      if (targetWidth > maxDimension || targetHeight > maxDimension) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
          targetWidth = maxDimension;
        } else {
          targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
          targetHeight = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve({ file, dataUrl: objectUrl, width: targetWidth, height: targetHeight });
      }

      // Smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Prefer WebP for superior compression, fallback to JPEG
      const outputType = 'image/webp';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve({ file, dataUrl: canvas.toDataURL(outputType, quality), width: targetWidth, height: targetHeight });
          }

          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'photo';
          const compressedFile = new File([blob], `${baseName}.webp`, {
            type: outputType,
            lastModified: Date.now(),
          });

          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve({
            file: compressedFile,
            dataUrl,
            width: targetWidth,
            height: targetHeight,
          });
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for processing. The file may be corrupt.'));
    };

    img.src = objectUrl;
  });
}
