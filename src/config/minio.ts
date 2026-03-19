// src/config/minio.ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const MINIO_REGION = process.env.MINIO_REGION || 'us-east-1';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'alfath-skin';
const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER || 'minioadmin';
const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD || 'minioadmin';
const MINIO_PRIVATE_ENDPOINT = process.env.MINIO_PRIVATE_ENDPOINT || 'http://localhost:9000';
const MINIO_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT || MINIO_PRIVATE_ENDPOINT;

export const s3Client = new S3Client({
  endpoint: MINIO_PRIVATE_ENDPOINT,
  region: MINIO_REGION,
  credentials: {
    accessKeyId: MINIO_ROOT_USER,
    secretAccessKey: MINIO_ROOT_PASSWORD,
  },
  forcePathStyle: true, // Required for MinIO
});

/**
 * Initialize MinIO: create bucket if not exists + set public read policy
 */
export const initMinio = async (): Promise<void> => {
  try {
    console.log('🔄 Checking MinIO bucket...');

    // Check if bucket exists
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
      console.log(`✅ MinIO bucket "${MINIO_BUCKET}" already exists`);
    } catch {
      // Bucket doesn't exist, create it
      console.log(`📦 Creating MinIO bucket "${MINIO_BUCKET}"...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
      console.log(`✅ MinIO bucket "${MINIO_BUCKET}" created`);
    }

    // Set public read policy so browsers can load images
    const publicPolicy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`],
        },
      ],
    });

    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: MINIO_BUCKET,
        Policy: publicPolicy,
      })
    );
    console.log(`✅ MinIO bucket "${MINIO_BUCKET}" set to public read`);
  } catch (error) {
    console.error('❌ MinIO initialization failed:', error);
    // Don't throw - let server start even if MinIO is temporarily unavailable
  }
};

/**
 * Upload a file to MinIO
 */
export const uploadToMinio = async (
  fileBuffer: Buffer,
  key: string,
  mimetype: string
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  });

  await s3Client.send(command);

  // Return public URL
  return `${MINIO_PUBLIC_ENDPOINT}/${MINIO_BUCKET}/${key}`;
};

/**
 * Delete a file from MinIO
 */
export const deleteFromMinio = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
};

/**
 * Extract the object key from a MinIO URL
 */
export const getKeyFromUrl = (url: string): string | null => {
  try {
    const bucketPrefix = `/${MINIO_BUCKET}/`;
    const idx = url.indexOf(bucketPrefix);
    if (idx !== -1) {
      return url.substring(idx + bucketPrefix.length);
    }
    return null;
  } catch {
    return null;
  }
};

export { MINIO_BUCKET, MINIO_PUBLIC_ENDPOINT };
