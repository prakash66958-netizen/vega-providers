import { ProviderContext, Stream } from "../types";
import { getBaseUrl, makeAniwaveRequest } from "./client";
import { throwProviderError } from "../providerErrors";

export const getStream = async function ({
  link,
  signal,
  providerContext,
  isDownload,
}: {
  link: string;
  type: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  const { cheerio } = providerContext;
  const baseUrl = await getBaseUrl(providerContext);

  try {
    const targetUrl = link.startsWith("http")
      ? link
      : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`;

    const res = await makeAniwaveRequest(targetUrl, providerContext, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
      signal,
      allowWebView: false,
    });

    const data = typeof res?.data === "string" ? JSON.parse(res.data) : res?.data;
    const rawHtml: string = data?.result || (typeof data === "string" ? data : "");

    if (!rawHtml) {
      return [];
    }

    const $ = cheerio.load(rawHtml);
    const serverCandidates: {
      type: string;
      serverName: string;
      linkId: string;
    }[] = [];

    $(".type ul li[data-link-id], li[data-link-id]").each((_, el) => {
      const linkId = $(el).attr("data-link-id") || "";
      const type = ($(el).closest(".type").attr("data-type") || $(el).attr("data-type") || "sub").toUpperCase();
      const serverName = $(el).text().trim() || "Server";

      if (linkId) {
        serverCandidates.push({
          type,
          serverName,
          linkId,
        });
      }
    });

    const streams: Stream[] = [];

    for (const candidate of serverCandidates) {
      try {
        const sourceUrl = `${baseUrl}/ajax/sources?id=${encodeURIComponent(candidate.linkId)}`;
        const sourceRes = await makeAniwaveRequest(sourceUrl, providerContext, {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
          signal,
          allowWebView: false,
        });

        const sData =
          typeof sourceRes?.data === "string"
            ? JSON.parse(sourceRes.data)
            : sourceRes?.data;

        const embedUrl = sData?.result?.url || "";

        if (embedUrl) {
          const typeLabel = candidate.type === "DUB" ? "Dub" : "Sub";
          const serverTitle = `Aniwave ${candidate.serverName} (${typeLabel})`;

          let origin = "";
          try {
            origin = new URL(embedUrl).origin;
          } catch {
            origin = baseUrl;
          }

          streams.push({
            server: serverTitle,
            link: embedUrl,
            type: embedUrl.includes(".mp4") ? "mp4" : "m3u8",
            quality: "1080",
            headers: {
              Referer: `${baseUrl}/`,
              Origin: origin,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            },
          });
        }
      } catch (err) {
        console.warn("Aniwave server fetch error:", candidate.serverName, err);
      }
    }

    return streams;
  } catch (error) {
    throwProviderError("Aniwave", "getStream", error);
  }
};
