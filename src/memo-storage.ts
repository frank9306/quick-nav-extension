export interface MemoTask {
  id: string
  text: string
  completed: boolean
  createdAt: number
  updatedAt: number
}

export interface MemoDayRecord {
  date: string
  tasks: MemoTask[]
  updatedAt: number
}

const DB_NAME = "quick-nav-db"
const DB_VERSION = 1
const MEMO_STORE = "memo-days"

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(MEMO_STORE)) {
        db.createObjectStore(MEMO_STORE, { keyPath: "date" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runStoreRequest<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(db => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(MEMO_STORE, mode)
    const store = transaction.objectStore(MEMO_STORE)
    const request = callback(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  }))
}

function normalizeTasks(tasks: MemoTask[]): MemoTask[] {
  return tasks
    .filter(task => task && typeof task.text === "string" && task.text.trim())
    .map(task => ({
      id: task.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text: task.text.trim(),
      completed: Boolean(task.completed),
      createdAt: task.createdAt || Date.now(),
      updatedAt: task.updatedAt || Date.now()
    }))
}

function isDateKey(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

export class MemoStorage {
  static async getTasks(date: string): Promise<MemoTask[]> {
    if (!isDateKey(date)) return []

    const record = await runStoreRequest<MemoDayRecord | undefined>("readonly", store => store.get(date))
    return record?.tasks || []
  }

  static async setTasks(date: string, tasks: MemoTask[]): Promise<void> {
    if (!isDateKey(date)) return

    const record: MemoDayRecord = {
      date,
      tasks: normalizeTasks(tasks),
      updatedAt: Date.now()
    }

    await runStoreRequest<IDBValidKey>("readwrite", store => store.put(record))
  }

  static async addTask(date: string, text: string): Promise<MemoTask> {
    const trimmedText = text.trim()
    if (!trimmedText) {
      throw new Error("Task text cannot be empty")
    }

    const now = Date.now()
    const task: MemoTask = {
      id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
      text: trimmedText,
      completed: false,
      createdAt: now,
      updatedAt: now
    }
    const tasks = await this.getTasks(date)
    await this.setTasks(date, [...tasks, task])
    return task
  }

  static async toggleTask(date: string, id: string): Promise<MemoTask | null> {
    const tasks = await this.getTasks(date)
    const index = tasks.findIndex(task => task.id === id)
    if (index === -1) return null

    const updatedTask = {
      ...tasks[index],
      completed: !tasks[index].completed,
      updatedAt: Date.now()
    }
    tasks[index] = updatedTask
    await this.setTasks(date, tasks)
    return updatedTask
  }

  static async deleteTask(date: string, id: string): Promise<boolean> {
    const tasks = await this.getTasks(date)
    const nextTasks = tasks.filter(task => task.id !== id)
    if (nextTasks.length === tasks.length) return false

    await this.setTasks(date, nextTasks)
    return true
  }

  static async getAllDays(): Promise<MemoDayRecord[]> {
    const days = await runStoreRequest<MemoDayRecord[]>("readonly", store => store.getAll())
    return days.sort((a, b) => a.date.localeCompare(b.date))
  }

  static async importDays(days: MemoDayRecord[]): Promise<void> {
    if (!Array.isArray(days)) return

    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(MEMO_STORE, "readwrite")
      const store = transaction.objectStore(MEMO_STORE)

      days.forEach(day => {
        if (!day || !isDateKey(day.date) || !Array.isArray(day.tasks)) return

        store.put({
          date: day.date,
          tasks: normalizeTasks(day.tasks),
          updatedAt: day.updatedAt || Date.now()
        } satisfies MemoDayRecord)
      })

      transaction.oncomplete = () => {
        db.close()
        resolve()
      }
      transaction.onerror = () => {
        db.close()
        reject(transaction.error)
      }
    })
  }
}
