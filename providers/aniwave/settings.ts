import { ProviderContext, SettingsField } from "../types";

export const getSettingsSchema = async function ({
  providerContext,
}: {
  providerContext: ProviderContext;
}): Promise<SettingsField[]> {
  return [
    {
      key: "preferredAudio",
      type: "select",
      label: "Preferred Audio",
      description: "Default audio preference (Sub or Dub)",
      options: [
        { label: "All / Subbed First", value: "all" },
        { label: "Sub (Japanese with English Subs)", value: "sub" },
        { label: "Dub (English Dubbed)", value: "dub" },
      ],
      defaultValue: "all",
    },
    {
      key: "baseUrlOverride",
      type: "text",
      label: "Custom Domain Mirror",
      placeholder: "https://aniwaves.ru",
      defaultValue: "https://aniwaves.ru",
    },
  ];
};
