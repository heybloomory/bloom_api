export function errorHandler(err, req, res, next) {
  // Zod validation errors
  if (err?.name === "ZodError") {
    const message = err.issues?.[0]?.message || "Invalid request";
    if (process.env.NODE_ENV !== "test") console.error(err);
    return res.status(400).json({ success: false, message });
  }

  // Mongo duplicate key (e.g., unique email/phone)
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).join(", ") || "field";
    const message = `Duplicate ${fields}`;
    if (process.env.NODE_ENV !== "test") console.error(err);
    return res.status(409).json({ success: false, message });
  }

  const status = err.statusCode || err.status || 500;
  const message = err.message || "Server error";
  if (process.env.NODE_ENV !== "test") console.error(err);
  res.status(status).json({ success: false, message });
}
