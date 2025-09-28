// 导航数据存储服务
export interface NavItem {
  id: string
  title: string
  url: string
  description: string
  category: string
  tags: string[]
  favicon?: string
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'quick-nav-items'

// 默认数据
const defaultNavItems: NavItem[] = [
  {
    id: "2",
    title: "Google",
    url: "https://www.google.com/",
    description: "全球最大的搜索引擎",
    category: "搜索",
    tags: ["搜索", "英文"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "3",
    title: "知乎",
    url: "https://www.zhihu.com/",
    description: "中文问答社区",
    category: "社区",
    tags: ["问答", "中文"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "4",
    title: "GitHub",
    url: "https://github.com/",
    description: "全球最大的代码托管平台",
    category: "开发",
    tags: ["代码", "协作"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "5",
    title: "Bilibili",
    url: "https://www.bilibili.com/",
    description: "中国年轻人最喜欢的视频网站",
    category: "娱乐",
    tags: ["视频", "弹幕"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "6",
    title: "Stack Overflow",
    url: "https://stackoverflow.com/",
    description: "全球最大的开发者问答社区",
    category: "开发",
    tags: ["问答", "英文"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  // AI 平台
  {
    id: "7",
    title: "ChatGPT",
    url: "https://chat.openai.com/",
    description: "OpenAI 官方智能对话平台",
    category: "AI平台",
    tags: ["AI", "ChatGPT", "OpenAI"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "8",
    title: "豆包",
    url: "https://chat.doubao.com/",
    description: "字节跳动旗下 AI 对话平台",
    category: "AI平台",
    tags: ["AI", "豆包", "字节跳动"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "9",
    title: "DeepSeek",
    url: "https://chat.deepseek.com/",
    description: "国产大模型 DeepSeek 智能对话平台",
    category: "AI平台",
    tags: ["AI", "DeepSeek", "国产"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "10",
    title: "Claude",
    url: "https://claude.ai/",
    description: "Anthropic 公司推出的 AI 对话平台",
    category: "AI平台",
    tags: ["AI", "Claude", "Anthropic"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "11",
    title: "Grok",
    url: "https://grok.x.com/",
    description: "X（原 Twitter）旗下 AI 平台 Grok",
    category: "AI平台",
    tags: ["AI", "Grok", "X"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]

// 存储服务类
export class NavStorage {
  // 获取所有导航项
  static async getNavItems(): Promise<NavItem[]> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY])
      return result[STORAGE_KEY] || defaultNavItems
    } catch (error) {
      console.error('获取导航数据失败:', error)
      return defaultNavItems
    }
  }

  // 保存所有导航项
  static async setNavItems(items: NavItem[]): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: items })
    } catch (error) {
      console.error('保存导航数据失败:', error)
      throw error
    }
  }

  // 添加导航项
  static async addNavItem(item: Omit<NavItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<NavItem> {
    const items = await this.getNavItems()
    const newItem: NavItem = {
      ...item,
      id: Date.now().toString(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    items.push(newItem)
    await this.setNavItems(items)
    return newItem
  }

  // 更新导航项
  static async updateNavItem(id: string, updates: Partial<NavItem>): Promise<NavItem | null> {
    const items = await this.getNavItems()
    const index = items.findIndex(item => item.id === id)
    if (index === -1) return null

    const updatedItem = {
      ...items[index],
      ...updates,
      id, // 确保ID不变
      updatedAt: Date.now()
    }
    items[index] = updatedItem
    await this.setNavItems(items)
    return updatedItem
  }

  // 删除导航项
  static async deleteNavItem(id: string): Promise<boolean> {
    const items = await this.getNavItems()
    const filteredItems = items.filter(item => item.id !== id)
    if (filteredItems.length === items.length) return false

    await this.setNavItems(filteredItems)
    return true
  }

  // 获取所有分类
  static async getCategories(): Promise<string[]> {
    const items = await this.getNavItems()
    const categories = new Set(items.map(item => item.category))
    return Array.from(categories).sort()
  }

  // 获取所有标签
  static async getTags(): Promise<string[]> {
    const items = await this.getNavItems()
    const tags = new Set(items.flatMap(item => item.tags))
    return Array.from(tags).sort()
  }

  // 导入数据
  static async importNavItems(items: NavItem[]): Promise<void> {
    // 验证数据格式
    const validItems = items.filter(item => 
      item.title && item.url && item.category && Array.isArray(item.tags)
    ).map(item => ({
      ...item,
      id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: item.createdAt || Date.now(),
      updatedAt: Date.now()
    }))
    
    await this.setNavItems(validItems)
  }

  // 导出数据
  static async exportNavItems(): Promise<NavItem[]> {
    return await this.getNavItems()
  }

  // 重置为默认数据
  static async resetToDefault(): Promise<void> {
    await this.setNavItems(defaultNavItems)
  }

  // 智能分类建议
  static suggestCategory(url: string, title: string): string {
    const domain = new URL(url).hostname.toLowerCase()
    const text = (title + " " + url).toLowerCase()

    // AI/机器学习相关
    if (text.includes('ai') || text.includes('机器学习') || text.includes('chatgpt') || 
        text.includes('openai') || text.includes('huggingface') || text.includes('tensorflow')) {
      return "学习"
    }

    // 开发工具
    if (domain.includes('github') || domain.includes('stackoverflow') || domain.includes('npm') ||
        domain.includes('codepen') || text.includes('开发') || text.includes('代码')) {
      return "工具"
    }

    // 视频/娱乐
    if (domain.includes('youtube') || domain.includes('bilibili') || domain.includes('netflix') ||
        text.includes('视频') || text.includes('电影')) {
      return "娱乐"
    }

    // 学习/教育
    if (text.includes('教程') || text.includes('学习') || text.includes('课程') || text.includes('教育') ||
        domain.includes('edu') || text.includes('documentation') || text.includes('docs')) {
      return "学习"
    }

    // 新闻/资讯
    if (text.includes('新闻') || text.includes('资讯') || domain.includes('news') ||
        text.includes('tech') || text.includes('科技')) {
      return "工作"
    }

    // 购物
    if (domain.includes('amazon') || domain.includes('taobao') || domain.includes('jd') ||
        text.includes('购物') || text.includes('商城')) {
      return "娱乐"
    }

    // 默认返回工具
    return "工具"
  }

  // 智能标签建议
  static suggestTags(url: string, title: string, description: string): string[] {
    const domain = new URL(url).hostname.toLowerCase()
    const text = (title + " " + description + " " + url).toLowerCase()
    const tags: string[] = []

    // AI相关标签
    if (text.includes('ai') || text.includes('人工智能') || text.includes('机器学习')) {
      tags.push('AI')
    }
    if (text.includes('chatgpt') || text.includes('gpt')) {
      tags.push('ChatGPT')
    }

    // 开发相关标签
    if (text.includes('github') || domain.includes('github')) {
      tags.push('GitHub')
    }
    if (text.includes('javascript') || text.includes('js')) {
      tags.push('JavaScript')
    }
    if (text.includes('python')) {
      tags.push('Python')
    }
    if (text.includes('react') || text.includes('vue') || text.includes('angular')) {
      tags.push('前端')
    }

    // 平台/服务标签
    if (domain.includes('youtube')) {
      tags.push('YouTube')
    }
    if (domain.includes('bilibili')) {
      tags.push('B站')
    }
    if (text.includes('云服务') || text.includes('cloud')) {
      tags.push('云服务')
    }

    // 通用标签
    if (text.includes('工具')) {
      tags.push('工具')
    }
    if (text.includes('学习') || text.includes('教程')) {
      tags.push('学习')
    }
    if (text.includes('文档') || text.includes('docs')) {
      tags.push('文档')
    }

    return tags.slice(0, 5) // 最多返回5个标签
  }
}

// 获取存储使用情况
export async function getStorageUsage(): Promise<{ used: number, available: number, percent: number }> {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (used) => {
      const total = 10 * 1024 * 1024; // 10MB
      const available = total - used;
      const percent = Math.round((used / total) * 100);
      resolve({ used, available, percent });
    });
  });
}