import type { Page } from "playwright";
import type { TrackerIntegrationConfig } from "@hously/api/utils/integrations/types";
import { parseSizeToGo, parseRatio } from "./parseUtils";

const TORR9_USERNAME_INPUT = 'form.space-y-5 input[name="username"]';
const TORR9_PASSWORD_INPUT = 'form.space-y-5 input[name="password"]';
const TORR9_SUBMIT_BUTTON = 'form.space-y-5 button[type="submit"]';
const TORR9_UPLOAD_VALUE = 'div[title="Upload"] span.font-semibold';
const TORR9_DOWNLOAD_VALUE = 'div[title="Download"] span.font-semibold';
const TORR9_RATIO_VALUE = 'div[title="Ratio"] span.font-bold';

export const loginToTorr9 = async (
  page: Page,
  config: TrackerIntegrationConfig,
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
  } catch (e) {
    console.warn("[torr9] ratio bar wait failed after login:", e);
    const loginFormStillVisible = await page
      .locator("form.space-y-5")
      .isVisible()
      .catch(() => false);
    throw new Error(
      loginFormStillVisible
        ? "Torr9 login failed: login form still visible after submit"
        : "Torr9 login failed: stats top bar not found after submit",
      { cause: e },
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
    ratio: ratioText ? parseRatio(ratioText) : null,
  };
};
