import { apollo } from '@/utils'

import {
  ACTIVATION_CODES_GQL,
  DELETE_ACTIVATION_CODE_GQL,
  GENERATE_ACTIVATION_CODE_GQL
} from '@/consts'

export interface ActivationCodeItem {
  code: string
  createdBy: string
  usedBy?: string | null
  usedAt?: number | null
  createdAt: number
}

export class AdminService {
  static async activationCodes(): Promise<ActivationCodeItem[]> {
    return apollo.query<ActivationCodeItem[]>({
      query: ACTIVATION_CODES_GQL,
      fetchPolicy: 'network-only'
    })
  }

  static async generateActivationCode(): Promise<string> {
    return apollo.mutate<string>({
      mutation: GENERATE_ACTIVATION_CODE_GQL
    })
  }

  static async deleteActivationCode(code: string): Promise<boolean> {
    return apollo.mutate<boolean>({
      mutation: DELETE_ACTIVATION_CODE_GQL,
      variables: { code }
    })
  }
}
