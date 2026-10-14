import { z } from 'zod'

import { McpTool, formatSuccess } from './types'

export const listProjectsTool: McpTool = {
  name: 'heyform_list_projects',
  description: 'List all projects in a specific workspace.',
  parameters: z.object({
    teamId: z.string().describe('The ID of the workspace/team')
  }),
  execute: async (args, { client }) => {
    const projects = await client.listProjects(args.teamId)
    return formatSuccess(projects)
  }
}

export const createProjectTool: McpTool = {
  name: 'heyform_create_project',
  description: 'Create a new project within a workspace.',
  parameters: z.object({
    teamId: z.string().describe('The workspace ID where the project will be created'),
    name: z.string().min(1).describe('Project name'),
    avatar: z.string().optional().describe('Project avatar/icon URL'),
    memberIds: z
      .array(z.string())
      .optional()
      .describe('Array of user IDs to add as project members')
  }),
  execute: async (args, { client }) => {
    const project = await client.createProject(args)
    return formatSuccess({ project, message: 'Project created successfully' })
  }
}

export const renameProjectTool: McpTool = {
  name: 'heyform_rename_project',
  description: 'Rename an existing project.',
  parameters: z.object({
    projectId: z.string().describe('The ID of the project to rename'),
    name: z.string().min(1).describe('The new project name')
  }),
  execute: async (args, { client }) => {
    const success = await client.renameProject(args)
    return formatSuccess({ success, message: 'Project renamed successfully' })
  }
}

export const deleteProjectTool: McpTool = {
  name: 'heyform_delete_project',
  description: 'Delete a project and its associated forms.',
  parameters: z.object({
    projectId: z.string().describe('The ID of the project to delete'),
    name: z.string().optional().describe('The confirmation project name if required'),
    code: z.string().optional().describe('Confirmation code if required')
  }),
  execute: async (args, { client }) => {
    const success = await client.deleteProject(args)
    return formatSuccess({ success, message: 'Project deleted successfully' })
  }
}

export const listProjectMembersTool: McpTool = {
  name: 'heyform_list_project_members',
  description: 'List members assigned to a specific project.',
  parameters: z.object({
    projectId: z.string().describe('The ID of the project')
  }),
  execute: async (args, { client }) => {
    const members = await client.listProjectMembers(args.projectId)
    return formatSuccess(members)
  }
}

export const addProjectMemberTool: McpTool = {
  name: 'heyform_add_project_member',
  description: 'Add an existing workspace member to a project.',
  parameters: z.object({
    projectId: z.string().describe('The ID of the project'),
    memberId: z.string().describe('The user ID of the workspace member to add to the project')
  }),
  execute: async (args, { client }) => {
    const success = await client.addProjectMember(args)
    return formatSuccess({ success, message: 'Project member added successfully' })
  }
}

export const deleteProjectMemberTool: McpTool = {
  name: 'heyform_delete_project_member',
  description: 'Remove a member from a project.',
  parameters: z.object({
    projectId: z.string().describe('The ID of the project'),
    memberId: z.string().describe('The user ID of the member to remove from the project')
  }),
  execute: async (args, { client }) => {
    const success = await client.deleteProjectMember(args)
    return formatSuccess({ success, message: 'Project member removed successfully' })
  }
}

export const emptyProjectTrashTool: McpTool = {
  name: 'heyform_empty_project_trash',
  description: 'Permanently remove all forms in the project trash bin.',
  parameters: z.object({
    projectId: z.string().describe('The ID of the project')
  }),
  execute: async (args, { client }) => {
    const success = await client.emptyProjectTrash(args.projectId)
    return formatSuccess({ success, message: 'Project trash emptied successfully' })
  }
}

export const projectTools = [
  listProjectsTool,
  createProjectTool,
  renameProjectTool,
  deleteProjectTool,
  listProjectMembersTool,
  addProjectMemberTool,
  deleteProjectMemberTool,
  emptyProjectTrashTool
]
