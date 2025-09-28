// 消息处理工具函数
export class MessageUtils {
  // 安全地向标签页发送消息
  static async sendMessageToTab(tabId: number, message: any, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`消息超时: ${timeout}ms`))
      }, timeout)

      chrome.tabs.sendMessage(tabId, message)
        .then(response => {
          clearTimeout(timeoutId)
          resolve(response)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  // 检查标签页是否可以接收消息
  static async checkTabReady(tabId: number): Promise<boolean> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: "ping" })
      return response && response.pong === true
    } catch (error) {
      return false
    }
  }

  // 获取页面信息的安全方法
  static async getPageInfo(tabId: number): Promise<any> {
    try {
      // 首先检查标签页是否准备好
      const isReady = await this.checkTabReady(tabId)
      if (!isReady) {
        console.log("标签页未准备好，跳过内容脚本请求")
        return null
      }

      // 发送获取页面信息的请求
      const response = await this.sendMessageToTab(tabId, { action: "getPageInfo" }, 3000)
      
      if (response && !response.error) {
        return response
      } else {
        throw new Error(response?.error || "无效响应")
      }
    } catch (error) {
      console.log("获取页面信息失败:", error.message)
      return null
    }
  }
}