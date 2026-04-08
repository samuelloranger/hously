import { describe, it, expect } from "bun:test";
import {
  formatUsername,
  formatDisplayName,
  getUserFirstName,
  formatCronTrigger,
  formatBytes,
  formatSpeed,
} from "../format";

describe("formatUsername", () => {
  it("title-cases a single word", () => {
    expect(formatUsername("john")).toBe("John");
  });

  it("title-cases multiple words", () => {
    expect(formatUsername("john doe")).toBe("John Doe");
  });

  it("returns fallback for null/undefined", () => {
    expect(formatUsername(null)).toBe("");
    expect(formatUsername(undefined, "N/A")).toBe("N/A");
  });
});

describe("formatDisplayName", () => {
  it("combines first and last name", () => {
    const user = {
      first_name: "john",
      last_name: "doe",
      email: "j@d.com",
    } as any;
    expect(formatDisplayName(user)).toBe("John Doe");
  });

  it("falls back to email when name is empty", () => {
    const user = { first_name: "", last_name: "", email: "j@d.com" } as any;
    expect(formatDisplayName(user)).toBe("j@d.com");
  });

  it("returns fallback for null user", () => {
    expect(formatDisplayName(null, "Unknown")).toBe("Unknown");
  });
});

describe("getUserFirstName", () => {
  it("returns formatted first name", () => {
    const user = { first_name: "john", email: "j@d.com" } as any;
    expect(getUserFirstName(user)).toBe("John");
  });

  it("falls back to email when first_name is empty", () => {
    const user = { first_name: "", email: "j@d.com" } as any;
    expect(getUserFirstName(user)).toBe("j@d.com");
  });

  it("returns fallback for null user", () => {
    expect(getUserFirstName(null, "Guest")).toBe("Guest");
  });
});

describe("formatCronTrigger", () => {
  it("formats minute intervals", () => {
    expect(formatCronTrigger("minute='*/5'")).toBe("every 5 minutes");
  });

  it("formats minute intervals in French", () => {
    expect(formatCronTrigger("minute='*/5'", "fr")).toBe(
      "à tous les 5 minutes",
    );
  });

  it("formats midnight daily", () => {
    expect(formatCronTrigger("minute='0' hour='0'")).toBe("at midnight daily");
  });

  it("formats midnight daily in French", () => {
    expect(formatCronTrigger("minute='0' hour='0'", "fr")).toBe(
      "à minuit à tous les jours",
    );
  });

  it("formats specific time daily", () => {
    expect(formatCronTrigger("minute='30' hour='14'")).toBe("at 2:30 PM daily");
  });

  it("formats midnight on 1st of month", () => {
    expect(formatCronTrigger("minute='0' hour='0' day='1'")).toBe(
      "at midnight on the 1st of each month",
    );
  });

  it("formats midnight on 1st of month in French", () => {
    expect(formatCronTrigger("minute='0' hour='0' day='1'", "fr")).toBe(
      "à minuit le 1er de chaque mois",
    );
  });

  it("returns raw trigger for unrecognized format", () => {
    expect(formatCronTrigger("something weird")).toBe("something weird");
  });
});

describe("formatBytes", () => {
  it("returns '0 B' for null/undefined/zero/negative", () => {
    expect(formatBytes(null)).toBe("0 B");
    expect(formatBytes(undefined)).toBe("0 B");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-10)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1.0 GB");
  });

  it("uses whole numbers for values >= 100", () => {
    expect(formatBytes(150 * 1024)).toBe("150 KB");
  });
});

describe("formatSpeed", () => {
  it("appends /s to formatted bytes", () => {
    expect(formatSpeed(1024)).toBe("1.0 KB/s");
  });

  it("handles null", () => {
    expect(formatSpeed(null)).toBe("0 B/s");
  });
});
