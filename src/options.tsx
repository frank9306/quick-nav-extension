import { useState, useEffect } from "react"
import { MemoStorage } from "./memo-storage"
import type { MemoDayRecord } from "./memo-storage"
import { DuplicateNavItemError, NavStorage, getStorageUsage } from "./storage"
import type { BackgroundSettings, NavItem } from "./storage"

interface QuickNavBackup {
  version: 1
  exportedAt: number
  navItems: NavItem[]
  backgroundSettings: BackgroundSettings
  memoDays: MemoDayRecord[]
}

function isQuickNavBackup(data: unknown): data is Partial<QuickNavBackup> {
  return Boolean(data && typeof data === "object" && !Array.isArray(data) && "version" in data)
}

function IndexOptions() {
  const [navItems, setNavItems] = useState<NavItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<NavItem | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])

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
  const [formError, setFormError] = useState("")

  // 存储信息
  const [storageInfo, setStorageInfo] = useState<{ used: number, available: number, percent: number } | null>(null)
  const [backgroundSettings, setBackgroundSettings] = useState<BackgroundSettings>({ urls: [], interval: 30000 })
  const [backgroundUrl, setBackgroundUrl] = useState("")

  useEffect(() => {
    loadNavItems()
    loadCategories()
    loadBackgroundSettings()
    checkUrlParams()
    getStorageUsage().then(setStorageInfo)
  }, [])

  const loadBackgroundSettings = async () => {
    try {
      const settings = await NavStorage.getBackgroundSettings()
      setBackgroundSettings(settings)
    } catch (error) {
      console.error("加载背景设置失败:", error)
    }
  }

  const saveBackgroundSettings = async (settings: BackgroundSettings) => {
    await NavStorage.setBackgroundSettings(settings)
    setBackgroundSettings(settings)
    getStorageUsage().then(setStorageInfo)
  }

  const handleAddBackgroundUrl = async () => {
    const url = backgroundUrl.trim()
    if (!url) return

    try {
      new URL(url)
      await saveBackgroundSettings({
        ...backgroundSettings,
        urls: [...backgroundSettings.urls, url]
      })
      setBackgroundUrl("")
    } catch (error) {
      alert("请输入有效的图片链接")
    }
  }

  const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const imageFiles = files.filter(file => file.type.startsWith("image/"))
    if (imageFiles.length !== files.length) {
      alert("只能上传图片文件")
    }

    const dataUrls = await Promise.all(imageFiles.map(file => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })))

    await saveBackgroundSettings({
      ...backgroundSettings,
      urls: [...backgroundSettings.urls, ...dataUrls]
    })
    e.target.value = ""
  }

  const handleRemoveBackground = async (index: number) => {
    await saveBackgroundSettings({
      ...backgroundSettings,
      urls: backgroundSettings.urls.filter((_, currentIndex) => currentIndex !== index)
    })
  }

  const handleBackgroundIntervalChange = async (interval: number) => {
    await saveBackgroundSettings({
      ...backgroundSettings,
      interval
    })
  }

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

  const handleTogglePinned = async (id: string) => {
    try {
      await NavStorage.togglePinned(id)
      await loadNavItems()
    } catch (error) {
      console.error("切换置顶失败:", error)
    }
  }

  const handleToggleSelection = (id: string) => {
    setSelectedItemIds(ids => (
      ids.includes(id) ? ids.filter(itemId => itemId !== id) : [...ids, id]
    ))
  }

  const handleToggleSelectAll = () => {
    setSelectedItemIds(ids => (
      ids.length === navItems.length ? [] : navItems.map(item => item.id)
    ))
  }

  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) return
    if (!confirm(`确定要删除选中的 ${selectedItemIds.length} 个导航项吗？`)) return

    try {
      const selectedIds = new Set(selectedItemIds)
      const nextItems = navItems.filter(item => !selectedIds.has(item.id))
      await NavStorage.setNavItems(nextItems)
      setSelectedItemIds([])
      await loadNavItems()
      await loadCategories()
    } catch (error) {
      console.error("批量删除失败:", error)
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
    setFormError("")
    
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
      if (error instanceof DuplicateNavItemError) {
        setFormError(`已存在相同 URL：${error.existingItem.title}`)
      } else {
        setFormError("保存失败，请重试")
        console.error("保存失败:", error)
      }
    }
  }

  const handleExport = async () => {
    try {
      const items = await NavStorage.exportNavItems()
      const backgroundSettings = await NavStorage.getBackgroundSettings()
      const memoDays = await MemoStorage.getAllDays()
      const backup: QuickNavBackup = {
        version: 1,
        exportedAt: Date.now(),
        navItems: items,
        backgroundSettings,
        memoDays
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "quick-nav-backup.json"
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
        if (Array.isArray(data)) {
          await NavStorage.importNavItems(data)
        } else if (isQuickNavBackup(data)) {
          if (Array.isArray(data.navItems)) {
            await NavStorage.importNavItems(data.navItems)
          }

          if (data.backgroundSettings) {
            await NavStorage.setBackgroundSettings(data.backgroundSettings)
            await loadBackgroundSettings()
          }

          if (Array.isArray(data.memoDays)) {
            await MemoStorage.importDays(data.memoDays)
          }
        } else {
          throw new Error("Unsupported backup format")
        }

        await loadNavItems()
        getStorageUsage().then(setStorageInfo)
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

      {/* 背景设置 */}
      <div style={{ background: "white", padding: 24, borderRadius: "8px", marginBottom: 30, border: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: "0 0 8px 0" }}>背景设置</h3>
        <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: "14px" }}>
          可添加多个网络图片链接或本地图片，新标签页会自动轮播。未设置时继续使用 Bing 壁纸。
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 16 }}>
          <input
            type="url"
            value={backgroundUrl}
            onChange={(e) => setBackgroundUrl(e.target.value)}
            placeholder="输入图片链接，例如 https://example.com/background.jpg"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "4px" }}
          />
          <button type="button" onClick={handleAddBackgroundUrl} style={{ padding: "10px 20px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
            添加链接
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <label style={{ padding: "10px 20px", background: "#10b981", color: "white", borderRadius: "6px", cursor: "pointer" }}>
            上传本地图片
            <input type="file" accept="image/*" multiple onChange={handleUploadBackground} style={{ display: "none" }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: "14px" }}>
            轮播间隔
            <select
              value={backgroundSettings.interval}
              onChange={(e) => handleBackgroundIntervalChange(Number(e.target.value))}
              style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "4px" }}
            >
              <option value={10000}>10 秒</option>
              <option value={30000}>30 秒</option>
              <option value={60000}>60 秒</option>
              <option value={300000}>5 分钟</option>
            </select>
          </label>
          <span style={{ color: "#64748b", fontSize: "12px" }}>当前 {backgroundSettings.urls.length} 张</span>
        </div>

        {backgroundSettings.urls.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {backgroundSettings.urls.map((url, index) => (
              <div key={`${url}-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", background: "#f8fafc" }}>
                <div style={{ height: 90, background: `url(${url}) center/cover no-repeat` }} />
                <div style={{ padding: 10 }}>
                  <div title={url} style={{ color: "#64748b", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 8 }}>
                    {url.startsWith("data:") ? "本地图片" : url}
                  </div>
                  <button type="button" onClick={() => handleRemoveBackground(index)} style={{ width: "100%", padding: "6px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "8px" }}>
            暂未设置自定义背景，将使用 Bing 壁纸轮播
          </div>
        )}
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
            
            {formError && (
              <div style={{ marginBottom: 16, color: "#dc2626", fontSize: "14px" }}>
                {formError}
              </div>
            )}

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
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>导航列表 ({navItems.length})</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "13px", color: "#475569", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={navItems.length > 0 && selectedItemIds.length === navItems.length}
                  onChange={handleToggleSelectAll}
                />
                全选
              </label>
              <span style={{ fontSize: "13px", color: "#64748b" }}>已选 {selectedItemIds.length} 项</span>
              {selectedItemIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedItemIds([])}
                  style={{ padding: "6px 12px", background: "#6b7280", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                >
                  清空选择
                </button>
              )}
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedItemIds.length === 0}
                style={{ padding: "6px 12px", background: selectedItemIds.length === 0 ? "#cbd5e1" : "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: selectedItemIds.length === 0 ? "not-allowed" : "pointer", fontSize: "12px" }}
              >
                批量删除
              </button>
            </div>
          </div>
          
          {navItems.map((item) => (
            <div key={item.id} style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <label style={{ marginRight: 12, paddingTop: 2, cursor: "pointer" }} title="选择导航项">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => handleToggleSelection(item.id)}
                  />
                </label>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1e293b", textDecoration: "none" }}>
                      {item.title}
                    </a>
                  </h4>
                  <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "14px" }}>{item.description}</p>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: "12px", color: "#64748b" }}>
                    {item.pinned && <span>已置顶</span>}
                    <span>分类: {item.category}</span>
                    <span>标签: {item.tags.join(", ")}</span>
                    <span>点击: {item.clicks || 0}</span>
                    <span>{new URL(item.url).hostname}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleTogglePinned(item.id)}
                    style={{ padding: "4px 12px", background: item.pinned ? "#2563eb" : "#64748b", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                  >
                    {item.pinned ? "取消置顶" : "置顶"}
                  </button>
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
