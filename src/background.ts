import { NavStorage } from "./storage"
import { MessageUtils } from "./message-utils"

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed, creating context menu...")
  
  chrome.contextMenus.create({
    id: "add-to-nav",
    title: "添加到导航站",
    contexts: ["page", "link"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("创建右键菜单失败:", chrome.runtime.lastError)
    } else {
      console.log("右键菜单创建成功")
    }
  })
})

// 也在startup时创建菜单，以防安装事件丢失
chrome.runtime.onStartup.addListener(() => {
  console.log("Extension startup, ensuring context menu exists...")
  
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "add-to-nav",
      title: "添加到导航站",
      contexts: ["page", "link"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    })
  })
})// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("右键菜单被点击:", info.menuItemId)
  
  if (info.menuItemId === "add-to-nav") {
    try {
      let url = info.linkUrl || tab?.url
      let title = ""
      let description = ""
      
      if (!url) {
        console.error("无法获取URL")
        return
      }

      // 如果点击的是链接
      if (info.linkUrl) {
        url = info.linkUrl
        title = info.selectionText || ""
        
        // 尝试从存储中获取上下文信息
        try {
          const result = await chrome.storage.local.get(['contextMenuInfo'])
          if (result.contextMenuInfo && result.contextMenuInfo.linkText) {
            title = result.contextMenuInfo.linkText
          }
        } catch (e) {
          console.log("获取上下文信息失败:", e)
        }
      } else {
        // 点击页面空白处，使用当前标签页信息
        title = tab?.title || ""
        
        // 尝试从内容脚本获取更多信息
        if (tab?.id) {
          try {
            console.log("向标签页发送消息:", tab.id)
            const response = await MessageUtils.getPageInfo(tab.id)
            if (response) {
              description = response.description || ""
              console.log("成功获取页面描述:", description.substring(0, 50) + "...")
            }
          } catch (e) {
            console.log("从内容脚本获取信息失败:", e)
          }
        }
      }

      // 将数据存储到临时存储，供popup使用
      await chrome.storage.local.set({
        pendingAdd: {
          url: url,
          title: title,
          description: description,
          timestamp: Date.now()
        }
      })
      
      // 打开popup
      await chrome.action.openPopup()
      
    } catch (error) {
      console.error("添加到导航失败:", error)
    }
  }
})

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("收到消息:", request.action)
  
  if (request.action === "addToNav") {
    // 可以在这里处理来自content script的添加请求
    console.log("收到添加请求:", request.data)
    sendResponse({ success: true })
    return false // 同步响应
  }
  
  if (request.action === "getPageInfo") {
    // 这个消息应该由content script处理，不是background script
    console.log("getPageInfo 请求应该由 content script 处理")
    sendResponse({ error: "Wrong target" })
    return false // 同步响应
  }
  
  // 对于未处理的消息，返回false表示同步处理
  return false
})

// 注意：我们不需要 chrome.action.onClicked 监听器
// 因为已经设置了 openPanelOnActionClick: true
// Chrome 会自动处理扩展图标点击并打开侧边栏

console.log("Quick Nav Extension background script loaded")
