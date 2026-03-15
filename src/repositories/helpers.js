/**
 * Map PostgreSQL row (snake_case) to API-shaped document (camelCase, _id for compatibility).
 * Controllers and responses expect Mongoose-like documents (e.g. _id, createdAt).
 */
export function rowToUser(row) {
  if (!row) return null;
  const id = row.id;
  return {
    _id: id,
    id,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    name: row.name ?? "",
    passwordHash: row.password_hash ?? undefined,
    plan: row.plan ?? "free",
    avatarUrl: row.avatar_url ?? "",
    lastLoginAt: row.last_login_at ?? undefined,
    lastLoginIP: row.last_login_ip ?? undefined,
    lastLoginDevice: row.last_login_device ?? undefined,
    lastLoginLocation: row.last_login_location ?? undefined,
    providers: row.providers ?? {},
    isEmailVerified: row.is_email_verified ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToMemory(row) {
  if (!row) return null;
  const id = row.id;
  return {
    _id: id,
    id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? "",
    coverMediaId: row.cover_media_id ?? undefined,
    tags: row.tags ?? [],
    isFavorite: row.is_favorite ?? false,
    visibility: row.visibility ?? "private",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToAlbum(row) {
  if (!row) return null;
  const id = row.id;
  return {
    _id: id,
    id,
    userId: row.user_id,
    memoryId: row.memory_id ?? undefined,
    parentId: row.parent_id ?? undefined,
    level: row.level ?? 1,
    title: row.title,
    description: row.description ?? "",
    coverMediaId: row.cover_media_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToMedia(row) {
  if (!row) return null;
  const id = row.id;
  return {
    _id: id,
    id,
    userId: row.user_id,
    albumId: row.album_id ?? undefined,
    memoryId: row.memory_id ?? undefined,
    type: row.type,
    url: row.url ?? "",
    videoId: row.video_id ?? "",
    key: "",
    thumbUrl: row.thumbnail_url ?? "",
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    mimeType: row.mime_type ?? "",
    durationSec: row.duration_sec ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Valid UUID regex for id validation when USE_POSTGRES */
export function isValidUuid(s) {
  if (typeof s !== "string") return false;
  const u = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return u.test(s);
}
