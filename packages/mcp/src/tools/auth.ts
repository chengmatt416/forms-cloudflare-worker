import { z } from 'zod'

import { McpTool, formatSuccess } from './types'

export const loginTool: McpTool = {
  name: 'heyform_login',
  description: 'Log in to HeyForm with email and password to authenticate the session.',
  parameters: z.object({
    email: z.string().email().describe('The user email address'),
    password: z.string().min(1).describe('The user password')
  }),
  execute: async (args, { client }) => {
    const success = await client.login(args.email, args.password)
    return formatSuccess({
      success,
      message: 'Successfully authenticated with HeyForm',
      email: args.email,
      sessionToken: client.sessionToken ? '***' : undefined
    })
  }
}

export const getCurrentUserTool: McpTool = {
  name: 'heyform_get_current_user',
  description: 'Get profile details of the currently authenticated HeyForm user.',
  parameters: z.object({}),
  execute: async (_args, { client }) => {
    const user = await client.getCurrentUser()
    return formatSuccess(user)
  }
}

export const authTools = [loginTool, getCurrentUserTool]
