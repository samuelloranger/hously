/**
 * Image service for handling image uploads and thumbnail generation
 */

import sharp from "sharp";
import {
  uploadToS3,
  deleteFromS3,
  getFileFromS3,
  isS3Configured,
  getS3DirectUrl,
} from "./s3Service";
import { getBaseUrl } from "../utils/config";

// Allowed image extensions
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

// Thumbnail size
const THUMBNAIL_SIZE = 48;

/**
 * Check if file extension is allowed
 */
export function isAllowedFile(filename: string): boolean {
  if (!filename.includes(".")) return false;
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? ALLOWED_EXTENSIONS.has(ext) : false;
}

/**
 * Get content type from filename
 */
export function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/**
 * Save uploaded image and create thumbnail
 * Uploads to S3 if configured
 */
export async function saveImageAndCreateThumbnail(file: File): Promise<string> {
  if (!file || !isAllowedFile(file.name)) {
    throw new Error("Invalid file type. Only images are allowed.");
  }

  if (!isS3Configured()) {
    throw new Error("S3 storage is not configured");
  }

  // Generate unique filename
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const uniqueFilename = `${crypto.randomUUID().replace(/-/g, "")}.${fileExt}`;

  try {
    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Get content type
    const contentType = getContentType(file.name);

    // Upload original image to S3
    const uploadSuccess = await uploadToS3(
      imageBuffer,
      uniqueFilename,
      contentType,
    );
    if (!uploadSuccess) {
      throw new Error("Failed to upload image to S3");
    }

    // Create thumbnail using sharp
    // Sharp automatically handles EXIF orientation
    const thumbnailBuffer = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: "cover",
        position: "center",
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // Convert transparency to white
      .jpeg({ quality: 85 })
      .toBuffer();

    // Upload thumbnail to S3
    const thumbnailSuccess = await uploadToS3(
      thumbnailBuffer,
      `thumbnail-${uniqueFilename}`,
      "image/jpeg",
    );

    if (!thumbnailSuccess) {
      // If thumbnail upload fails, try to delete the original image
      await deleteFromS3(uniqueFilename);
      throw new Error("Failed to upload thumbnail to S3");
    }

    console.log(`Uploaded image and thumbnail to S3: ${uniqueFilename}`);
    return uniqueFilename;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw new Error(`Error uploading image: ${error}`);
  }
}

/**
 * Delete image and thumbnail files from S3
 */
export async function deleteImageFiles(imageName: string): Promise<void> {
  if (!imageName) return;

  // Delete original image
  await deleteFromS3(imageName);
  // Delete thumbnail
  await deleteFromS3(`thumbnail-${imageName}`);
}

/**
 * Get image from S3
 */
export async function getImage(filename: string): Promise<Buffer | null> {
  return getFileFromS3(filename);
}

/**
 * Get thumbnail from S3
 */
export async function getThumbnail(filename: string): Promise<Buffer | null> {
  return getFileFromS3(`thumbnail-${filename}`);
}

/**
 * Get the full URL for an avatar image (served through API, not direct S3)
 */
export function getAvatarUrl(filename: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/users/avatar/${filename}`;
}
