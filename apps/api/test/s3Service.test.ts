import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from "bun:test";
import {
  uploadToS3,
  deleteFromS3,
  getFileFromS3,
  isS3Configured,
  getS3FileUrl,
  getS3ThumbnailUrl,
} from "../src/services/s3Service";

describe("S3 Service", () => {
  // Store original env values
  const originalEnv = { ...Bun.env };

  beforeEach(() => {
    // Reset S3 env vars
    Object.keys(Bun.env).forEach((key) => {
      if (key.startsWith("S3_")) {
        delete Bun.env[key];
      }
    });
  });

  afterEach(() => {
    // Restore original env
    Object.assign(Bun.env, originalEnv);
  });

  describe("isS3Configured", () => {
    it("should return false when S3 is not configured", () => {
      expect(isS3Configured()).toBe(false);
    });

    it("should return true when S3 is fully configured", () => {
      Bun.env.S3_ENDPOINT_URL = "http://localhost:9000";
      Bun.env.S3_ACCESS_KEY = "test-key";
      Bun.env.S3_SECRET_KEY = "test-secret";

      expect(isS3Configured()).toBe(true);
    });

    it("should return false when only partial S3 config exists", () => {
      Bun.env.S3_ENDPOINT_URL = "http://localhost:9000";
      // Missing access key and secret key

      expect(isS3Configured()).toBe(false);
    });
  });

  describe("getS3FileUrl", () => {
    it("should return correct URL path for file", () => {
      const url = getS3FileUrl("test-image.jpg");
      expect(url).toBe("/api/chores/image/test-image.jpg");
    });

    it("should handle filenames with special characters", () => {
      const url = getS3FileUrl("image-with-special_chars.123.png");
      expect(url).toBe("/api/chores/image/image-with-special_chars.123.png");
    });
  });

  describe("getS3ThumbnailUrl", () => {
    it("should return correct URL path for thumbnail", () => {
      const url = getS3ThumbnailUrl("test-image.jpg");
      expect(url).toBe("/api/chores/thumbnail/test-image.jpg");
    });
  });

  describe("uploadToS3", () => {
    it("should return false when S3 is not configured", async () => {
      const buffer = Buffer.from("test content");
      const result = await uploadToS3(buffer, "test.txt");
      expect(result).toBe(false);
    });
  });

  describe("deleteFromS3", () => {
    it("should return false when S3 is not configured", async () => {
      const result = await deleteFromS3("test.txt");
      expect(result).toBe(false);
    });
  });

  describe("getFileFromS3", () => {
    it("should return null when S3 is not configured", async () => {
      const result = await getFileFromS3("test.txt");
      expect(result).toBeNull();
    });
  });
});

// Integration tests - these require a running S3/Minio instance
describe("S3 Service Integration", () => {
  const originalEnv = { ...Bun.env };

  // Skip integration tests if S3 is not configured
  const skipIfNoS3 = () => {
    const hasS3 =
      Bun.env.S3_ENDPOINT_URL &&
      Bun.env.S3_ACCESS_KEY &&
      Bun.env.S3_SECRET_KEY;
    return !hasS3;
  };

  afterEach(() => {
    Object.assign(Bun.env, originalEnv);
  });

  it("should upload and retrieve file from S3", async () => {
    if (skipIfNoS3()) {
      console.log("Skipping S3 integration test - S3 not configured");
      return;
    }

    const testContent = Buffer.from("Hello, S3!");
    const testKey = `test-${Date.now()}.txt`;

    // Upload
    const uploadResult = await uploadToS3(testContent, testKey, "text/plain");
    expect(uploadResult).toBe(true);

    // Retrieve
    const retrieved = await getFileFromS3(testKey);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.toString()).toBe("Hello, S3!");

    // Clean up
    await deleteFromS3(testKey);
  });

  it("should delete file from S3", async () => {
    if (skipIfNoS3()) {
      console.log("Skipping S3 integration test - S3 not configured");
      return;
    }

    const testContent = Buffer.from("To be deleted");
    const testKey = `test-delete-${Date.now()}.txt`;

    // Upload first
    await uploadToS3(testContent, testKey, "text/plain");

    // Delete
    const deleteResult = await deleteFromS3(testKey);
    expect(deleteResult).toBe(true);

    // Verify deleted
    const retrieved = await getFileFromS3(testKey);
    expect(retrieved).toBeNull();
  });

  it("should return null for non-existent file", async () => {
    if (skipIfNoS3()) {
      console.log("Skipping S3 integration test - S3 not configured");
      return;
    }

    const result = await getFileFromS3("non-existent-file-12345.txt");
    expect(result).toBeNull();
  });
});
