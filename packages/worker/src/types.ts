export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  BUCKET?: R2Bucket
  SESSION_SECRET: string
  APP_DISABLE_REGISTRATION?: string
}

export interface User {
  id: string
  name: string
  email: string
  password_hash: string
  avatar?: string
  created_at: number
}

export interface Team {
  id: string
  name: string
  owner_id: string
  avatar?: string
  created_at: number
}

export interface Project {
  id: string
  team_id: string
  name: string
  owner_id: string
  icon?: string
  created_at: number
}

export interface FormRow {
  id: string
  team_id: string
  project_id: string
  member_id: string
  name: string
  description?: string
  interactive_mode: string
  kind: string
  fields: string
  drafts: string
  settings: string
  theme_settings: string
  logics: string
  variables: string
  hidden_fields: string
  translations: string
  status: string
  version: number
  is_draft: number
  can_publish: number
  submission_count: number
  created_at: number
  updated_at: number
}

export interface SubmissionRow {
  id: string
  form_id: string
  category: string
  status: string
  answers: string
  hidden_fields: string
  variables: string
  start_at?: number
  end_at?: number
  ip?: string
  created_at: number
}
