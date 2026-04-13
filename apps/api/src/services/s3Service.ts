/**
 * S3 service for handling file storage via S3-compatible storage (Minio, AWS S3, etc.)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  type BucketLocationConstraint,
} from "@aws-sdk/client-s3";
import { getS3Config, type S3Config } from "@hously/api/config";

let s3Client: S3Client | null = null;
let s3Config: S3Config | null = null;

/**
 * Get or create the S3 client
 */
function getS3Client(): S3Client | null {
  if (s3Client) {
    return s3Client;
  }

  s3Config = getS3Config();
  if (!s3Config) {
    return null;
  }

  s3Client = new S3Client({
    endpoint: s3Config.endpointUrl,
    credentials: {
      accessKeyId: s3Config.accessKey,
      secretAccessKey: s3Config.secretKey,
    },
    region: s3Config.region,
    forcePathStyle: true, // Required for Minio and other S3-compatible services
  });

  return s3Client;
}

/**
 * Ensure S3 bucket exists, create it if it doesn't
 */
async function ensureBucketExists(bucketName?: string): Promise<boolean> {
  const client = getS3Client();
  const config = getS3Config();

  if (!client || !config) {
    return false;
  }

  const bucket = bucketName || config.bucketName;

  try {
    // Check if bucket exists
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket '${bucket}' already exists`);
    return true;
  } catch (error: unknown) {
    const awsError = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    if (
      awsError.name === "NotFound" ||
      awsError.$metadata?.httpStatusCode === 404
    ) {
      // Bucket doesn't exist, create it
      console.log(`Creating bucket '${bucket}'`);
      try {
        await client.send(
          new CreateBucketCommand({
            Bucket: bucket,
            CreateBucketConfiguration: {
              LocationConstraint: config.region as BucketLocationConstraint,
            },
          }),
        );
        console.log(`Successfully created bucket '${bucket}'`);
        return true;
      } catch (createError) {
        console.error(`Failed to create bucket '${bucket}':`, createError);
        return false;
      }
    } else {
      console.error(`Error checking bucket '${bucket}':`, error);
      return false;
    }
  }
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
  fileContent: Buffer | Uint8Array,
  key: string,
  contentType?: string,
  bucketName?: string,
): Promise<boolean> {
  const client = getS3Client();
  const config = getS3Config();

  if (!client || !config) {
    console.error("S3 not configured");
    return false;
  }

  const bucket = bucketName || config.bucketName;

  try {
    // Ensure bucket exists
    if (!(await ensureBucketExists(bucket))) {
      return false;
    }

    // Upload file
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
        ContentType: contentType || "application/octet-stream",
      }),
    );

    console.log(`Successfully uploaded file to S3: ${key}`);
    return true;
  } catch (error) {
    console.error(`Failed to upload to S3:`, error);
    return false;
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(
  key: string,
  bucketName?: string,
): Promise<boolean> {
  const client = getS3Client();
  const config = getS3Config();

  if (!client || !config) {
    return false;
  }

  const bucket = bucketName || config.bucketName;

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    console.log(`Successfully deleted file from S3: ${key}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete from S3:`, error);
    return false;
  }
}

/**
 * Get a file from S3
 */
export async function getFileFromS3(
  key: string,
  bucketName?: string,
): Promise<Buffer | null> {
  const client = getS3Client();
  const config = getS3Config();

  if (!client || !config) {
    return null;
  }

  const bucket = bucketName || config.bucketName;

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      return null;
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error: unknown) {
    const awsError = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    if (
      awsError.name === "NoSuchKey" ||
      awsError.$metadata?.httpStatusCode === 404
    ) {
      console.warn(`File not found in S3: ${key}`);
    } else {
      console.error(`Failed to get file from S3:`, error);
    }
    return null;
  }
}

/**
 * Check if S3 is configured
 */
export function isS3Configured(): boolean {
  return getS3Config() !== null;
}

/**
 * Get the S3 file URL path (for serving through API)
 */
export function getS3FileUrl(key: string): string {
  return `/api/chores/image/${key}`;
}

/**
 * Get the S3 thumbnail URL path (for serving through API)
 */
export function getS3ThumbnailUrl(key: string): string {
  return `/api/chores/thumbnail/${key}`;
}

/**
 * Get the direct S3 URL for a file (for avatars and other direct access)
 */
export function getS3DirectUrl(key: string): string {
  const config = getS3Config();
  if (!config) {
    return "";
  }

  const protocol = config.useSsl ? "https" : "http";
  const endpoint = config.endpointUrl
    .replace("http://", "")
    .replace("https://", "");
  return `${protocol}://${endpoint}/${config.bucketName}/${key}`;
}
