# XHS-Comment-Collector
____     _   _  __     __        ____ _       _   _ ____  
  / __ \   | | | | \ \   / /       / ___| |     | | | | __ ) 
 | |  | |  | |_| |  \ \_/ /  _____ | |   | |     | | | |  _ \ 
 | |__| |  |  _  |   \   /  |_____|| |___| |___  | |_| | |_) |
  \___\_\  |_| |_|    |_|           \____|_____|  \___/|____/
小红书评论采集助手 - Tampermonkey 脚本
# 🍠 小红书评论采集助手

&gt; ⚠️ **免责声明**：本脚本仅供个人学习研究使用，请严格遵守《小红书用户协议》及相关法律法规。禁止将采集数据用于骚扰、营销、数据贩卖等非法用途。使用者承担一切法律责任。

## 功能特性

- ✅ 自动拦截小红书 Web 端评论 API，无需手动抓包
- ✅ 采集一级评论 + 二级楼中楼回复
- ✅ 导出包含用户 ID、昵称、主页链接、IP 属地、点赞数的 CSV
- ✅ 支持小红书 SPA 单页应用，从首页点进笔记也能自动加载

## 安装方法

### 1. 安装 Tampermonkey 扩展
- [Chrome 商店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Edge 商店](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- [Firefox 商店](https://addons.mozilla.org/firefox/addon/tampermonkey/)

### 2. 安装脚本
**一键安装**（点击即可触发 Tampermonkey 安装提示）：

👉 **[点击安装脚本](https://github.com/IceArch/xhs-comment-collector/raw/main/xhs-comment-collector.user.js)**

&gt; 如果点击没有反应，复制下面的 Raw 链接，在 Tampermonkey 面板 → 实用工具 → 从 URL 安装，粘贴链接即可。

### 3. 手动安装
1. 复制脚本 Raw 链接：https://github.com/IceArch/xhs-comment-collector/raw/main/xhs-comment-collector.user.js
2. 打开 Tampermonkey 面板 → 点击 **"从 URL 安装"** → 粘贴链接 → 点击 **安装**

## 使用步骤

1. 打开任意小红书笔记页面（URL 包含 `/explore/` 或 `/discovery/item/`）
2. 等待 2 秒，右下角出现悬浮面板
3. 点击 **"自动展开全部评论"** 加载所有评论（含楼中楼）
4. 点击 **"导出 CSV"** 下载数据

## 导出字段说明

| 字段 | 说明 |
|------|------|
| 用户ID | 评论者的小红书 user_id |
| 用户主页 | 可直接点击访问的主页链接（含 xsec_token）|
| 评论内容 | 纯文本评论 |
| 点赞数 | 该评论获得的点赞 |
| 是否二级评论 | 一级/楼中楼标识 |

## 更新日志

### v1.3 (2026-05-28)
- 支持 SPA 路由监听，首页点进笔记自动触发
- 增加请求劫持，实时采集 API 数据
- 支持二级评论递归采集

## License
[MIT](LICENSE)
