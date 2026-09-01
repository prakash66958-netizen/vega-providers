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
        { label: "Auto (Best Available)", value: "auto" },
        { label: "1080p Full HD", value: "1080" },
        { label: "720p HD", value: "720" },
        { label: "480p SD", value: "480" },
        { label: "360p Low Data", value: "360" },
      ],
      defaultValue: "auto",
    },
    {
      key: "preferredAudio",
      type: "select",
      label: "Preferred Audio",
      description: "Filter or prioritize Japanese Sub vs English Dub",
      options: [
        { label: "All (Sub & Dub)", value: "all" },
        { label: "Sub (Japanese audio + Subtitles)", value: "sub" },
        { label: "Dub (English audio)", value: "dub" },
      ],
      defaultValue: "all",
    },
    {
      key: "baseUrlOverride",
      type: "text",
      label: "Custom Mirror / Domain",
      description: "Override AnimePahe domain if default is blocked by ISP",
      placeholder: "https://animepahe.pw",
      defaultValue: "https://animepahe.pw",
    },
  ];
};
