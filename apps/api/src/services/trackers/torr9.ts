import type { Page } from "playwright";
import type { TrackerPluginConfig } from "../../utils/plugins/types";

const TORR9_USERNAME_INPUT = 'form.space-y-5 input[name="username"]';
const TORR9_PASSWORD_INPUT = 'form.space-y-5 input[name="password"]';
const TORR9_SUBMIT_BUTTON = 'form.space-y-5 button[type="submit"]';
const TORR9_UPLOAD_VALUE = 'div[title="Upload"] span.font-semibold';
const TORR9_DOWNLOAD_VALUE = 'div[title="Download"] span.font-semibold';
const TORR9_RATIO_VALUE = 'div[title="Ratio"] span.font-bold';

const parseNumber = (text: string): number | null => {
  const normalized = text.replace(/\s+/g, " ").trim().replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
};

const parseSizeToGo = (text: string): number | null => {
  const normalized = text.replace(/\s+/g, " ").trim().replace(",", ".");
  const match = normalized.match(
    /(-?\d+(?:\.\d+)?)\s*(KB|MB|GB|TB|Ko|Mo|Go|To)\b/i,
  );
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  switch (match[2].toLowerCase()) {
    case "kb":
    case "ko":
      return value / 1_000_000;
    case "mb":
    case "mo":
      return value / 1_000;
    case "gb":
    case "go":
      return value;
    case "tb":
    case "to":
      return value * 1_000;
    default:
      return null;
  }
};

export const loginToTorr9 = async (
  page: Page,
  config: TrackerPluginConfig,
): Promise<void> => {
  const usernameInput = page.locator(TORR9_USERNAME_INPUT);
  const passwordInput = page.locator(TORR9_PASSWORD_INPUT);
  const submitButton = page.locator(TORR9_SUBMIT_BUTTON);
  const ratioValue = page.locator(TORR9_RATIO_VALUE);

  await usernameInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });

  await usernameInput.fill(config.username);
  await passwordInput.fill(config.password || "");
  await submitButton.click();

  try {
    await ratioValue.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    const loginFormStillVisible = await page
      .locator("form.space-y-5")
      .isVisible()
      .catch(() => false);
    throw new Error(
      loginFormStillVisible
        ? "Torr9 login failed: login form still visible after submit"
        : "Torr9 login failed: stats top bar not found after submit",
    );
  }
};

export const getTorr9TopPanelStats = async (
  page: Page,
): Promise<{
  uploadedGo: number | null;
  downloadedGo: number | null;
  ratio: number | null;
}> => {
  const uploadValue = page.locator(TORR9_UPLOAD_VALUE);
  const downloadValue = page.locator(TORR9_DOWNLOAD_VALUE);
  const ratioValue = page.locator(TORR9_RATIO_VALUE);

  await uploadValue.waitFor({ state: "visible", timeout: 10_000 });
  await downloadValue.waitFor({ state: "visible", timeout: 10_000 });
  await ratioValue.waitFor({ state: "visible", timeout: 10_000 });

  const [uploadedText, downloadedText, ratioText] = await Promise.all([
    uploadValue.textContent(),
    downloadValue.textContent(),
    ratioValue.textContent(),
  ]);

  return {
    uploadedGo: uploadedText ? parseSizeToGo(uploadedText) : null,
    downloadedGo: downloadedText ? parseSizeToGo(downloadedText) : null,
    ratio: ratioText ? parseNumber(ratioText) : null,
  };
};
