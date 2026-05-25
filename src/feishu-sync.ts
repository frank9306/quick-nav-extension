import type { FeishuRecord, FeishuSyncSettings } from "./sync-types"

interface FeishuTokenResponse {
  code: number
  msg: string
  tenant_access_token?: string
  expire?: number
}

interface FeishuListResponse {
  code: number
  msg: string
  data?: {
    has_more?: boolean
    page_token?: string
    items?: Array<{
      record_id?: string
      id?: string
      fields?: Record<string, unknown>
    }>
  }
}

interface FeishuWriteResponse {
  code: number
  msg: string
  data?: {
    record?: {
      record_id?: string
      id?: string
    }
  }
}

interface FeishuFieldListResponse {
  code: number
  msg: string
  data?: {
    has_more?: boolean
    page_token?: string
    items?: Array<{
      field_name?: string
      type?: number
    }>
  }
}

interface RequiredFeishuField {
  fieldName: string
  type: number
}

export const requiredFeishuFields: RequiredFeishuField[] = [
  { fieldName: "syncId", type: 1 },
  { fieldName: "title", type: 1 },
  { fieldName: "url", type: 1 },
  { fieldName: "description", type: 1 },
  { fieldName: "category", type: 1 },
  { fieldName: "tags", type: 1 },
  { fieldName: "favicon", type: 1 },
  { fieldName: "clicks", type: 2 },
  { fieldName: "pinned", type: 7 },
  { fieldName: "order", type: 2 },
  { fieldName: "lastVisitedAt", type: 2 },
  { fieldName: "createdAt", type: 2 },
  { fieldName: "updatedAt", type: 2 },
  { fieldName: "deletedAt", type: 2 },
  { fieldName: "payload", type: 1 }
]

function assertFeishuSuccess(response: { code: number, msg: string }): void {
  if (response.code !== 0) {
    throw new Error(`飞书接口失败（${response.code}）：${response.msg || "未知错误"}`)
  }
}

export class FeishuSyncClient {
  private settings: FeishuSyncSettings
  private tenantAccessToken: string | null = null

  constructor(settings: FeishuSyncSettings) {
    this.settings = settings
  }

  private validateSettings(): void {
    if (!this.settings.appId || !this.settings.appSecret || !this.settings.appToken || !this.settings.tableId) {
      throw new Error("请先完整填写飞书 App ID、App Secret、App Token 和 Table ID")
    }
  }

  async getTenantAccessToken(): Promise<string> {
    this.validateSettings()
    if (this.tenantAccessToken) return this.tenantAccessToken

    const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        app_id: this.settings.appId,
        app_secret: this.settings.appSecret
      })
    })
    const data = await response.json() as FeishuTokenResponse
    assertFeishuSuccess(data)

    if (!data.tenant_access_token) {
      throw new Error("飞书未返回 tenant_access_token")
    }

    this.tenantAccessToken = data.tenant_access_token
    return data.tenant_access_token
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getTenantAccessToken()
    const response = await fetch(`https://open.feishu.cn/open-apis${path}`, {
      ...init,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
        ...(init?.headers || {})
      }
    })

    if (!response.ok) {
      throw new Error(`飞书 HTTP 请求失败（${response.status}）：${await response.text()}`)
    }

    return await response.json() as T
  }

  async listRecords(): Promise<FeishuRecord[]> {
    const records: FeishuRecord[] = []
    let pageToken = ""

    do {
      const searchParams = new URLSearchParams({ page_size: "500" })
      if (pageToken) searchParams.set("page_token", pageToken)

      const data = await this.request<FeishuListResponse>(`/bitable/v1/apps/${this.settings.appToken}/tables/${this.settings.tableId}/records?${searchParams.toString()}`)
      assertFeishuSuccess(data)

      records.push(...(data.data?.items || []).map(record => ({
        recordId: record.record_id || record.id || "",
        fields: record.fields || {}
      })).filter(record => record.recordId))

      pageToken = data.data?.has_more ? (data.data.page_token || "") : ""
    } while (pageToken)

    return records
  }

  async listFields(): Promise<string[]> {
    const fields: string[] = []
    let pageToken = ""

    do {
      const searchParams = new URLSearchParams({ page_size: "100" })
      if (pageToken) searchParams.set("page_token", pageToken)

      const data = await this.request<FeishuFieldListResponse>(`/bitable/v1/apps/${this.settings.appToken}/tables/${this.settings.tableId}/fields?${searchParams.toString()}`)
      assertFeishuSuccess(data)

      fields.push(...(data.data?.items || []).map(field => field.field_name || "").filter(Boolean))
      pageToken = data.data?.has_more ? (data.data.page_token || "") : ""
    } while (pageToken)

    return fields
  }

  async createField(fieldName: string, type: number): Promise<void> {
    const data = await this.request<FeishuWriteResponse>(`/bitable/v1/apps/${this.settings.appToken}/tables/${this.settings.tableId}/fields`, {
      method: "POST",
      body: JSON.stringify({
        field_name: fieldName,
        type
      })
    })
    assertFeishuSuccess(data)
  }

  async ensureRequiredFields(): Promise<string[]> {
    const existingFields = new Set(await this.listFields())
    const createdFields: string[] = []

    for (const field of requiredFeishuFields) {
      if (existingFields.has(field.fieldName)) continue

      await this.createField(field.fieldName, field.type)
      createdFields.push(field.fieldName)
      existingFields.add(field.fieldName)
    }

    return createdFields
  }

  async createRecord(fields: Record<string, unknown>): Promise<string> {
    const data = await this.request<FeishuWriteResponse>(`/bitable/v1/apps/${this.settings.appToken}/tables/${this.settings.tableId}/records`, {
      method: "POST",
      body: JSON.stringify({ fields })
    })
    assertFeishuSuccess(data)

    return data.data?.record?.record_id || data.data?.record?.id || ""
  }

  async updateRecord(recordId: string, fields: Record<string, unknown>): Promise<void> {
    const data = await this.request<FeishuWriteResponse>(`/bitable/v1/apps/${this.settings.appToken}/tables/${this.settings.tableId}/records/${recordId}`, {
      method: "PUT",
      body: JSON.stringify({ fields })
    })
    assertFeishuSuccess(data)
  }

  async testConnection(): Promise<number> {
    const records = await this.listRecords()
    return records.length
  }
}
