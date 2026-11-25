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

const HOME_TODO_KEYS = [
  "未付款",
  "待处理出货",
  "已处理出货",
  "待取消",
  "待处理退货/退款",
  "已售完",
  "已禁卖/搜索排名降低",
];

const DEFAULT_HOME = {
  shop: "青羊区星氧百货店",
  todo: {
    未付款: 5,
    待处理出货: 9,
    已处理出货: 21,
    待取消: 12,
    "待处理退货/退款": 0,
    已售完: 4,
    "已禁卖/搜索排名降低": 1,
  },
};

const DEFAULT_PAYOUT_RECORDS = [
  {
    id: "COL0011001003989202610224982260758",
    date: "2026-10-22",
    txnId: "7f5ddfc6db2e448e933e8d3711c43e55",
    amount: 70,
    bank: "建设银行",
    accountName: "徐金",
    cardMasked: "***************1813",
    status: "交易成功",
  },
  {
    id: "COL0011001003989202610154661673545",
    date: "2026-10-15",
    txnId: "44d98b6e46d2463a92cbbab775c8a195",
    amount: 132,
    bank: "建设银行",
    accountName: "徐金",
    cardMasked: "***************1813",
    status: "交易成功",
  },
  {
    id: "COL0011001003989202609187972185781",
    date: "2026-09-18",
    txnId: "089ce6c82fdf4e5f8e74f6533d165af1",
    amount: 70,
    bank: "建设银行",
    accountName: "徐金",
    cardMasked: "***************1813",
    status: "交易成功",
  },
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

function normalizeHome(home) {
  const src = isPlainObject(home) ? home : {};
  const todoSrc = isPlainObject(src.todo) ? src.todo : {};
  const todo = {};
  for (const k of HOME_TODO_KEYS) {
    const raw = todoSrc[k];
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
    todo[k] = Number.isFinite(n) ? n : DEFAULT_HOME.todo[k];
  }
  return {
    shop: typeof src.shop === "string" && src.shop.trim() ? src.shop.trim() : DEFAULT_HOME.shop,
    todo,
  };
}

function validateHome(home) {
  if (home == null) return null;
  if (!isPlainObject(home)) return "home must be object";
  if (home.shop != null && typeof home.shop !== "string") return "home.shop must be string";
  if (home.todo != null) {
    if (!isPlainObject(home.todo)) return "home.todo must be object";
    for (const [k, v] of Object.entries(home.todo)) {
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      if (!Number.isFinite(n)) return `home.todo.${k} must be number`;
    }
  }
  return null;
}

function normalizePayoutRecords(list) {
  const src = Array.isArray(list) ? list : DEFAULT_PAYOUT_RECORDS;
  return src.map((raw, i) => {
    const r = isPlainObject(raw) ? raw : {};
    const amountRaw = r.amount;
    const amount =
      typeof amountRaw === "number"
        ? amountRaw
        : parseFloat(String(amountRaw ?? "").replace(/[^\d.-]/g, ""));
    const base = DEFAULT_PAYOUT_RECORDS[i] || DEFAULT_PAYOUT_RECORDS[0];
    return {
      id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : base.id || `PAYOUT-${i + 1}`,
      date: typeof r.date === "string" && r.date.trim() ? r.date.trim() : base.date,
      txnId: typeof r.txnId === "string" && r.txnId.trim() ? r.txnId.trim() : base.txnId,
      amount: Number.isFinite(amount) ? amount : base.amount,
      bank: typeof r.bank === "string" && r.bank.trim() ? r.bank.trim() : base.bank,
      accountName:
        typeof r.accountName === "string" && r.accountName.trim()
          ? r.accountName.trim()
          : base.accountName,
      cardMasked:
        typeof r.cardMasked === "string" && r.cardMasked.trim()
          ? r.cardMasked.trim()
          : base.cardMasked,
      status: typeof r.status === "string" && r.status.trim() ? r.status.trim() : "交易成功",
    };
  });
}

function validatePayoutRecords(list) {
  if (list == null) return null;
  if (!Array.isArray(list)) return "payoutRecords must be array";
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!isPlainObject(r)) return `payoutRecords[${i}] must be object`;
    if (r.date != null && typeof r.date !== "string") return `payoutRecords[${i}].date must be string`;
    if (r.txnId != null && typeof r.txnId !== "string") {
      return `payoutRecords[${i}].txnId must be string`;
    }
    if (r.amount != null) {
      const n = typeof r.amount === "number" ? r.amount : parseFloat(String(r.amount));
      if (!Number.isFinite(n)) return `payoutRecords[${i}].amount must be number`;
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

  const errH = validateHome(data.home);
  if (errH) return errH;

  const errP = validatePayoutRecords(data.payoutRecords);
  if (errP) return errP;

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

function withHome(data) {
  if (!isPlainObject(data)) return data;
  data.home = normalizeHome(data.home);
  data.payoutRecords = normalizePayoutRecords(data.payoutRecords);
  return data;
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
      return json(withHome(data));
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
      const data = withHome(await loadDefault(request));
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
    body = withHome(body);
    body.version = body.version || 1;
    body.updatedAt = new Date().toISOString();
    await kv.put(KV_KEY, JSON.stringify(body));
    return json({ ok: true, updatedAt: body.updatedAt });
  }

  return json({ ok: false, error: "method not allowed" }, 405);
}
