/**
 * Server-side gate: unauthenticated visitors only see the login page.
 *
 * Password: set Cloudflare Pages env DEMO_GATE_PASSWORD (Production),
 * or defaults to demo8688 below.
 *
 * Session cookie: after login, home <-> datacenter navigation does not
 * re-ask for password until the browser session ends.
 */
const COOKIE = "sc_demo_gate";
const DEFAULT_PASS = "demo8688";

function gateHtml(errorMsg) {
  const err = errorMsg
    ? `<div class="err">${errorMsg}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Shopee卖家中心</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23EE4D2D'/%3E%3C/svg%3E">
<style>
  :root { --brand:#EE4D2D; --brand-dark:#D73211; --bg:#f5f5f5; --card:#fff; --text:#333; --muted:#999; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: var(--bg);
    color: var(--text);
  }
  .top {
    height: 56px;
    background: #fff;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
    padding: 0 24px;
    gap: 10px;
  }
  .logo {
    width: 28px; height: 28px; border-radius: 6px;
    background: var(--brand);
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 14px;
  }
  .brand { font-size: 16px; font-weight: 600; color: #222; }
  .wrap {
    min-height: calc(100% - 56px);
    display: flex; align-items: center; justify-content: center;
    padding: 32px 16px;
    background:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(238,77,45,.12), transparent 60%),
      var(--bg);
  }
  .card {
    width: 100%; max-width: 400px;
    background: var(--card);
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,.08);
    padding: 36px 32px 28px;
  }
  h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
  .sub { margin: 0 0 24px; color: var(--muted); font-size: 13px; line-height: 1.5; }
  label { display: block; font-size: 13px; margin-bottom: 8px; color: #555; }
  input[type=password] {
    width: 100%; height: 40px; padding: 0 12px;
    border: 1px solid #e5e5e5; border-radius: 4px;
    font-size: 14px; outline: none; transition: border-color .15s;
  }
  input[type=password]:focus { border-color: var(--brand); }
  button {
    margin-top: 20px; width: 100%; height: 40px;
    border: 0; border-radius: 4px; cursor: pointer;
    background: var(--brand); color: #fff; font-size: 15px; font-weight: 600;
  }
  button:hover { background: var(--brand-dark); }
  button:disabled { opacity: .65; cursor: wait; }
  .err {
    margin-bottom: 16px; padding: 10px 12px;
    background: #FFF0EE; color: var(--brand);
    border-radius: 4px; font-size: 13px;
  }
  .foot { margin-top: 20px; text-align: center; font-size: 12px; color: #bbb; }
</style>
</head>
<body>
  <header class="top">
    <span class="logo">S</span>
    <span class="brand">Shopee卖家中心</span>
  </header>
  <main class="wrap">
    <form class="card" id="f" autocomplete="off">
      <h1>登录</h1>
      <p class="sub">请输入访问密码后继续。</p>
      ${err}
      <label for="pw">访问密码</label>
      <input id="pw" name="password" type="password" placeholder="请输入密码" autofocus required>
      <button type="submit" id="btn">登录</button>
      <div class="foot"></div>
    </form>
  </main>
  <script>
  document.getElementById("f").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = document.getElementById("btn");
    var pw = document.getElementById("pw").value;
    btn.disabled = true;
    btn.textContent = "验证中…";
    try {
      var nextPath = location.pathname + location.search + location.hash;
      var res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, next: nextPath })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        location.replace(location.pathname + "?e=1");
        return;
      }
      location.replace(data.next || "/?cnsc_shop_id=864505556");
    } catch (err) {
      location.replace(location.pathname + "?e=1");
    }
  });
  </script>
</body>
</html>`;
}

function tokenFor(password) {
  let h = 2166136261;
  const s = "sc|" + password + "|gate";
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "v1_" + (h >>> 0).toString(16);
}

function getCookie(req, name) {
  const raw = req.headers.get("Cookie") || "";
  const parts = raw.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function passwordFromEnv(env) {
  return (env && env.DEMO_GATE_PASSWORD) || DEFAULT_PASS;
}

function cookieParts(name, value, secure, maxAge) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ];
  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  return parts.filter(Boolean).join("; ");
}

function withSecurityHeaders(res) {
  const headers = new Headers(res.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cache-Control", "no-store");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function gateResponse(err) {
  return new Response(gateHtml(err), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function handleLogin(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body = {};
  try {
    body = await request.json();
  } catch (_) {}
  const pass = passwordFromEnv(env);
  if (!body.password || body.password !== pass) {
    return new Response(JSON.stringify({ ok: false, error: "密码错误" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  const token = tokenFor(pass);
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  // Session cookie: survives in-tab navigation (home <-> BI), cleared when browser closes.
  const cookie = cookieParts(COOKIE, token, secure);

  let next = "/?cnsc_shop_id=864505556";
  if (typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//")) {
    // Keep admin / datacenter deep links after login; avoid sending users to the gate URL itself.
    const n = body.next.split("?")[0];
    if (n !== "/" && n !== "/index.html") next = body.next;
    else if (body.next.indexOf("cnsc_shop_id=") >= 0) next = body.next;
  }

  return new Response(
    JSON.stringify({ ok: true, next: next }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookie,
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const method = request.method.toUpperCase();

  if (url.pathname === "/api/login") {
    return handleLogin(context);
  }

  if (url.pathname === "/api/logout") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": cookieParts(COOKIE, "", secure, 0),
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  // Public read for BI front page (and default JSON seed).
  if (
    method === "GET" &&
    (url.pathname === "/api/bi-data" || url.pathname === "/bi-data.default.json")
  ) {
    return withSecurityHeaders(await next());
  }

  const expected = tokenFor(passwordFromEnv(env));
  const got = getCookie(request, COOKIE);
  if (got === expected) {
    return withSecurityHeaders(await next());
  }

  // Unauthenticated writes blocked.
  if (url.pathname === "/api/bi-data" && (method === "PUT" || method === "POST")) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const accept = request.headers.get("Accept") || "";
  const wantsHtml =
    method === "GET" &&
    (accept.includes("text/html") ||
      url.pathname === "/" ||
      url.pathname.endsWith(".html") ||
      url.pathname.endsWith("/"));

  if (!wantsHtml) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const err = url.searchParams.get("e") === "1" ? "密码错误，请重试" : "";
  return gateResponse(err);
}
