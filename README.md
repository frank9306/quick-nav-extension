# QuickNav Extension

QuickNav 是一个浏览器新标签页扩展，用个人导航站替换默认新标签页，方便快速打开常用网站、管理收藏和记录每日备忘。

## 功能特性

- 新标签页导航：卡片式展示常用网站，支持分类筛选和响应式布局。
- 智能搜索：支持标题、描述、域名搜索，也支持 `#标签` 和 `@分类` 搜索。
- 快速添加：支持扩展弹窗添加当前页面，也支持右键菜单添加当前页面或链接。
- 导航管理：支持添加、编辑、删除、批量删除、置顶、手动排序和刷新网站图标。
- 自动图标：根据网站域名自动生成 favicon，卡片更容易识别。
- 最近访问：记录点击时间并展示最近访问的网站。
- 数据备份：支持 JSON 导入导出，导入或重置前自动创建本地恢复点。
- 背景设置：支持 Bing 壁纸、自定义图片链接、本地图片和轮播间隔。
- 每日备忘：支持按日期记录任务、完成任务、删除任务和收起备忘录。

## 页面说明

- `src/newtab.tsx`：新标签页主界面，包含导航卡片、搜索、分类筛选、背景和每日备忘。
- `src/options.tsx`：管理页面，包含导航管理、背景设置、导入导出和恢复点。
- `src/popup.tsx`：扩展弹窗，用于快速添加当前标签页。
- `src/background.ts`：扩展后台逻辑，处理右键菜单等浏览器事件。
- `src/storage.ts`：导航数据、背景设置、恢复点等 Chrome Storage 读写逻辑。
- `src/memo-storage.ts`：每日备忘 IndexedDB 存储逻辑。
- `src/nav-utils.ts`：URL 规范化、重复检测、排序、搜索过滤等纯函数。

## 技术栈

- Plasmo Framework
- React 18
- TypeScript
- Chrome Storage API
- IndexedDB
- Vitest

## 开发命令

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm package
```

## 本地安装

1. 执行 `pnpm build` 构建扩展。
2. 打开 Chrome，进入 `chrome://extensions/`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择 `build/chrome-mv3-prod` 目录。

## 数据格式

导出的备份文件包含导航项、背景设置和备忘录数据：

```json
{
  "version": 1,
  "exportedAt": 1727337600000,
  "navItems": [
    {
      "id": "example-id",
      "title": "Example",
      "url": "https://example.com/",
      "description": "示例网站",
      "category": "工具",
      "tags": ["示例"],
      "favicon": "https://www.google.com/s2/favicons?domain=example.com&sz=64",
      "clicks": 0,
      "pinned": false,
      "order": 0,
      "createdAt": 1727337600000,
      "updatedAt": 1727337600000
    }
  ],
  "backgroundSettings": {
    "urls": [],
    "interval": 30000
  },
  "memoDays": []
}
```

## 权限说明

- `tabs`：读取当前标签页标题和 URL，用于快速添加。
- `storage`：保存导航数据、背景设置和界面状态。
- `contextMenus`：提供右键菜单添加入口。
- `https://*/*`：支持读取网页相关信息和访问网络资源。

## 后续计划

- 批量修改分类和标签。
- 分类重命名与合并。
- 分组视图和主题定制。
- 命令面板。
- 轻量云同步。
- 访问统计面板。
