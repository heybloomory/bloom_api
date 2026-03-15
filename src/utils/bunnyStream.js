/**
 * Bunny Stream API helper for video uploads.
 * Videos are stored in Bunny Stream; playback via iframe.mediadelivery.net.
 *
 * Required env:
 *   BUNNY_STREAM_LIBRARY_ID - Stream library ID
 *   BUNNY_STREAM_API_KEY    - Stream API key
 *
 * Playback URL format: https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}
 */

function getConfig() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error("BUNNY_STREAM_LIBRARY_ID and BUNNY_STREAM_API_KEY are required for video uploads");
  }
  return { libraryId, apiKey };
}

const BASE = "https://video.bunnycdn.com";

/**
 * Create a video object in Bunny Stream; returns guid (videoId).
 * @param {string} title - Video title (e.g. filename or user-provided)
 * @returns {Promise<{ videoId: string }>}
 */
export async function createVideo(title) {
  const { libraryId, apiKey } = getConfig();
  const url = `${BASE}/library/${libraryId}/videos`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      AccessKey: apiKey,
    },
    body: JSON.stringify({ title: String(title).slice(0, 255) || "Untitled" }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bunny Stream create video failed (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  const videoId = data?.guid ?? data?.id;
  if (!videoId) throw new Error("Bunny Stream did not return videoId");
  return { videoId: String(videoId) };
}

/**
 * Upload video file to the created video object.
 * @param {{ videoId: string, buffer: Buffer, contentType?: string }} opts
 * @returns {Promise<{ videoId: string }>}
 */
export async function uploadVideoFile({ videoId, buffer, contentType = "video/mp4" }) {
  const { libraryId, apiKey } = getConfig();
  const url = `${BASE}/library/${libraryId}/videos/${videoId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: apiKey,
      "Content-Type": contentType,
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bunny Stream upload failed (${res.status}): ${text || res.statusText}`);
  }

  return { videoId };
}

/**
 * Create video + upload file in one flow. Returns videoId and playback URL.
 * @param {{ title: string, buffer: Buffer, contentType?: string }} opts
 * @returns {Promise<{ videoId: string, playbackUrl: string }>}
 */
export async function uploadVideoToBunnyStream({ title, buffer, contentType = "video/mp4" }) {
  const { videoId } = await createVideo(title);
  await uploadVideoFile({ videoId, buffer, contentType });
  const { libraryId } = getConfig();
  const playbackUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
  return { videoId, playbackUrl };
}

/**
 * Build playback URL for a stored videoId (e.g. when reading from DB).
 * Returns "" if Bunny Stream env is not configured.
 */
export function getPlaybackUrl(videoId) {
  if (!videoId) return "";
  try {
    const { libraryId } = getConfig();
    return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
  } catch {
    return "";
  }
}
