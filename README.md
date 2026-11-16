# cnsc-workbench-demo

Shopee 卖家中心静态演示站（首页 + 商业分析）+ 数据后台。

## 线上地址

- Cloudflare Pages（完整功能：密码门 / KV 后台）：https://cnsc-workbench-demo.pages.dev  
- 访问密码：见 Cloudflare 环境变量 `DEMO_GATE_PASSWORD`（本地 `wrangler.toml` 默认为演示密码）

## 为什么用 Cloudflare，而不是纯 GitHub Pages？

本项目依赖 Cloudflare Pages Functions：

- `_middleware.js`：访问密码闸
- `/api/bi-data` + KV：后台读写商业分析数据

GitHub Pages 只托管静态文件，无法直接跑上述能力。因此采用：

**GitHub 存代码 + Cloudflare 构建/部署**

## 本地部署

```bash
npm i -g wrangler
wrangler pages deploy ./cf-pages --project-name=cnsc-workbench-demo
```

需已登录 `wrangler login`，并绑定 KV `BI_DATA`。

## GitHub Actions 自动部署

仓库已包含 `.github/workflows/deploy-cloudflare.yml`。

在 GitHub → Settings → Secrets and variables → Actions 中配置：

- `CLOUDFLARE_API_TOKEN`：具有 Pages 编辑权限的 API Token  
- `CLOUDFLARE_ACCOUNT_ID`：账号 ID  

推送到 `main` 后会自动部署到 Cloudflare Pages。

## 目录

```
cf-pages/     # 静态站点（Pages 输出目录）
functions/    # Pages Functions（登录闸、bi-data API）
wrangler.toml # 项目名、KV、环境变量
```
