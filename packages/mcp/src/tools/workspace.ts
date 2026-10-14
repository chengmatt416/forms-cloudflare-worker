import { z } from 'zod'

import { McpTool, formatSuccess } from './types'

export const listWorkspacesTool: McpTool = {
  name: 'heyform_list_workspaces',
  description:
    'List all workspaces (teams) that the current user belongs to, including their projects.',
  parameters: z.object({}),
  execute: async (_args, { client }) => {
    const teams = await client.listWorkspaces()
    return formatSuccess(teams)
  }
}

export const getWorkspaceOverviewTool: McpTool = {
  name: 'heyform_get_workspace_overview',
  description:
    'Get workspace overview statistics including total project count, form count, submission count, and member count.',
  parameters: z.object({
    teamId: z.string().describe('The ID of the workspace/team')
  }),
  execute: async (args, { client }) => {
    const overview = await client.getWorkspaceOverview(args.teamId)
    return formatSuccess(overview)
  }
}

export const getWorkspaceMembersTool: McpTool = {
  name: 'heyform_get_workspace_members',
  description: 'List all members of a workspace/team along with their roles and permissions.',
  parameters: z.object({
    teamId: z.string().describe('The ID of the workspace/team')
  }),
  execute: async (args, { client }) => {
    const members = await client.getWorkspaceMembers(args.teamId)
    return formatSuccess(members)
  }
}

export const createWorkspaceTool: McpTool = {
  name: 'heyform_create_workspace',
  description: 'Create a new workspace/team.',
  parameters: z.object({
    name: z.string().min(1).max(30).describe('Workspace name (1-30 characters)'),
    avatar: z.string().optional().describe('Avatar URL for the workspace'),
    projectName: z
      .string()
      .optional()
      .describe('Initial project name inside the new workspace (defaults to "My Project")'),
    members: z.array(z.string().email()).optional().describe('Initial member emails to invite')
  }),
  execute: async (args, { client }) => {
    const teamId = await client.createWorkspace(args)
    return formatSuccess({ teamId, message: 'Workspace created successfully' })
  }
}

export const updateWorkspaceTool: McpTool = {
  name: 'heyform_update_workspace',
  description: 'Update a workspace name or avatar.',
  parameters: z.object({
    teamId: z.string().describe('The ID of the workspace/team to update'),
    name: z.string().min(1).max(30).optional().describe('New name for the workspace'),
    avatar: z.string().optional().describe('New avatar URL for the workspace')
  }),
  execute: async (args, { client }) => {
    const success = await client.updateWorkspace(args)
    return formatSuccess({ success, message: 'Workspace updated successfully' })
  }
}

export const inviteWorkspaceMembersTool: McpTool = {
  name: 'heyform_invite_workspace_members',
  description: 'Invite one or more members to a workspace by email.',
  parameters: z.object({
    teamId: z.string().describe('The ID of the workspace/team'),
    emails: z.array(z.string().email()).min(1).max(20).describe('List of email addresses to invite')
  }),
  execute: async (args, { client }) => {
    const success = await client.inviteWorkspaceMembers(args)
    return formatSuccess({ success, message: 'Invitations sent successfully' })
  }
}

export const removeWorkspaceMemberTool: McpTool = {
  name: 'heyform_remove_workspace_member',
  description: 'Remove a member from a workspace.',
  parameters: z.object({
    teamId: z.string().describe('The ID of the workspace/team'),
    memberId: z.string().describe('The ID of the member to remove')
  }),
  execute: async (args, { client }) => {
    const success = await client.removeWorkspaceMember(args)
    return formatSuccess({ success, message: 'Member removed from workspace' })
  }
}

export const leaveWorkspaceTool: McpTool = {
  name: 'heyform_leave_workspace',
  description: 'Leave a workspace (non-owners only).',
  parameters: z.object({
    teamId: z.string().describe('The ID of the workspace/team to leave')
  }),
  execute: async (args, { client }) => {
    const success = await client.leaveWorkspace(args.teamId)
    return formatSuccess({ success, message: 'Left workspace successfully' })
  }
}

export const transferWorkspaceTool: McpTool = {
  name: 'heyform_transfer_workspace',
  description: 'Transfer ownership of a workspace to another member.',
  parameters: z.object({
    teamId: z.string().describe('The ID of the workspace/team'),
    memberId: z.string().describe('The user ID of the member to transfer ownership to')
  }),
  execute: async (args, { client }) => {
    const success = await client.transferWorkspace(args)
    return formatSuccess({ success, message: 'Workspace ownership transferred' })
  }
}

export const searchWorkspaceTool: McpTool = {
  name: 'heyform_search_workspace',
  description: 'Search for forms and projects across a workspace by keyword.',
  parameters: z.object({
    teamId: z.string().describe('The ID of the workspace/team'),
    query: z.string().min(1).describe('Search query keyword')
  }),
  execute: async (args, { client }) => {
    const results = await client.searchWorkspace(args)
    return formatSuccess(results)
  }
}

export const workspaceTools = [
  listWorkspacesTool,
  getWorkspaceOverviewTool,
  getWorkspaceMembersTool,
  createWorkspaceTool,
  updateWorkspaceTool,
  inviteWorkspaceMembersTool,
  removeWorkspaceMemberTool,
  leaveWorkspaceTool,
  transferWorkspaceTool,
  searchWorkspaceTool
]
