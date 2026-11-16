/**
 * GET  /api/bi-data  — public read (front page)
 * PUT  /api/bi-data  — save (middleware requires login)
 * POST /api/bi-data?reset=1 — restore defaults (login required)
 */
const KV_KEY = "bi-data";

const METRIC_KEYS = [
  "sales",
  "orders",
  "units",
  "clicks",
  "cancelled",
  "cancelled_sales",
  "refund_orders",
  "refund_sales",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function loadDefault(request) {
  const url = new URL("/bi-data.default.json", request.url);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("default bi-data missing: " + res.status);
  return res.json();
}

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function validateMetricBlock(block, label) {
  if (!isPlainObject(block)) return `${label} must be object`;
  for (const k of METRIC_KEYS) {
    if (typeof block[k] !== "number" || Number.isNaN(block[k])) {
      return `${label}.${k} must be number`;
    }
  }
  if (!isPlainObject(block.mom)) return `${label}.mom must be object`;
  for (const k of METRIC_KEYS) {
    if (typeof block.mom[k] !== "number" || Number.isNaN(block.mom[k])) {
      return `${label}.mom.${k} must be number`;
    }
  }
  return null;
}

function validatePayload(data) {
  if (!isPlainObject(data)) return "root must be object";
  if (!isPlainObject(data.monthData)) return "monthData required";
  if (!isPlainObject(data.monthSeries)) return "monthSeries required";
  if (!Array.isArray(data.shopBase)) return "shopBase required";
  if (!Array.isArray(data.extraShops)) return "extraShops required";

  const errT = validateMetricBlock(data.today, "today");
  if (errT) return errT;
  const errY = validateMetricBlock(data.yesterday, "yesterday");
  if (errY) return errY;

  for (const [key, block] of Object.entries(data.monthData)) {
    if (!/^\d{4}-\d{2}$/.test(key)) return `bad monthData key ${key}`;
    const e = validateMetricBlock(block, `monthData.${key}`);
    if (e) return e;
  }

  for (const [key, series] of Object.entries(data.monthSeries)) {
    if (!/^\d{4}-\d{2}$/.test(key)) return `bad monthSeries key ${key}`;
    if (!isPlainObject(series)) return `monthSeries.${key} must be object`;
    for (const k of METRIC_KEYS) {
      if (!Array.isArray(series[k])) return `monthSeries.${key}.${k} must be array`;
      for (const n of series[k]) {
        if (typeof n !== "number" || Number.isNaN(n)) {
          return `monthSeries.${key}.${k} has non-number`;
        }
      }
    }
  }

  for (const shop of data.shopBase.concat(data.extraShops)) {
    if (!isPlainObject(shop)) return "shop entry must be object";
    if (typeof shop.name !== "string" || typeof shop.market !== "string") {
      return "shop needs name/market string";
    }
    if (typeof shop.w !== "number" || Number.isNaN(shop.w)) {
      return "shop.w must be number";
    }
  }
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const kv = env && env.BI_DATA;

  if (method === "GET") {
    try {
      let data = null;
      if (kv) {
        const raw = await kv.get(KV_KEY, "json");
        if (raw) data = raw;
      }
      if (!data) data = await loadDefault(request);
      return json(data);
    } catch (e) {
      return json({ ok: false, error: String(e && e.message ? e.message : e) }, 500);
    }
  }

  if (method === "POST" && url.searchParams.get("reset") === "1") {
    // Require explicit confirm=RESET to avoid accidental wipe of admin edits.
    if (url.searchParams.get("confirm") !== "RESET") {
      return json(
        {
          ok: false,
          error: "reset requires confirm=RESET (this overwrites saved KV data)",
        },
        400
      );
    }
    try {
      const data = await loadDefault(request);
      if (kv) await kv.put(KV_KEY, JSON.stringify(data));
      return json({ ok: true, data });
    } catch (e) {
      return json({ ok: false, error: String(e && e.message ? e.message : e) }, 500);
    }
  }

  if (method === "PUT") {
    if (!kv) {
      return json({ ok: false, error: "BI_DATA KV binding missing" }, 500);
    }
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ ok: false, error: "invalid JSON" }, 400);
    }
    const err = validatePayload(body);
    if (err) return json({ ok: false, error: err }, 400);
    body.version = body.version || 1;
    body.updatedAt = new Date().toISOString();
    await kv.put(KV_KEY, JSON.stringify(body));
    return json({ ok: true, updatedAt: body.updatedAt });
  }

  return json({ ok: false, error: "method not allowed" }, 405);
}
