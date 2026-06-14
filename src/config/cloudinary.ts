// src/config/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Cloudinary is configured either via a single CLOUDINARY_URL env var
// (cloudinary://<api_key>:<api_secret>@<cloud_name>) which the SDK reads
// automatically, or via the individual variables below.
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Folder where all uploads live (acts like the old bucket name)
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'firstmate';

/**
 * Upload a file buffer to Cloudinary.
 * Returns the secure (https) URL of the uploaded image.
 */
export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  mimetype: string,
  folder: string = 'products'
): Promise<{ url: string; publicId: string }> => {
  // Cloudinary's simple uploader accepts a data URI; for a 5MB limit this is fine.
  const dataUri = `data:${mimetype};base64,${fileBuffer.toString('base64')}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `${CLOUDINARY_FOLDER}/${folder}`,
    resource_type: 'image',
  });

  return { url: result.secure_url, publicId: result.public_id };
};

/**
 * Delete a file from Cloudinary by its public_id.
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
};

/**
 * Extract the Cloudinary public_id from a delivery URL.
 * e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/firstmate/products/abc.jpg
 *      -> firstmate/products/abc
 */
export const getPublicIdFromUrl = (url: string): string | null => {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

export { cloudinary, CLOUDINARY_FOLDER };
