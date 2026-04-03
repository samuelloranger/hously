import type { Page } from "playwright";
import type { YggPluginConfig } from "../../utils/plugins/types";

const YGG_USERNAME_INPUT = '#login-form input[name="id"]';
const YGG_PASSWORD_INPUT = '#login-form input[name="pass"]';
const YGG_SUBMIT_BUTTON = '#login-form button[type="submit"]';
const YGG_LOGOUT_LINK =
  '#top_panel a[href$="/user/logout"], #top_panel a[href*="/user/logout"], #top_panel a[href*="logout"]';

export const loginToYgg = async (
  page: Page,
  config: YggPluginConfig,
  options?: {
    timeoutMs?: number;
    force?: boolean;
    skipNavigation?: boolean;
  },
) => {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const force = options?.force ?? false;
  const skipNavigation = options?.skipNavigation ?? false;

  if (!skipNavigation) {
    await page.goto(config.ygg_url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
  }

  if (!force && (await isLoggedInToYgg(page, { timeoutMs: 2_000 }))) return;

  const usernameInput = page.locator(YGG_USERNAME_INPUT);
  const passwordInput = page.locator(YGG_PASSWORD_INPUT);
  const submitButton = page.locator(YGG_SUBMIT_BUTTON);

  await usernameInput.waitFor({ state: "visible", timeout: timeoutMs });
  await passwordInput.waitFor({ state: "visible", timeout: timeoutMs });

  await usernameInput.fill(config.username);
  await passwordInput.fill(config.password!);
  await submitButton.click();

  try {
    await page
      .locator(YGG_LOGOUT_LINK)
      .waitFor({ state: "visible", timeout: timeoutMs });
  } catch {
    const loginFormVisible = await page
      .locator("#login-form")
      .isVisible()
      .catch(() => false);
    throw new Error(
      loginFormVisible
        ? "YGG login failed: login form still visible after submit (captcha/invalid credentials?)"
        : "YGG login failed: logout link not found after submit",
    );
  }
};

export const isLoggedInToYgg = async (
  page: Page,
  options?: {
    timeoutMs?: number;
  },
): Promise<boolean> => {
  try {
    await page
      .locator(YGG_LOGOUT_LINK)
      .waitFor({ state: "visible", timeout: options?.timeoutMs ?? 5_000 });
    return true;
  } catch {
    return false;
  }
};

export const getYggRatio = async (page: Page): Promise<string | null> => {
  try {
    const ratioItem = page
      .locator("#top_panel ul li", { hasText: /ratio/i })
      .first();
    await ratioItem.waitFor({ state: "visible", timeout: 5_000 });

    const ratioText = await ratioItem.textContent();
    const ratioMatch = ratioText?.match(/ratio\s*:\s*([\d.]+)/i);
    return ratioMatch ? ratioMatch[1] : null;
  } catch {
    return null;
  }
};

const parseNumber = (text: string): number | null => {
  const normalized = text.replace(/\s+/g, " ").trim().replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
};

const parseSizeToGo = (text: string): number | null => {
  const normalized = text.replace(/\s+/g, " ").trim().replace(",", ".");
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*(Ko|Mo|Go|To)\b/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  const unit = match[2].toLowerCase();
  switch (unit) {
    case "ko":
      return value / 1_000_000;
    case "mo":
      return value / 1_000;
    case "go":
      return value;
    case "to":
      return value * 1_000;
    default:
      return null;
  }
};

export const getYggTopPanelStats = async (
  page: Page,
): Promise<{
  uploadedGo: number | null;
  downloadedGo: number | null;
  ratio: number | null;
}> => {
  const panel = page.locator("#top_panel");
  await panel.waitFor({ state: "visible", timeout: 5_000 });

  const uploadedText = await panel
    .locator(".ico_upload")
    .locator("xpath=..")
    .textContent()
    .catch(() => null);
  const downloadedText = await panel
    .locator(".ico_download")
    .locator("xpath=..")
    .textContent()
    .catch(() => null);

  const ratioText = await panel
    .locator("ul li a", { hasText: /ratio/i })
    .locator("strong")
    .first()
    .textContent()
    .catch(() => null);

  return {
    uploadedGo: uploadedText ? parseSizeToGo(uploadedText) : null,
    downloadedGo: downloadedText ? parseSizeToGo(downloadedText) : null,
    ratio: ratioText ? parseNumber(ratioText) : null,
  };
};
