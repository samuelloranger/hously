import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  getS3Config,
  getBaseUrl,
  loadConfig,
  resetConfig,
} from "../src/config";

describe("Config", () => {
  const originalEnv = { ...Bun.env };

  beforeEach(() => {
    resetConfig();
    Object.keys(Bun.env).forEach((key) => {
      if (key.startsWith("S3_")) {
        delete Bun.env[key];
      }
    });
  });

  afterEach(() => {
    resetConfig();
    Object.assign(Bun.env, originalEnv);
  });

  describe("getS3Config", () => {
    it("should return null when S3 is not configured", () => {
      delete Bun.env.S3_ENDPOINT_URL;
      delete Bun.env.S3_ACCESS_KEY;
      delete Bun.env.S3_SECRET_KEY;

      const config = getS3Config();
      expect(config).toBeNull();
    });

    it("should return null when endpoint URL is missing", () => {
      delete Bun.env.S3_ENDPOINT_URL;
      Bun.env.S3_ACCESS_KEY = "test-key";
      Bun.env.S3_SECRET_KEY = "test-secret";

      const config = getS3Config();
      expect(config).toBeNull();
    });

    it("should return null when access key is missing", () => {
      Bun.env.S3_ENDPOINT_URL = "http://localhost:9000";
      delete Bun.env.S3_ACCESS_KEY;
      Bun.env.S3_SECRET_KEY = "test-secret";

      const config = getS3Config();
      expect(config).toBeNull();
    });

    it("should return null when secret key is missing", () => {
      Bun.env.S3_ENDPOINT_URL = "http://localhost:9000";
      Bun.env.S3_ACCESS_KEY = "test-key";
      delete Bun.env.S3_SECRET_KEY;

      const config = getS3Config();
      expect(config).toBeNull();
    });

    it("should return config with all required values", () => {
      Bun.env.S3_ENDPOINT_URL = "http://localhost:9000";
      Bun.env.S3_ACCESS_KEY = "test-key";
      Bun.env.S3_SECRET_KEY = "test-secret";

      const config = getS3Config();
      expect(config).not.toBeNull();
      expect(config?.endpointUrl).toBe("http://localhost:9000");
      expect(config?.accessKey).toBe("test-key");
      expect(config?.secretKey).toBe("test-secret");
    });

    it("should use default values for optional fields", () => {
      Bun.env.S3_ENDPOINT_URL = "http://localhost:9000";
      Bun.env.S3_ACCESS_KEY = "test-key";
      Bun.env.S3_SECRET_KEY = "test-secret";

      const config = getS3Config();
      expect(config?.bucketName).toBe("hously-images");
      expect(config?.region).toBe("us-east-1");
      expect(config?.useSsl).toBe(true);
    });

    it("should use custom values for optional fields when provided", () => {
      Bun.env.S3_ENDPOINT_URL = "http://localhost:9000";
      Bun.env.S3_ACCESS_KEY = "test-key";
      Bun.env.S3_SECRET_KEY = "test-secret";
      Bun.env.S3_BUCKET_NAME = "custom-bucket";
      Bun.env.S3_REGION = "eu-west-1";
      Bun.env.S3_USE_SSL = "false";

      const config = getS3Config();
      expect(config?.bucketName).toBe("custom-bucket");
      expect(config?.region).toBe("eu-west-1");
      expect(config?.useSsl).toBe(false);
    });

    it("should parse S3_USE_SSL case-insensitively", () => {
      Bun.env.S3_ENDPOINT_URL = "http://localhost:9000";
      Bun.env.S3_ACCESS_KEY = "test-key";
      Bun.env.S3_SECRET_KEY = "test-secret";
      Bun.env.S3_USE_SSL = "FALSE";

      const config = getS3Config();
      expect(config?.useSsl).toBe(false);

      Bun.env.S3_USE_SSL = "True";
      const config2 = getS3Config();
      expect(config2?.useSsl).toBe(true);
    });
  });

  describe("loadConfig", () => {
    it("should parse comma-separated admin emails", () => {
      Bun.env.ADMIN_EMAILS = "admin1@test.com, admin2@test.com";
      const config = loadConfig();
      expect(config.ADMIN_EMAILS).toEqual([
        "admin1@test.com",
        "admin2@test.com",
      ]);
    });

    it("should return empty array when no emails configured", () => {
      delete Bun.env.ADMIN_EMAILS;
      delete Bun.env.ALLOWED_EMAILS;
      const config = loadConfig();
      expect(config.ADMIN_EMAILS).toEqual([]);
      expect(config.ALLOWED_EMAILS).toEqual([]);
    });
  });

  describe("getBaseUrl", () => {
    it("should return default URL when not configured", () => {
      delete Bun.env.BASE_URL;
      const url = getBaseUrl();
      expect(url).toBe("http://localhost:3000");
    });

    it("should return configured URL", () => {
      Bun.env.BASE_URL = "https://example.com";
      const url = getBaseUrl();
      expect(url).toBe("https://example.com");
    });
  });
});
