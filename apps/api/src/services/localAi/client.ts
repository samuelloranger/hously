import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { normalizeLocalAiConfig } from "@hously/api/utils/integrations/normalizers";
import type { LocalAiConfig } from "@hously/api/utils/integrations/types";
import {
  AI_SYSTEM_PROMPT,
  buildAiPickPrompt,
  type AiPickMediaContext,
  type AiPickRelease,
} from "@hously/api/utils/medias/buildAiPickPrompt";

export type LocalAiPickResult = {
  release_key: string;
  reasoning: string;
};

export async function loadEnabledLocalAiConfig(): Promise<LocalAiConfig | null> {
  const record = await getIntegrationConfigRecord("local-ai");
  if (!record?.enabled) return null;
  return normalizeLocalAiConfig(record?.config);
}

export function parseLocalAiPickResponse(
  responseText: string,
  candidates: AiPickRelease[],
): LocalAiPickResult | null {
  const trimmed = responseText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: { release_key?: string; reasoning?: string };
  try {
    parsed = JSON.parse(trimmed) as {
      release_key?: string;
      reasoning?: string;
    };
  } catch {
    return null;
  }

  if (
    typeof parsed.release_key !== "string" ||
    !candidates.some((r) => r.key === parsed.release_key)
  ) {
    return null;
  }

  return {
    release_key: parsed.release_key,
    reasoning: (parsed.reasoning ?? "").slice(0, 150),
  };
}

export async function pickReleaseWithLocalAi(
  config: LocalAiConfig,
  media: AiPickMediaContext,
  releases: AiPickRelease[],
): Promise<LocalAiPickResult | null> {
  if (releases.length === 0) return null;

  let responseText: string;
  try {
    const res = await fetch(`${config.base_url}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: buildAiPickPrompt(media, releases) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    responseText = data?.choices?.[0]?.message?.content ?? "";
  } catch {
    return null;
  }

  return parseLocalAiPickResponse(responseText, releases);
}
