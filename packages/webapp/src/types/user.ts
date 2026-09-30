export interface UserType {
  id: string
  name: string
  email: string
  phoneNumber: string
  avatar: string
  note: string
  lang?: string
  lastSeenAt?: number
  role?: string
  isAdmin?: boolean
  isSocialAccount?: boolean
  isEmailVerified?: boolean
  isDeletionScheduled?: boolean
  deletionScheduledAt?: number
  status: number
  createdAt: string
  updatedAt: string
  isAssigned?: boolean
  isOwner?: boolean
  isYou?: boolean
}
