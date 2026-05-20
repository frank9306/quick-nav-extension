import { useState, useEffect } from "react"
import { DuplicateNavItemError, NavStorage, getStorageUsage } from "./storage"
import { MessageUtils } from "./message-utils"
import type { NavItem } from "./storage"

function IndexPopup() {
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("工具")
  const [customCategory, setCustomCategory] = useState("")
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [tags, setTags] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [storageInfo, setStorageInfo] = useState<{ used: number, available: number, percent: number } | null>(null)

  useEffect(() => {
    // 加载现有分类
    loadCategories()
    
    // 尝试获取当前标签页信息
    getCurrentTabInfo()

    // 获取存储空间信息
    getStorageUsage().then(setStorageInfo)
  }, [])

  const loadCategories = async () => {
    try {
      const categories = await NavStorage.getCategories()
      setAvailableCategories(["工具", "学习", "娱乐", "工作", ...categories])
    } catch (error) {
      console.error("加载分类失败:", error)
    }
  }

  const getCurrentTabInfo = async () => {
    try {
      // 首先检查是否有来自右键菜单的待处理数据
      const pendingData = await chrome.storage.local.get(['pendingAdd'])
      if (pendingData.pendingAdd) {
        const { url: pendingUrl, title: pendingTitle, description: pendingDescription } = pendingData.pendingAdd
        setUrl(pendingUrl)
        setTitle(pendingTitle)
        setDescription(pendingDescription)
        
        // 清除临时数据
        await chrome.storage.local.remove(['pendingAdd'])
        
        // 获取智能建议
        if (pendingUrl) {
          const suggestedCategory = await NavStorage.suggestCategory(pendingUrl, pendingTitle)
          const suggestedTags = await NavStorage.suggestTags(pendingUrl, pendingTitle, pendingDescription)
          setCategory(suggestedCategory)
          setTags(suggestedTags.join(", "))
        }
        return
      }
      
      // 如果没有待处理数据，获取当前标签页信息
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.url && tab.title) {
        setUrl(tab.url)
        setTitle(tab.title)
        
        // 尝试从内容脚本获取更详细的信息
        let pageDescription = ""
        if (tab.id) {
          try {
            console.log("Popup: 向标签页发送消息:", tab.id)
            const response = await MessageUtils.getPageInfo(tab.id)
            console.log("Popup: 收到内容脚本响应:", response)
            
            if (response) {
              pageDescription = response.description || ""
              if (pageDescription) {
                setDescription(pageDescription)
              }
            }
          } catch (e) {
            console.log("从内容脚本获取详细信息失败:", e)
          }
        }

        // 使用智能建议
        const suggestedCategory = NavStorage.suggestCategory(tab.url, tab.title)
        const suggestedTags = NavStorage.suggestTags(tab.url, tab.title, pageDescription)
        
        setCategory(suggestedCategory)
        setTags(suggestedTags.join(", "))
      }
    } catch (error) {
      console.error("获取当前标签页信息失败:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title || !url) {
      setMessage("请填写标题和URL")
      return
    }

    setIsSubmitting(true)
    setMessage("")

    try {
      const tagsArray = tags.split(",").map(tag => tag.trim()).filter(Boolean)
      const finalCategory = isCustomCategory ? customCategory.trim() : category
      
      if (!finalCategory) {
        setMessage("请选择或输入分类")
        setIsSubmitting(false)
        return
      }
      
      await NavStorage.addNavItem({
        title,
        url,
        description,
        category: finalCategory,
        tags: tagsArray
      })

      setMessage("添加成功！")
      
      // 清空表单
      setTimeout(() => {
        setTitle("")
        setUrl("")
        setDescription("")
        setCustomCategory("")
        setIsCustomCategory(false)
        setCategory("工具")
        setTags("")
        setMessage("")
      }, 1000)
      
    } catch (error) {
      if (error instanceof DuplicateNavItemError) {
        setMessage(`已存在：${error.existingItem.title}`)
      } else {
        setMessage("添加失败，请重试")
        console.error("添加导航项失败:", error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ width: 400, padding: 20 }}>
      {/* 剩余空间提示 */}
      {storageInfo && (
        <div style={{ marginBottom: 12, fontSize: 12, color: storageInfo.percent > 90 ? "#ef4444" : "#64748b" }}>
          已用空间：{(storageInfo.used / 1024).toFixed(1)} KB / 10240 KB
          （{storageInfo.percent}%）
          {storageInfo.percent > 90 && <span>，空间即将用尽！</span>}
        </div>
      )}
      
      <h2 style={{ margin: "0 0 20px 0", fontSize: "18px", color: "#1e293b" }}>
        快速添加导航
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>
            标题 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="网站标题"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "14px"
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>
            URL *
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "14px"
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>
            描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简短描述这个网站..."
            rows={3}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "14px",
              resize: "vertical"
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>
            分类
          </label>
          
          {/* 分类选择模式切换 */}
          <div style={{ marginBottom: 8, display: "flex", gap: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", fontSize: "12px", cursor: "pointer" }}>
              <input
                type="radio"
                checked={!isCustomCategory}
                onChange={() => setIsCustomCategory(false)}
                style={{ marginRight: "4px" }}
              />
              选择现有分类
            </label>
            <label style={{ display: "flex", alignItems: "center", fontSize: "12px", cursor: "pointer" }}>
              <input
                type="radio"
                checked={isCustomCategory}
                onChange={() => setIsCustomCategory(true)}
                style={{ marginRight: "4px" }}
              />
              自定义分类
            </label>
          </div>

          {/* 分类输入框 */}
          {isCustomCategory ? (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="输入新的分类名称..."
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            />
          ) : (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            >
              {Array.from(new Set(availableCategories)).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: "14px", fontWeight: 500 }}>
            标签
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="用逗号分隔，如：AI,工具,学习"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "14px"
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "10px",
            background: isSubmitting ? "#94a3b8" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: isSubmitting ? "not-allowed" : "pointer"
          }}
        >
          {isSubmitting ? "添加中..." : "添加导航"}
        </button>
      </form>

      {message && (
        <div style={{
          marginTop: 12,
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "14px",
          textAlign: "center",
          background: message.includes("成功") ? "#dcfce7" : "#fef2f2",
          color: message.includes("成功") ? "#166534" : "#dc2626"
        }}>
          {message}
        </div>
      )}

      <div style={{ marginTop: 16, textAlign: "center" }}>
        <button
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") })}
          style={{
            background: "none",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            color: "#64748b",
            cursor: "pointer"
          }}
        >
          打开导航页面
        </button>
      </div>
    </div>
  )
}

export default IndexPopup
