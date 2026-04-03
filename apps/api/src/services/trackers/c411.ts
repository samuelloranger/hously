import type { Page } from "playwright";
import type { TrackerPluginConfig } from "../../utils/plugins/types";

const C411_LOGIN_FORM = "form.space-y-4";
const C411_USERNAME_INPUT = 'form.space-y-4 input[name="username"]';
const C411_PASSWORD_INPUT = 'form.space-y-4 input[name="password"]';
const C411_SUBMIT_BUTTON = 'form.space-y-4 button[type="submit"]';
const C411_TOPBAR =
  "div.hidden.lg\\:flex.items-center.h-9.gap-2.px-3.text-xs.font-medium.rounded-lg";
const C411_UPLOADED_VALUE = 'span[title="Uploaded"]';
const C411_DOWNLOADED_VALUE = 'span[title="Downloaded"]';
const C411_RATIO_VALUE = 'span[title="Ratio (Upload ÷ Download)"]';

const parseNumber = (text: string): number | null => {
  const normalized = text.replace(/\s+/g, " ").trim().replace(",", ".");
  if (normalized.includes("∞")) return null;
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
};

const parseSizeToGo = (text: string): number | null => {
  const normalized = text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(",", ".");

  const match = normalized.match(
    /(-?\d+(?:\.\d+)?)\s*(o|Ko|Mo|Go|To|B|KB|MB|GB|TB)\b/i,
  );
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  switch (match[2].toLowerCase()) {
    case "o":
    case "b":
      return value / 1_000_000_000;
    case "ko":
    case "kb":
      return value / 1_000_000;
    case "mo":
    case "mb":
      return value / 1_000;
    case "go":
    case "gb":
      return value;
    case "to":
    case "tb":
      return value * 1_000;
    default:
      return null;
  }
};

export const loginToC411 = async (
  page: Page,
  config: TrackerPluginConfig,
): Promise<void> => {
  const loginForm = page.locator(C411_LOGIN_FORM);
  const usernameInput = page.locator(C411_USERNAME_INPUT);
  const passwordInput = page.locator(C411_PASSWORD_INPUT);
  const submitButton = page.locator(C411_SUBMIT_BUTTON);
  const topbar = page.locator(C411_TOPBAR);

  await usernameInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });

  await usernameInput.fill(config.username);
  await passwordInput.fill(config.password || "");
  await submitButton.click();

  try {
    await topbar.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    const loginFormStillVisible = await loginForm
      .isVisible()
      .catch(() => false);
    throw new Error(
      loginFormStillVisible
        ? "C411 login failed: login form still visible after submit"
        : "C411 login failed: top bar not found after submit",
    );
  }
};

export const getC411TopPanelStats = async (
  page: Page,
): Promise<{
  uploadedGo: number | null;
  downloadedGo: number | null;
  ratio: number | null;
}> => {
  const uploaded = page.locator(C411_UPLOADED_VALUE);
  const downloaded = page.locator(C411_DOWNLOADED_VALUE);
  const ratio = page.locator(C411_RATIO_VALUE);

  await uploaded.waitFor({ state: "visible", timeout: 10_000 });
  await downloaded.waitFor({ state: "visible", timeout: 10_000 });
  await ratio.waitFor({ state: "visible", timeout: 10_000 });

  const [uploadedText, downloadedText, ratioText] = await Promise.all([
    uploaded.textContent(),
    downloaded.textContent(),
    ratio.textContent(),
  ]);

  return {
    uploadedGo: uploadedText ? parseSizeToGo(uploadedText) : null,
    downloadedGo: downloadedText ? parseSizeToGo(downloadedText) : null,
    ratio: ratioText ? parseNumber(ratioText) : null,
  };
};
