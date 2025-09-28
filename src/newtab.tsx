import { useState, useEffect, useRef } from "react"

import "./style.css"
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

function IndexNewtab() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("全部")
  const [navItems, setNavItems] = useState<NavItem[]>([])
  const [filteredItems, setFilteredItems] = useState<NavItem[]>([])
  const [loading, setLoading] = useState(true)
  const [bgUrls, setBgUrls] = useState<string[]>([]);
  const [bgIndex, setBgIndex] = useState(0);
  const [prevBgIndex, setPrevBgIndex] = useState(0);
  const [fade, setFade] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载数据
  useEffect(() => {
    loadNavItems();
    getBingWallpapers(8).then(urls => {
      setBgUrls(urls);
      setBgIndex(0);
      setPrevBgIndex(0);
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (bgUrls.length > 1) {
      timerRef.current = setInterval(() => {
        setPrevBgIndex(bgIndex);
        setFade(true);
        setBgIndex(idx => (idx + 1) % bgUrls.length);
        fadeTimerRef.current = setTimeout(() => setFade(false), 1200);
      }, 30000); // 30秒切换
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      };
    }
  }, [bgUrls, bgIndex]);

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
  const categories: Category[] = [
    { name: "全部", count: navItems.length },
    ...Object.entries(
      navItems.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    ).map(([name, count]) => ({ name, count }))
  ]

  // 搜索和过滤逻辑
  useEffect(() => {
    let filtered = navItems

    // 分类过滤
    if (selectedCategory !== "全部") {
      filtered = filtered.filter(item => item.category === selectedCategory)
    }

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    setFilteredItems(filtered)
  }, [searchQuery, selectedCategory, navItems])

  const handleRefreshData = () => {
    loadNavItems()
  }

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
      </div>
      {/* 内容层 */}
      <div className="nav-container" style={{ position: "relative", zIndex: 1 }}>
        {/* 头部 */}
        <header className="nav-header">
          <div className="header-top">
            <div className="header-text">
              <h1 className="nav-title">欢迎来到 QuickNav</h1>
              <p className="nav-subtitle">简洁的个人导航站，帮你快速找到常用网站和工具</p>
            </div>
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
          
          {/* 搜索框 */}
          <div className="search-container">
            <div className="search-box">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
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
        </header>

        <div className="nav-content">
          {/* 侧边栏分类 */}
          <aside className="nav-sidebar">
            <h3 className="sidebar-title">分类</h3>
            <ul className="category-list">
              {categories.map(category => (
                <li key={category.name}>
                  <button
                    className={`category-btn ${selectedCategory === category.name ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    <span className="category-name">{category.name}</span>
                    <span className="category-count">{category.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

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
                    <div key={item.id} className="nav-card">
                      <div className="card-header">
                        <h3 className="card-title">
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            {item.title}
                          </a>
                        </h3>
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
                        <span className="card-url">{new URL(item.url).hostname}</span>
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
