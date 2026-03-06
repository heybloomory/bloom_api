/**
 * BunnyCDN Storage upload helper (server-side).
 *
 * Required env vars:
 * - BUNNY_STORAGE_ZONE: Storage zone name
 * - BUNNY_STORAGE_KEY: Storage API access key
 * - BUNNY_CDN_BASE_URL: Public base URL (Pull Zone) e.g. https://yourzone.b-cdn.net
 */

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getBunnyConfig() {
  return {
    storageZone: mustEnv("BUNNY_STORAGE_ZONE"),
    accessKey: mustEnv("BUNNY_STORAGE_KEY"),
    cdnBaseUrl: mustEnv("BUNNY_CDN_BASE_URL").replace(/\/$/, ""),

    // ✅ add this
    storageHost: (process.env.BUNNY_STORAGE_HOST || "storage.bunnycdn.com")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, ""),
  };
}


export function buildPublicUrl(key) {
  const { cdnBaseUrl } = getBunnyConfig();
  const cleanKey = String(key || "").replace(/^\/+/, "");
  return `${cdnBaseUrl}/${cleanKey}`;
}

export async function uploadToBunny({ key, buffer, contentType }) {
  const { storageZone, accessKey, storageHost } = getBunnyConfig();
  const cleanKey = String(key || "").replace(/^\/+/, "");

  const url = `https://${storageHost}/${encodeURIComponent(storageZone)}/${cleanKey}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: accessKey,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: buffer,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Bunny upload failed (${res.status}): ${txt || res.statusText}`);
  }

  return { key: cleanKey, url: buildPublicUrl(cleanKey) };
}

