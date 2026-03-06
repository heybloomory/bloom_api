import geoip from "geoip-lite";
import * as UAParserPkg from "ua-parser-js";
const UAParser = UAParserPkg.default || UAParserPkg.UAParser || UAParserPkg;

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return ip || req.ip;
}

export async function recordLogin({ req, user }) {
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"] || "";

  const parsed = new UAParser(ua).getResult();
  const device =
    `${parsed.device.vendor || ""} ${parsed.device.model || ""}`.trim() ||
    `${parsed.os.name || ""} ${parsed.os.version || ""}`.trim() ||
    `${parsed.browser.name || ""} ${parsed.browser.version || ""}`.trim() ||
    "unknown";

  const geo = ip ? geoip.lookup(ip) : null;
  const location = geo
    ? { country: geo.country, region: geo.region, city: geo.city, ll: geo.ll }
    : null;

  // ✅ Only latest login info (overwrite)
  user.lastLoginAt = new Date();
  user.lastLoginIP = ip;
  user.lastLoginDevice = device;
  user.lastLoginLocation = location || undefined;

  await user.save();
}
