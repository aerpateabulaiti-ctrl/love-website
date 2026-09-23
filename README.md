# 我们的专属小屋

原生 HTML、CSS 和 JavaScript 网站，保留原有 Supabase 数据和四张 Q 版导航画像。

本次更新：

- 手机端数据库与照片请求通过同域接口转发，降低直连 Supabase 失败的影响。
- 相册按拍摄日期排序、按月份分组；未填写拍摄日期的照片放在最后。
- 列表使用 640px WebP 预览图，接近屏幕时才加载；点击照片查看原图。
- 新上传照片自动生成预览图，预览失败时回退到原图。
- 浏览器只缓存版本化的预览图，不缓存数据库 API 响应；缓存上限 160 张。
- 奶油纸色界面、保留 Q 版原画的导航、手机底部导航。
- 34 个省级区域的矢量足迹地图，支持点击、键盘选择、缩放和拖动。
- 读取失败显示重试提示，保存失败保留原来的页面数据；不再自动写入示例记录。

## 部署

主站使用 Cloudflare Pages：静态输出目录为仓库根目录，`functions/` 会由 Pages 自动编译，无需新增数据库密钥。`_routes.json` 仅将 `/api/*` 和 `/media/photos/*` 交给函数处理，其余文件保持静态托管。

`server/proxy.mjs` 固定连接现有 Supabase 项目，只转发四张业务表及 `photos` 图片桶，沿用客户端已有公开凭证，不使用 service-role 权限。数据库响应和错误响应不缓存。

仓库同时保留 Vercel 转发配置。GitHub Pages 不支持服务器函数，所以访问 `*.github.io` 时保持原有直连行为；手机网络连接修复应使用 Cloudflare Pages 主站。

本地开发可使用 `npx wrangler pages dev .`。新版本保留原登录密码和数据库结构。回滚页面可恢复之前的 Git 提交；新增预览图位于独立的 `photos/thumbnails/v1/` 路径，原图没有被覆盖。

## 验证

无需额外依赖：

```sh
node scripts/test.cjs
node scripts/test-sw.cjs
node scripts/test-proxy.mjs
```

DOM 交互测试使用 jsdom 26.1.0，仅操作模拟记录：

```sh
npm install --prefix /tmp/love-tests jsdom@26.1.0 --no-audit --no-fund
JSDOM_PATH=/tmp/love-tests/node_modules/jsdom node scripts/test-dom.cjs
```

函数编译检查：

```sh
npx wrangler@4.45.0 pages functions build --outdir /tmp/love-functions-build
```

## 地图来源

地图轮廓衍生自 [Supeset/China-GeoData](https://github.com/Supeset/China-GeoData)，进行了投影、路径简化和南海区域小图处理。完整 MIT 许可和源提交见 `assets/china-map-LICENSE.txt`。
