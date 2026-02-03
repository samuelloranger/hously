/**
 * Configuration utilities for loading environment variables
 */

export interface AccessControl {
  adminEmails: string[];
  allowedEmails: string[];
}

/**
 * Load access control configuration from environment variables
 */
export function loadAccessControl(): AccessControl {
  const config: AccessControl = {
    adminEmails: [],
    allowedEmails: [],
  };

  // Load from environment variables
  const adminEmailsStr = Bun.env.ADMIN_EMAILS || "";
  if (adminEmailsStr) {
    config.adminEmails = adminEmailsStr.split(",").map((email) => email.trim());
  }

  const allowedEmailsStr = Bun.env.ALLOWED_EMAILS || "";
  if (allowedEmailsStr) {
    config.allowedEmails = allowedEmailsStr
      .split(",")
      .map((email) => email.trim());
  }

  // If no allowed emails specified, use admin emails
  if (config.allowedEmails.length === 0) {
    config.allowedEmails = config.adminEmails;
  }

  return config;
}

/**
 * Get base URL for the application
 */
export function getBaseUrl(): string {
  return Bun.env.BASE_URL || "http://localhost:5173";
}

/**
 * S3 configuration interface
 */
export interface S3Config {
  endpointUrl: string;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  region: string;
  useSsl: boolean;
}

/**
 * Get S3 configuration from environment variables
 * Returns null if S3 is not configured
 */
export function getS3Config(): S3Config | null {
  const endpointUrl = Bun.env.S3_ENDPOINT_URL;
  const accessKey = Bun.env.S3_ACCESS_KEY;
  const secretKey = Bun.env.S3_SECRET_KEY;

  // All three are required for S3 to be enabled
  if (!endpointUrl || !accessKey || !secretKey) {
    return null;
  }

  return {
    endpointUrl,
    accessKey,
    secretKey,
    bucketName: Bun.env.S3_BUCKET_NAME || "hously-images",
    region: Bun.env.S3_REGION || "us-east-1",
    useSsl: (Bun.env.S3_USE_SSL || "true").toLowerCase() === "true",
  };
}
