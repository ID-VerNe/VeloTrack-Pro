export type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  /** 管理令牌（wrangler secret put ADMIN_TOKEN）。设置后所有写操作与 /api/admin/* 均需携带 Authorization: Bearer <token>；未设置时为开放模式（仅建议本地开发） */
  ADMIN_TOKEN?: string
  /** AI 服务商 API Key 的安全兜底值（wrangler secret put AI_API_KEY）。数据库中未配置 key 时使用 */
  AI_API_KEY?: string
}
