import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from "bun:test";

const sendMailMock = mock(async () => {});
const createTransportMock = mock(() => ({ sendMail: sendMailMock }));

mock.module("nodemailer", () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

mock.module("@react-email/render", () => ({
  render: mock(
    async (_component: unknown, _opts?: unknown) => "<html>email</html>",
  ),
}));

mock.module("../config", () => ({
  getBaseUrl: () => "https://hously.example.com",
  getSmtpConfig: () => {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) return null;
    return {
      host,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      user,
      pass,
      from: process.env.SMTP_FROM || "noreply@localhost",
      fromName: process.env.SMTP_FROM_NAME || "Hously",
    };
  },
}));

mock.module("../emails/InvitationEmail", () => ({
  InvitationEmail: () => null,
}));

mock.module("../emails/PasswordResetEmail", () => ({
  PasswordResetEmail: () => null,
}));

describe("emailService", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    sendMailMock.mockClear();
    createTransportMock.mockClear();
    const { _resetTransporter } = await import("../services/emailService");
    _resetTransporter();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("isEmailConfigured", () => {
    it("returns false when SMTP env vars are missing", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const { isEmailConfigured } = await import("../services/emailService");
      expect(isEmailConfigured()).toBe(false);
    });

    it("returns true when all SMTP env vars are set", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "user@example.com";
      process.env.SMTP_PASS = "secret";

      const { isEmailConfigured } = await import("../services/emailService");
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe("sendEmail", () => {
    it("returns false and warns when SMTP is not configured", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const { sendEmail } = await import("../services/emailService");
      const result = await sendEmail(
        "test@example.com",
        "Subject",
        "<p>body</p>",
      );

      expect(result).toBe(false);
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("returns true and calls sendMail when SMTP is configured", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "user@example.com";
      process.env.SMTP_PASS = "secret";
      process.env.SMTP_FROM = "noreply@example.com";
      process.env.SMTP_FROM_NAME = "Hously Test";

      const { sendEmail } = await import("../services/emailService");
      const result = await sendEmail(
        "to@example.com",
        "Hello",
        "<p>hi</p>",
        "hi",
      );

      expect(result).toBe(true);
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = (
        sendMailMock.mock.calls[0] as unknown as [Record<string, unknown>]
      )[0];
      expect(call).toMatchObject({
        to: "to@example.com",
        subject: "Hello",
        html: "<p>hi</p>",
        text: "hi",
      });
    });

    it("returns false when sendMail throws", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "user@example.com";
      process.env.SMTP_PASS = "secret";

      sendMailMock.mockImplementationOnce(async () => {
        throw new Error("SMTP connection refused");
      });

      const consoleSpy = spyOn(console, "error").mockImplementation(() => {});
      const { sendEmail } = await import("../services/emailService");
      const result = await sendEmail(
        "to@example.com",
        "Subject",
        "<p>body</p>",
      );
      consoleSpy.mockRestore();

      expect(result).toBe(false);
    });
  });

  describe("sendInvitationEmail", () => {
    it("returns true without sending when SMTP is not configured", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const { sendInvitationEmail } = await import("../services/emailService");
      const result = await sendInvitationEmail(
        "user@example.com",
        "token123",
        "Alice",
      );

      expect(result).toBe(true);
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("uses French subject for fr locale", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "user@example.com";
      process.env.SMTP_PASS = "secret";

      const { sendInvitationEmail } = await import("../services/emailService");
      await sendInvitationEmail("user@example.com", "token123", "Alice", "fr");

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const callFr = (
        sendMailMock.mock.calls[0] as unknown as [Record<string, unknown>]
      )[0];
      expect(callFr.subject).toBe("Vous avez été invité sur Hously");
    });

    it("uses English subject for en locale", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "user@example.com";
      process.env.SMTP_PASS = "secret";

      const { sendInvitationEmail } = await import("../services/emailService");
      await sendInvitationEmail("user@example.com", "token123", "Alice", "en");

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const callEn = (
        sendMailMock.mock.calls[0] as unknown as [Record<string, unknown>]
      )[0];
      expect(callEn.subject).toBe("You've been invited to Hously");
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("returns true without sending when SMTP is not configured", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const { sendPasswordResetEmail } =
        await import("../services/emailService");
      const result = await sendPasswordResetEmail(
        "user@example.com",
        "resettoken",
      );

      expect(result).toBe(true);
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("uses French subject for fr locale", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "user@example.com";
      process.env.SMTP_PASS = "secret";

      const { sendPasswordResetEmail } =
        await import("../services/emailService");
      await sendPasswordResetEmail("user@example.com", "resettoken", "fr");

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const callFrReset = (
        sendMailMock.mock.calls[0] as unknown as [Record<string, unknown>]
      )[0];
      expect(callFrReset.subject).toBe(
        "Réinitialiser votre mot de passe Hously",
      );
    });

    it("uses English subject by default", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "user@example.com";
      process.env.SMTP_PASS = "secret";

      const { sendPasswordResetEmail } =
        await import("../services/emailService");
      await sendPasswordResetEmail("user@example.com", "resettoken");

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const callEnReset = (
        sendMailMock.mock.calls[0] as unknown as [Record<string, unknown>]
      )[0];
      expect(callEnReset.subject).toBe("Reset your Hously password");
    });
  });
});
