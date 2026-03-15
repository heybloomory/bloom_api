import { getPool } from "../config/postgres.js";
import { rowToUser } from "./helpers.js";

export async function createUser(data) {
  const pool = getPool();
  if (!pool) return null;
  const {
    email,
    phone,
    name = "",
    passwordHash,
    plan = "free",
    avatarUrl = "",
    providers = {},
    isEmailVerified = false,
  } = data;
  const res = await pool.query(
    `INSERT INTO users (email, phone, name, password_hash, plan, avatar_url, providers, is_email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING *`,
    [
      email ?? null,
      phone ?? null,
      name,
      passwordHash ?? null,
      plan,
      avatarUrl,
      JSON.stringify(providers),
      isEmailVerified,
    ]
  );
  return rowToUser(res.rows[0]);
}

export async function findUserById(id) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(
    "SELECT id, email, phone, name, plan, avatar_url, last_login_at, last_login_ip, last_login_device, last_login_location, providers, is_email_verified, created_at, updated_at FROM users WHERE id = $1",
    [id]
  );
  return rowToUser(res.rows[0]);
}

export async function findUserByIdWithPassword(id) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rowToUser(res.rows[0]);
}

export async function findUserByEmail(email) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(
    "SELECT id, email, phone, name, plan, avatar_url, last_login_at, last_login_ip, last_login_device, last_login_location, providers, is_email_verified, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  return rowToUser(res.rows[0]);
}

export async function findUserByEmailWithPassword(email) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
  return rowToUser(res.rows[0]);
}

export async function findUserByPhone(phone) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(
    "SELECT id, email, phone, name, plan, avatar_url, last_login_at, last_login_ip, last_login_device, last_login_location, providers, is_email_verified, created_at, updated_at FROM users WHERE phone = $1",
    [phone]
  );
  return rowToUser(res.rows[0]);
}

export async function findUserByPhoneWithPassword(phone) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query("SELECT * FROM users WHERE phone = $1", [phone]);
  return rowToUser(res.rows[0]);
}

/** Find by Google provider id (providers->google->googleId) */
export async function findUserByGoogleId(googleId) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(
    "SELECT * FROM users WHERE providers->'google'->>'googleId' = $1",
    [googleId]
  );
  return rowToUser(res.rows[0]);
}

export async function findUserByEmailOrPhone(email, phone) {
  const pool = getPool();
  if (!pool) return null;
  const conditions = [];
  const values = [];
  if (email) {
    conditions.push("LOWER(email) = LOWER($1)");
    values.push(email);
  }
  if (phone) {
    conditions.push(`phone = $${values.length + 1}`);
    values.push(phone);
  }
  if (conditions.length === 0) return null;
  const res = await pool.query(
    `SELECT id, email, phone, name, plan, avatar_url, last_login_at, last_login_ip, last_login_device, last_login_location, providers, is_email_verified, created_at, updated_at FROM users WHERE ${conditions.join(" OR ")}`,
    values
  );
  return rowToUser(res.rows[0]);
}

const USER_UPDATE_MAP = {
  name: "name",
  avatarUrl: "avatar_url",
  plan: "plan",
  email: "email",
  phone: "phone",
  isEmailVerified: "is_email_verified",
};

export async function updateUser(id, data) {
  const pool = getPool();
  if (!pool) return null;
  const setClauses = [];
  const values = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) {
    if (k === "providers") {
      setClauses.push(`providers = $${i}::jsonb`);
      values.push(JSON.stringify(v));
      i++;
    } else if (USER_UPDATE_MAP[k]) {
      setClauses.push(`${USER_UPDATE_MAP[k]} = $${i}`);
      values.push(v);
      i++;
    }
  }
  if (setClauses.length === 0) return findUserById(id);
  setClauses.push(`updated_at = now()`);
  values.push(id);
  const res = await pool.query(
    `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return rowToUser(res.rows[0]);
}

export async function updateLastLogin(id, { lastLoginAt, lastLoginIP, lastLoginDevice, lastLoginLocation }) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(
    `UPDATE users SET last_login_at = $1, last_login_ip = $2, last_login_device = $3, last_login_location = $4::jsonb, updated_at = now() WHERE id = $5 RETURNING *`,
    [lastLoginAt ?? new Date(), lastLoginIP ?? null, lastLoginDevice ?? null, lastLoginLocation ? JSON.stringify(lastLoginLocation) : null, id]
  );
  return rowToUser(res.rows[0]);
}
