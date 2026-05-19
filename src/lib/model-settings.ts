export const modelOptions = ["Misty default", "Google Gemini"] as const;

const modelIdBySetting: Record<string, string> = {
  "Misty default": "gemini-3-flash-preview",
  "Google Gemini": "gemini-3-flash-preview",
};

export function resolveGoogleModelId(setting?: string | null) {
  if (!setting) return modelIdBySetting["Misty default"];
  return modelIdBySetting[setting] ?? modelIdBySetting["Misty default"];
}

export function isSupportedModelSetting(setting: string) {
  return setting in modelIdBySetting;
}
