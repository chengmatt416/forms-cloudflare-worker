import { HeyFormClient } from '../client'

export interface McpResource {
  uri: string
  name: string
  description: string
  mimeType: string
  read: (client: HeyFormClient, uri: string) => Promise<string>
}

export const staticResources: McpResource[] = [
  {
    uri: 'heyform://workspaces',
    name: 'HeyForm Workspaces',
    description: 'Lists all workspaces, members, and projects for the current authenticated user.',
    mimeType: 'application/json',
    read: async (client: HeyFormClient) => {
      const workspaces = await client.listWorkspaces()
      return JSON.stringify(workspaces, null, 2)
    }
  }
]

export async function readDynamicResource(
  client: HeyFormClient,
  uri: string
): Promise<{ text: string; mimeType: string }> {
  if (uri === 'heyform://workspaces') {
    const data = await client.listWorkspaces()
    return {
      text: JSON.stringify(data, null, 2),
      mimeType: 'application/json'
    }
  }

  const formMatch = uri.match(/^heyform:\/\/forms\/([a-zA-Z0-9_-]+)$/)
  if (formMatch) {
    const formId = formMatch[1]
    const form = await client.getForm(formId)
    return {
      text: JSON.stringify(form, null, 2),
      mimeType: 'application/json'
    }
  }

  const submissionsMatch = uri.match(/^heyform:\/\/submissions\/([a-zA-Z0-9_-]+)$/)
  if (submissionsMatch) {
    const formId = submissionsMatch[1]
    const submissions = await client.listSubmissions({ formId, limit: 30 })
    return {
      text: JSON.stringify(submissions, null, 2),
      mimeType: 'application/json'
    }
  }

  throw new Error(`Unknown resource URI: ${uri}`)
}
