import type { WebhookHandler } from "./types";
import { handleBeszelWebhook } from "./beszel";
import { handleCrossSeedWebhook } from "./crossSeed";
import { handleGenericWebhook } from "./generic";
import { handleHouslyWebhook } from "./hously";
import { handleJellyfinWebhook } from "./jellyfin";
import { handleKopiaWebhook } from "./kopia";
import { handlePlexWebhook } from "./plex";
import { handleProwlarrWebhook } from "./prowlarr";
import { handleUptimekumaWebhook } from "./uptimekuma";

export const webhookHandlers: Record<string, WebhookHandler> = {
  prowlarr: handleProwlarrWebhook,
  jellyfin: handleJellyfinWebhook,
  plex: handlePlexWebhook,
  kopia: handleKopiaWebhook,
  uptimekuma: handleUptimekumaWebhook,
  hously: handleHouslyWebhook,
  generic: handleGenericWebhook,
  "cross-seed": handleCrossSeedWebhook,
  crossseed: handleCrossSeedWebhook,
  beszel: handleBeszelWebhook,
};
