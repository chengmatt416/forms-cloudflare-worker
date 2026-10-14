import { answeringTools } from './answering'
import { authTools } from './auth'
import { fieldTools } from './fields'
import { formTools } from './form'
import { integrationTools } from './integration'
import { projectTools } from './project'
import { submissionTools } from './submission'
import { templateTools } from './template'
import { McpTool } from './types'
import { workspaceTools } from './workspace'

export * from './types'
export { authTools } from './auth'
export { workspaceTools } from './workspace'
export { projectTools } from './project'
export { formTools } from './form'
export { fieldTools } from './fields'
export { submissionTools } from './submission'
export { templateTools } from './template'
export { integrationTools } from './integration'
export { answeringTools } from './answering'

export const allTools: McpTool[] = [
  ...authTools,
  ...workspaceTools,
  ...projectTools,
  ...formTools,
  ...fieldTools,
  ...submissionTools,
  ...templateTools,
  ...integrationTools,
  ...answeringTools
]
