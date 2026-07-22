const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "vary": "Origin",
    },
  });

const allowedOriginFor = (request, env) => {
  const requestOrigin = request.headers.get("Origin") || "";
  const configured = String(env.ALLOWED_ORIGIN || "").trim();
  if (!configured) return "null";
  return requestOrigin === configured ? configured : "null";
};

const sha256 = async (value) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const secureEqual = async (left, right) => {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash.charCodeAt(index) ^ rightHash.charCodeAt(index);
  }
  return difference === 0;
};

const verifyWithGumroad = async (productId, licenseKey) => {
  const form = new URLSearchParams({
    product_id: productId,
    license_key: licenseKey,
    increment_uses_count: "false",
  });

  const response = await fetch("https://api.gumroad.com/v2/licenses/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });

  if (!response.ok) return { valid: false, reason: "upstream_error" };

  const data = await response.json();
  const purchase = data && typeof data === "object" ? data.purchase : null;
  const refunded = purchase?.refunded === true;
  const chargebacked = purchase?.chargebacked === true;
  const subscriptionEnded = Boolean(purchase?.subscription_ended_at);
  const valid = data?.success === true && Boolean(purchase) && !refunded && !chargebacked && !subscriptionEnded;

  return {
    valid,
    email: purchase?.email || "",
    purchaseDate: purchase?.created_at || "",
    reason: valid ? "valid" : "invalid_or_revoked",
  };
};

export default {
  async fetch(request, env) {
    const origin = allowedOriginFor(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
          "vary": "Origin",
        },
      });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/validate") {
      return json({ valid: false, error: "not_found" }, 404, origin);
    }

    if (origin === "null") {
      return json({ valid: false, error: "origin_not_allowed" }, 403, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ valid: false, error: "invalid_json" }, 400, origin);
    }

    const licenseKey = String(payload?.license_key || "").trim();
    const deviceId = String(payload?.device_id || "").trim();

    if (!/^[A-Za-z0-9][A-Za-z0-9-]{7,127}$/.test(licenseKey)) {
      return json({ valid: false, error: "invalid_license_format" }, 400, origin);
    }
    if (!/^mzd_[A-Za-z0-9_-]{8,160}$/.test(deviceId)) {
      return json({ valid: false, error: "invalid_device" }, 400, origin);
    }

    // Owner key: a private testing key that lives ONLY in Cloudflare as a secret.
    // It never ships inside the app or GitHub repository. The owner path is checked
    // before Gumroad configuration so the owner can validate deployment independently.
    const ownerKey = String(env.OWNER_KEY || "").trim();
    if (ownerKey && (await secureEqual(licenseKey, ownerKey))) {
      return json(
        { valid: true, licenseType: "owner", purchaseDate: new Date().toISOString() },
        200,
        origin
      );
    }

    const productId = String(env.GUMROAD_PRODUCT_ID || "").trim();
    if (!productId || productId === "REPLACE_WITH_GUMROAD_PRODUCT_ID") {
      return json({ valid: false, error: "server_not_configured" }, 503, origin);
    }

    const result = await verifyWithGumroad(productId, licenseKey);
    if (!result.valid) return json({ valid: false }, 200, origin);

    // Store only a one-way license hash and minimal device metadata.
    // Default to three devices so one purchaser can use phone, tablet, and computer.
    const maxDevices = Math.max(1, Math.min(10, Number(env.MAX_DEVICES || 3)));
    const licenseHash = await sha256(`${productId}:${licenseKey}`);
    const storageKey = `license:${licenseHash}`;
    const existing = (await env.LICENSE_BINDINGS.get(storageKey, "json")) || { devices: [] };
    const devices = Array.isArray(existing.devices) ? existing.devices.filter(Boolean) : [];
    const alreadyBound = devices.includes(deviceId);

    if (!alreadyBound && devices.length >= maxDevices) {
      return json({ valid: false, error: "device_limit_reached" }, 200, origin);
    }

    if (!alreadyBound) {
      devices.push(deviceId);
      await env.LICENSE_BINDINGS.put(
        storageKey,
        JSON.stringify({ devices, updatedAt: new Date().toISOString() })
      );
    }

    return json(
      {
        valid: true,
        email: result.email,
        purchaseDate: result.purchaseDate,
      },
      200,
      origin
    );
  },
};
