import type { Page } from "playwright";
import type { TrackerIntegrationConfig } from "@hously/api/utils/integrations/types";
import { parseSizeToGo, parseRatio } from "./parseUtils";

const G3MINI_LOGIN_FORM = "form.auth-form__form";
const G3MINI_USERNAME_INPUT = 'form.auth-form__form input[name="username"]';
const G3MINI_PASSWORD_INPUT = 'form.auth-form__form input[name="password"]';
const G3MINI_SUBMIT_BUTTON =
  "form.auth-form__form button.auth-form__primary-button";
const G3MINI_RATIO_BAR = "ul.top-nav__ratio-bar";
const G3MINI_UPLOADED_VALUE = "li.ratio-bar__uploaded a";
const G3MINI_DOWNLOADED_VALUE = "li.ratio-bar__downloaded a";
const G3MINI_RATIO_VALUE = "li.ratio-bar__ratio a";

export const loginToG3mini = async (
  page: Page,
  config: TrackerIntegrationConfig,
): Promise<void> => {
  const loginForm = page.locator(G3MINI_LOGIN_FORM);
  const usernameInput = page.locator(G3MINI_USERNAME_INPUT);
  const passwordInput = page.locator(G3MINI_PASSWORD_INPUT);
  const submitButton = page.locator(G3MINI_SUBMIT_BUTTON);
  const ratioBar = page.locator(G3MINI_RATIO_BAR);

  await usernameInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });

  await usernameInput.fill(config.username);
  await passwordInput.fill(config.password || "");
  await submitButton.click();

  try {
    await ratioBar.waitFor({ state: "visible", timeout: 20_000 });
  } catch (e) {
    console.warn("[g3mini] ratio bar wait failed after login:", e);
    const loginFormStillVisible = await loginForm
      .isVisible()
      .catch(() => false);
    throw new Error(
      loginFormStillVisible
        ? "G3mini login failed: login form still visible after submit"
        : "G3mini login failed: ratio bar not found after submit",
    );
  }
};

export const getG3miniTopPanelStats = async (
  page: Page,
): Promise<{
  uploadedGo: number | null;
  downloadedGo: number | null;
  ratio: number | null;
}> => {
  const uploaded = page.locator(G3MINI_UPLOADED_VALUE);
  const downloaded = page.locator(G3MINI_DOWNLOADED_VALUE);
  const ratio = page.locator(G3MINI_RATIO_VALUE);

  await uploaded.waitFor({ state: "visible", timeout: 10_000 });
  await downloaded.waitFor({ state: "visible", timeout: 10_000 });
  await ratio.waitFor({ state: "visible", timeout: 10_000 });

  const [uploadedText, downloadedText, ratioText] = await Promise.all([
    uploaded.textContent(),
    downloaded.textContent(),
    ratio.textContent(),
  ]);

  return {
    uploadedGo: uploadedText
      ? parseSizeToGo(uploadedText, { binary: true })
      : null,
    downloadedGo: downloadedText
      ? parseSizeToGo(downloadedText, { binary: true })
      : null,
    ratio: ratioText ? parseRatio(ratioText) : null,
  };
};
