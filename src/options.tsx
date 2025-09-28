import { useState, useEffect } from "react"
import { NavStorage, getStorageUsage } from "./storage"
import type { NavItem } from "./storage"

function IndexOptions() {
  const [navItems, setNavItems] = useState<NavItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<NavItem | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // 表单状态
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    description: "",
    category: "工具",
    tags: ""
  })
  const [customCategory, setCustomCategory] = useState("")
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<string[]>([])

  // 存储信息
  const [storageInfo, setStorageInfo] = useState<{ used: number, available: number, percent: number } | null>(null)

  useEffect(() => {
    loadNavItems()
    loadCategories()
    checkUrlParams()
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

  // 检查URL参数，处理从右键菜单传递的数据
  const checkUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const action = urlParams.get('action')
    const url = urlParams.get('url')
    const title = urlParams.get('title')
    const description = urlParams.get('description')
    
    if (action === 'add' && url) {
      const decodedUrl = decodeURIComponent(url)
      const decodedTitle = decodeURIComponent(title || "")
      const decodedDescription = decodeURIComponent(description || "")
      
      // 使用智能建议
      const suggestedCategory = NavStorage.suggestCategory(decodedUrl, decodedTitle)
      const suggestedTags = NavStorage.suggestTags(decodedUrl, decodedTitle, decodedDescription)
      
      setFormData({
        title: decodedTitle,
        url: decodedUrl,
        description: decodedDescription,
        category: suggestedCategory,
        tags: suggestedTags.join(", ")
      })
      setShowAddForm(true)
      
      // 清理URL参数
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  const loadNavItems = async () => {
    try {
      setLoading(true)
      const items = await NavStorage.getNavItems()
      setNavItems(items)
    } catch (error) {
      console.error("加载数据失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个导航项吗？")) return
    
    try {
      await NavStorage.deleteNavItem(id)
      await loadNavItems()
    } catch (error) {
      console.error("删除失败:", error)
    }
  }

  const handleEdit = (item: NavItem) => {
    setEditingItem(item)
    
    // 检查当前分类是否在可用分类列表中
    const isExistingCategory = availableCategories.includes(item.category)
    
    if (isExistingCategory) {
      setIsCustomCategory(false)
      setCustomCategory("")
      setFormData({
        title: item.title,
        url: item.url,
        description: item.description,
        category: item.category,
        tags: item.tags.join(", ")
      })
    } else {
      setIsCustomCategory(true)
      setCustomCategory(item.category)
      setFormData({
        title: item.title,
        url: item.url,
        description: item.description,
        category: "工具", // 设置默认值
        tags: item.tags.join(", ")
      })
    }
    setShowAddForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.url) return

    const finalCategory = isCustomCategory ? customCategory.trim() : formData.category
    if (!finalCategory) {
      alert("请选择或输入分类")
      return
    }

    try {
      const tagsArray = formData.tags.split(",").map(tag => tag.trim()).filter(Boolean)
      
      if (editingItem) {
        await NavStorage.updateNavItem(editingItem.id, {
          title: formData.title,
          url: formData.url,
          description: formData.description,
          category: finalCategory,
          tags: tagsArray
        })
      } else {
        await NavStorage.addNavItem({
          title: formData.title,
          url: formData.url,
          description: formData.description,
          category: finalCategory,
          tags: tagsArray
        })
      }

      setFormData({ title: "", url: "", description: "", category: "工具", tags: "" })
      setCustomCategory("")
      setIsCustomCategory(false)
      setEditingItem(null)
      setShowAddForm(false)
      await loadNavItems()
      await loadCategories() // 重新加载分类列表
    } catch (error) {
      console.error("保存失败:", error)
    }
  }

  const handleExport = async () => {
    try {
      const items = await NavStorage.exportNavItems()
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "nav-items.json"
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("导出失败:", error)
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        await NavStorage.importNavItems(data)
        await loadNavItems()
        alert("导入成功！")
      } catch (error) {
        console.error("导入失败:", error)
        alert("导入失败，请检查文件格式")
      }
    }
    reader.readAsText(file)
  }

  const handleReset = async () => {
    if (!confirm("确定要重置为默认数据吗？这会删除所有自定义导航项。")) return
    
    try {
      await NavStorage.resetToDefault()
      await loadNavItems()
    } catch (error) {
      console.error("重置失败:", error)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {/* 剩余空间提示 */}
      {storageInfo && (
        <div style={{ marginBottom: 12, fontSize: 12, color: storageInfo.percent > 90 ? "#ef4444" : "#64748b" }}>
          已用空间：{(storageInfo.used / 1024).toFixed(1)} KB / 10240 KB
          （{storageInfo.percent}%）
          {storageInfo.percent > 90 && <span>，空间即将用尽！</span>}
        </div>
      )}

      <header style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: "2rem", color: "#1e293b", margin: "0 0 8px 0" }}>
          导航管理
        </h1>
        <p style={{ color: "#64748b", margin: 0 }}>
          管理你的个人导航站点
        </p>
      </header>

      {/* 操作按钮 */}
      <div style={{ marginBottom: 30, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: "10px 20px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          {showAddForm ? "取消添加" : "添加导航"}
        </button>
        
        <button onClick={handleExport} style={{ padding: "10px 20px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
          导出数据
        </button>
        
        <label style={{ padding: "10px 20px", background: "#f59e0b", color: "white", borderRadius: "6px", cursor: "pointer" }}>
          导入数据
          <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
        </label>
        
        <button onClick={handleReset} style={{ padding: "10px 20px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
          重置数据
        </button>
      </div>

      {/* 添加/编辑表单 */}
      {showAddForm && (
        <div style={{ background: "white", padding: 24, borderRadius: "8px", marginBottom: 30, border: "1px solid #e2e8f0" }}>
          <h3>{editingItem ? "编辑导航" : "添加导航"}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>标题 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "4px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>URL *</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "4px" }}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "4px" }}
              />
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>分类</label>
                
                {/* 分类选择模式切换 */}
                <div style={{ marginBottom: 8, display: "flex", gap: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      checked={!isCustomCategory}
                      onChange={() => setIsCustomCategory(false)}
                      style={{ marginRight: "4px" }}
                    />
                    选择现有
                  </label>
                  <label style={{ display: "flex", alignItems: "center", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      checked={isCustomCategory}
                      onChange={() => setIsCustomCategory(true)}
                      style={{ marginRight: "4px" }}
                    />
                    自定义
                  </label>
                </div>

                {/* 分类输入框 */}
                {isCustomCategory ? (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="输入新的分类名称..."
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "4px" }}
                  />
                ) : (
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "4px" }}
                  >
                    {Array.from(new Set(availableCategories)).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>标签（用逗号分隔）</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "4px" }}
                />
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" style={{ padding: "10px 20px", background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                {editingItem ? "更新" : "添加"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingItem(null)
                  setFormData({ title: "", url: "", description: "", category: "工具", tags: "" })
                  setCustomCategory("")
                  setIsCustomCategory(false)
                }}
                style={{ padding: "10px 20px", background: "#6b7280", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 导航列表 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>加载中...</div>
      ) : (
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: 0 }}>导航列表 ({navItems.length})</h3>
          </div>
          
          {navItems.map((item) => (
            <div key={item.id} style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1e293b", textDecoration: "none" }}>
                      {item.title}
                    </a>
                  </h4>
                  <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "14px" }}>{item.description}</p>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: "12px", color: "#64748b" }}>
                    <span>分类: {item.category}</span>
                    <span>标签: {item.tags.join(", ")}</span>
                    <span>{new URL(item.url).hostname}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleEdit(item)}
                    style={{ padding: "4px 12px", background: "#f59e0b", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{ padding: "4px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {navItems.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              还没有任何导航项目
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default IndexOptions
