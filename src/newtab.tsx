import { useState, useEffect, useRef } from "react"

import "./style.css"
import { MemoStorage } from "./memo-storage"
import type { MemoTask } from "./memo-storage"
import {
  ALL_CATEGORY_NAME,
  RECENT_CATEGORY_NAME,
  filterNavItems,
  getNavHostname,
  isEditableElement
} from "./nav-utils"
import { NavStorage } from "./storage"
import type { NavItem } from "./storage"

interface Category {
  name: string
  count: number
}

function getBingWallpapers(count: number = 8): Promise<string[]> {
  return fetch(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${count}`)
    .then(res => res.json())
    .then(data => {
      if (data.images) {
        return data.images.map((img: any) => 'https://www.bing.com' + img.url);
      }
      return [];
    })
    .catch(() => []);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function shiftDateKey(dateKey: string, offset: number): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + offset)
  return toDateKey(date)
}

function IndexNewtab() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY_NAME)
  const [navItems, setNavItems] = useState<NavItem[]>([])
  const [filteredItems, setFilteredItems] = useState<NavItem[]>([])
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [bgUrls, setBgUrls] = useState<string[]>([]);
  const [bgIndex, setBgIndex] = useState(0);
  const [prevBgIndex, setPrevBgIndex] = useState(0);
  const [fade, setFade] = useState(false);
  const [bgInterval, setBgInterval] = useState(30000);
  const [selectedMemoDate, setSelectedMemoDate] = useState(() => toDateKey(new Date()))
  const [memoTasks, setMemoTasks] = useState<MemoTask[]>([])
  const [memoInput, setMemoInput] = useState("")
  const [memoLoading, setMemoLoading] = useState(true)
  const [memoCollapsed, setMemoCollapsed] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)

  // 加载数据
  useEffect(() => {
    loadNavItems();
    loadBackgrounds();
    loadMemoUiSettings();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) {
        if (event.key === "Escape" && event.target === searchInputRef.current) {
          setSearchQuery("")
          searchInputRef.current?.blur()
        }
        return
      }

      if (event.key === "/" || (event.key.toLowerCase() === "k" && event.ctrlKey)) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (event.key === "Escape") {
        setSearchQuery("")
        searchInputRef.current?.blur()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const loadMemoUiSettings = async () => {
    try {
      const settings = await NavStorage.getMemoUiSettings()
      setMemoCollapsed(settings.collapsed)
    } catch (error) {
      console.error("加载备忘录界面设置失败:", error)
    }
  }

  const loadBackgrounds = async () => {
    const settings = await NavStorage.getBackgroundSettings();
    const urls = settings.urls.length > 0 ? settings.urls : await getBingWallpapers(8);
    setBgInterval(settings.interval);
    setBgUrls(urls);
    setBgIndex(0);
    setPrevBgIndex(0);
  }

  useEffect(() => {
    if (bgUrls.length > 1) {
      timerRef.current = setInterval(() => {
        setPrevBgIndex(bgIndex);
        setFade(true);
        setBgIndex(idx => (idx + 1) % bgUrls.length);
        fadeTimerRef.current = setTimeout(() => setFade(false), 1200);
      }, bgInterval); // 按设置间隔切换
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      };
    }
  }, [bgUrls, bgIndex, bgInterval]);

  useEffect(() => {
    loadMemoTasks(selectedMemoDate)
  }, [selectedMemoDate])

  const loadMemoTasks = async (dateKey: string) => {
    try {
      setMemoLoading(true)
      const tasks = await MemoStorage.getTasks(dateKey)
      setMemoTasks(tasks)
    } catch (error) {
      console.error("加载备忘录失败:", error)
      setMemoTasks([])
    } finally {
      setMemoLoading(false)
    }
  }

  const handleAddMemoTask = async () => {
    const text = memoInput.trim()
    if (!text) return

    try {
      const task = await MemoStorage.addTask(selectedMemoDate, text)
      setMemoTasks(tasks => [...tasks, task])
      setMemoInput("")
    } catch (error) {
      console.error("添加备忘任务失败:", error)
    }
  }

  const handleToggleMemoTask = async (id: string) => {
    try {
      const updatedTask = await MemoStorage.toggleTask(selectedMemoDate, id)
      if (!updatedTask) return

      setMemoTasks(tasks => tasks.map(task => task.id === id ? updatedTask : task))
    } catch (error) {
      console.error("更新备忘任务失败:", error)
    }
  }

  const handleDeleteMemoTask = async (id: string) => {
    try {
      const deleted = await MemoStorage.deleteTask(selectedMemoDate, id)
      if (deleted) {
        setMemoTasks(tasks => tasks.filter(task => task.id !== id))
      }
    } catch (error) {
      console.error("删除备忘任务失败:", error)
    }
  }

  const handleToggleMemoCollapsed = async () => {
    const nextCollapsed = !memoCollapsed
    setMemoCollapsed(nextCollapsed)

    try {
      await NavStorage.setMemoUiSettings({ collapsed: nextCollapsed })
    } catch (error) {
      console.error("保存备忘录收起状态失败:", error)
    }
  }

  const handleItemClick = async (item: NavItem) => {
    try {
      const updatedItem = await NavStorage.incrementClicks(item.id)
      if (!updatedItem) return

      setNavItems(items => items.map(currentItem => (
        currentItem.id === item.id ? updatedItem : currentItem
      )))
    } catch (error) {
      console.error('记录点击次数失败:', error)
    }
  }

  const handleTogglePinned = async (id: string) => {
    try {
      const updatedItem = await NavStorage.togglePinned(id)
      if (!updatedItem) return

      setNavItems(items => items.map(item => item.id === id ? updatedItem : item))
    } catch (error) {
      console.error("切换置顶失败:", error)
    }
  }

  const handleCopyUrl = async (item: NavItem) => {
    try {
      await navigator.clipboard.writeText(item.url)
      setCopiedItemId(item.id)
      window.setTimeout(() => {
        setCopiedItemId(currentId => currentId === item.id ? null : currentId)
      }, 1200)
    } catch (error) {
      console.error("复制链接失败:", error)
    }
  }

  const loadNavItems = async () => {
    try {
      setLoading(true)
      const items = await NavStorage.getNavItems()
      setNavItems(items)
    } catch (error) {
      console.error('加载导航数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 计算分类统计
  const recentCount = navItems.filter(item => item.lastVisitedAt).length
  const categories: Category[] = [
    { name: ALL_CATEGORY_NAME, count: navItems.length },
    { name: RECENT_CATEGORY_NAME, count: recentCount },
    ...Object.entries(
      navItems.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    ).map(([name, count]) => ({ name, count }))
  ]

  // 搜索和过滤逻辑
  useEffect(() => {
    setFilteredItems(filterNavItems(navItems, selectedCategory, searchQuery))
  }, [searchQuery, selectedCategory, navItems])

  const handleRefreshData = () => {
    loadNavItems()
  }

  const completedMemoCount = memoTasks.filter(task => task.completed).length
  const isTodayMemo = selectedMemoDate === toDateKey(new Date())

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {/* 背景层：前一张和当前张渐变切换 */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        {/* 前一张壁纸 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: bgUrls[prevBgIndex]
              ? `url(${bgUrls[prevBgIndex]}) center/cover no-repeat fixed`
              : undefined,
            opacity: fade ? 1 : 0,
            transition: "opacity 1.2s",
            willChange: "opacity"
          }}
        />
        {/* 当前壁纸 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: bgUrls[bgIndex]
              ? `url(${bgUrls[bgIndex]}) center/cover no-repeat fixed`
              : undefined,
            opacity: fade ? 0 : 1,
            transition: "opacity 1.2s",
            willChange: "opacity"
          }}
        />
        <div className="background-scrim" />
      </div>
      {/* 内容层 */}
      <div className="nav-container" style={{ position: "relative", zIndex: 1 }}>
        <section className={`memo-card ${memoCollapsed ? "collapsed" : ""}`} aria-label="每日备忘录">
          {memoCollapsed ? (
            <button type="button" className="memo-collapsed-pill" onClick={handleToggleMemoCollapsed} title="展开备忘录">
              <span>备忘</span>
              <strong>{completedMemoCount}/{memoTasks.length}</strong>
            </button>
          ) : (
            <>
              <div className="memo-date-row">
                <button
                  type="button"
                  className="memo-nav-btn"
                  onClick={() => setSelectedMemoDate(date => shiftDateKey(date, -1))}
                  title="前一天"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="memo-date-btn"
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  title="选择日期"
                >
                  {selectedMemoDate}
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={selectedMemoDate}
                  onChange={(event) => setSelectedMemoDate(event.target.value)}
                  className="memo-date-input"
                  aria-label="选择备忘录日期"
                />
                <button
                  type="button"
                  className="memo-nav-btn"
                  onClick={() => setSelectedMemoDate(date => shiftDateKey(date, 1))}
                  title="后一天"
                >
                  ›
                </button>
                <button type="button" className="memo-collapse-btn" onClick={handleToggleMemoCollapsed} title="收起备忘录">
                  −
                </button>
              </div>

              <div className="memo-summary">
                <span>{isTodayMemo ? "今天任务" : "当日任务"}</span>
                <strong>{completedMemoCount}/{memoTasks.length}</strong>
              </div>

              <div className="memo-task-list">
                {memoLoading ? (
                  <div className="memo-empty">加载中...</div>
                ) : memoTasks.length === 0 ? (
                  <div className="memo-empty">这天还没有任务</div>
                ) : memoTasks.map(task => (
                  <div key={task.id} className={`memo-task ${task.completed ? "completed" : ""}`}>
                    <button
                      type="button"
                      className="memo-check"
                      onClick={() => handleToggleMemoTask(task.id)}
                      title={task.completed ? "标记未完成" : "标记完成"}
                    >
                      {task.completed ? "✓" : ""}
                    </button>
                    <span className="memo-task-text">{task.text}</span>
                    <button
                      type="button"
                      className="memo-delete"
                      onClick={() => handleDeleteMemoTask(task.id)}
                      title="删除任务"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="memo-add-row">
                <input
                  type="text"
                  value={memoInput}
                  onChange={(event) => setMemoInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleAddMemoTask()
                  }}
                  placeholder="输入新任务..."
                  className="memo-input"
                />
                <button type="button" className="memo-add-btn" onClick={handleAddMemoTask}>+</button>
              </div>
            </>
          )}
        </section>

        {/* 头部 */}
        <header className="nav-header">
          <div className="header-top">
            <button 
              className="manage-btn"
              onClick={() => window.open(chrome.runtime.getURL("options.html"), '_blank')}
              title="管理导航"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="m12 1 2.09 7.91L22 9l-7.91 2.09L14 19l-2.09-7.91L4 11l7.91-2.09L12 1z"></path>
              </svg>
              管理
            </button>
          </div>

          <div className="hero-copy">
            <div className="hero-kicker">Personal launchpad</div>
            <h2 className="hero-title">QuickNav</h2>
            <p className="hero-subtitle">把常用网站放在最顺手的位置</p>
          </div>
          
          {/* 搜索框 */}
          <div className="search-container">
            <div className="search-box">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索网站、工具或标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <button onClick={handleRefreshData} className="refresh-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
              刷新数据
            </button>
          </div>

          <div className="category-strip" aria-label="分类筛选">
            {categories.map(category => (
              <button
                key={category.name}
                className={`category-btn ${selectedCategory === category.name ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.name)}
              >
                <span className="category-name">{category.name}</span>
                <span className="category-count">{category.count}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="nav-content">
          {/* 主内容区域 */}
          <main className="nav-main">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>加载中...</p>
              </div>
            ) : (
              <>
                <div className="nav-grid">
                  {filteredItems.map(item => (
                    <div key={item.id} className={`nav-card ${item.pinned ? "pinned" : ""}`}>
                      <span className="card-clicks" title="点击次数">{item.clicks || 0}</span>
                      <div className="card-header">
                        {item.favicon && <img src={item.favicon} alt="" className="card-favicon" />}
                        <h3 className="card-title">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleItemClick(item)}
                            onAuxClick={(event) => {
                              if (event.button === 1) handleItemClick(item)
                            }}
                          >
                            {item.title}
                          </a>
                        </h3>
                        <div className="card-actions">
                          <button
                            type="button"
                            className={`card-action-btn ${item.pinned ? "active" : ""}`}
                            onClick={() => handleTogglePinned(item.id)}
                            title={item.pinned ? "取消置顶" : "置顶"}
                          >
                            {item.pinned ? "已置顶" : "置顶"}
                          </button>
                          <button
                            type="button"
                            className="card-action-btn"
                            onClick={() => handleCopyUrl(item)}
                            title="复制链接"
                          >
                            {copiedItemId === item.id ? "已复制" : "复制"}
                          </button>
                        </div>
                      </div>
                      
                      <p className="card-description">{item.description}</p>
                      
                      <div className="card-tags">
                        {item.tags.map(tag => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      <div className="card-footer">
                        <span className="card-category">{item.category}</span>
                        <span className="card-url">{getNavHostname(item.url)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {!loading && filteredItems.length === 0 && (
                  <div className="empty-state">
                    <p>没有找到匹配的导航项目</p>
                    <p>试试调整搜索关键词或选择其他分类</p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default IndexNewtab
