# ⚡ BestCF · CF 官方域名在线优选

在线优选 Cloudflare 官方域名的纯静态网页工具。输入一批由 Cloudflare CDN 承载的域名，通过请求其 `/cdn-cgi/trace` 端点实测延迟，快速筛出当前网络环境下最快的优选域名。

> ⚠️ 仅支持 Cloudflare CDN 上可正常访问的网站域名，无法优选第三方「CF 优选域名」。

## ✨ 功能特性

- 🌐 IPv4 / IPv6 双栈网络环境自动检测（仅限 CN 直连网络在线优选）
- 📥 CF 域名一键导入（内置 `cf_domains.txt`）或手动输入
- ⚡ 多线程并发测速，每个域名串行 3 次 GET 取最小延迟
- 🔀 结果排序 / 筛选（优选类型、国家地区、数据中心）/ 拖拽多选
- 📋 一键复制 / 导出 TXT / 导出 CSV
- 🌓 深色 / 浅色主题自适应

## 📦 安装 / 部署

纯静态项目（HTML + CSS + JS），零依赖、无构建步骤。

### 💻 方式一：本地运行

```bash
git clone https://github.com/cmliu/CF-Pages-BestCF.git
cd CF-Pages-BestCF

# 任选一种静态服务器
python -m http.server 8080
# 或
npx serve .
```

浏览器访问 `http://localhost:8080` 即可。

> 🚫 注意：不要直接双击 `index.html` 打开（`file://` 协议下「CF域名导入」的 fetch 请求会被浏览器拦截），需通过 HTTP 服务访问。

### ☁️ 方式二：部署到 Cloudflare Pages

1. Fork 本仓库到自己的 GitHub 账号
2. 打开 Cloudflare Dashboard → **Workers 和 Pages** → 创建 **Pages** → 连接 Git 仓库
3. 项目配置：**构建命令留空**，**输出目录填 `/`**（根目录）
4. 部署完成后访问 `https://<你的项目名>.pages.dev`

## 🚀 使用示例

1. **打开页面**，等待自动检测网络环境（IPv4 / IPv6）。若检测到代理、VPN 或境外网络会弹出「红牌警告」，此时只能改用弹窗中的「本地优选」工具目录。
2. **填充待选列表**，两种方式任选：
   - 点击「CF域名导入」，载入内置 `cf_domains.txt` 域名列表；
   - 或在文本框中手动粘贴，每行一个域名：

   ```text
   dash.cloudflare.com
   cf.example.com:8443
   ```

3. **（可选）调整参数**：

   | 参数 | 默认值 | 说明 |
   | --- | --- | --- |
   | 超时时间 | 500 ms | 单次请求超时上限 |
   | 并发线程 | 16 | 同时测速的域名数量 |
   | 优选端口 | 随机 | 从 443 / 2053 / 2083 / 2087 / 2096 / 8443 中随机选取，也可固定指定 |

4. **点击「优选延迟」**，等待进度条完成，可随时点击「停止优选」。
5. **处理优选结果**：按延迟排序、按类型 / 国家地区 / 数据中心筛选、勾选需要的条目（支持按住鼠标拖选），最后复制到粘贴板或导出 TXT / CSV。

复制结果格式示例：

```text
dash.cloudflare.com:443#CN 优选域名[dash.cloudflare.com 87ms]
```

## 🤝 贡献指南

- 🐛 **反馈问题**：提交 [Issue](https://github.com/cmliu/CF-Pages-BestCF/issues)，附上复现步骤、截图与浏览器控制台日志。
- 🔧 **提交代码**：Fork → 新建分支 → 修改 → 发起 Pull Request。项目无构建流程，本地起一个静态服务即可验证改动。
- 📡 **域名投稿**：向 `cf_domains.txt` 添加候选域名时，请确保该域名由 Cloudflare CDN 承载、可公开访问且长期稳定。
- ✅ 提交前请保持原有代码风格与缩进（Tab 缩进）。

## 📄 License

[Apache-2.0](LICENSE)
