import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  all_frames: false
}

// 监听右键点击事件，获取更多上下文信息
document.addEventListener('contextmenu', (event) => {
  const target = event.target as HTMLElement
  let contextInfo = {
    url: window.location.href,
    title: document.title,
    selectedText: window.getSelection()?.toString() || "",
    linkUrl: "",
    linkText: ""
  }

  // 如果右键点击的是链接
  if (target.tagName === 'A' || target.closest('a')) {
    const link = target.tagName === 'A' ? target as HTMLAnchorElement : target.closest('a') as HTMLAnchorElement
    if (link) {
      contextInfo.linkUrl = link.href
      contextInfo.linkText = link.textContent?.trim() || ""
    }
  }

  // 将上下文信息存储，供后台脚本使用
  chrome.storage.local.set({ 'contextMenuInfo': contextInfo })
})

// 监听来自popup或background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script 收到消息:", request.action)
  
  if (request.action === "ping") {
    console.log("Content script ping 响应")
    sendResponse({ pong: true })
    return false
  }
  
  if (request.action === "getPageInfo") {
    try {
      const pageInfo = {
        url: window.location.href,
        title: document.title,
        description: getPageDescription(),
        favicon: getFavicon()
      }
      console.log("发送页面信息:", pageInfo)
      sendResponse(pageInfo)
    } catch (error) {
      console.error("获取页面信息失败:", error)
      sendResponse({ error: error.message })
    }
    return false // 同步响应
  }
  
  // 对于未处理的消息，返回false
  return false
})

// 获取页面描述
function getPageDescription(): string {
  // 尝试从meta标签获取描述
  const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement
  if (metaDesc && metaDesc.content) {
    return metaDesc.content.substring(0, 200)
  }

  // 尝试从og:description获取
  const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement
  if (ogDesc && ogDesc.content) {
    return ogDesc.content.substring(0, 200)
  }

  // 从页面内容获取第一段文字
  const paragraphs = document.querySelectorAll('p')
  for (const p of paragraphs) {
    const text = p.textContent?.trim()
    if (text && text.length > 20) {
      return text.substring(0, 200)
    }
  }

  return ""
}

// 获取网站图标
function getFavicon(): string {
  // 尝试获取各种类型的favicon
  const iconSelectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]', 
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]'
  ]

  for (const selector of iconSelectors) {
    const icon = document.querySelector(selector) as HTMLLinkElement
    if (icon && icon.href) {
      return icon.href
    }
  }

  // 默认favicon路径
  return `${window.location.origin}/favicon.ico`
}

console.log("Quick Nav content script loaded")