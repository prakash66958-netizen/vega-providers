import { ProviderContext, SettingsField } from "../types";

export const getSettingsSchema = async function ({
  providerContext,
}: {
  providerContext: ProviderContext;
}): Promise<SettingsField[]> {
  return [
    {
      key: "preferredQuality",
      type: "select",
      label: "Preferred Quality",
      description: "Default streaming resolution",
      options: [
        { label: "Auto (FullHD / 1080p)", value: "1080" },
        { label: "720p", value: "720" },
        { label: "360p", value: "360" },
      ],
      defaultValue: "1080",
    },
    {
      key: "baseUrlOverride",
      type: "text",
      label: "Custom Domain Mirror",
      placeholder: "https://anidao.to",
      defaultValue: "https://anidao.to",
    },
  ];
};
