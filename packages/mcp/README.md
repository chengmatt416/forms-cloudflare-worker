# @heyform/mcp

Official **Model Context Protocol (MCP)** server for [HeyForm](https://heyform.net), allowing AI assistants (Claude Desktop, Cursor, Antigravity, Zed, Claude Code, Goose, etc.) to perform all actions in HeyForm.

---

## Capabilities

With HeyForm MCP, an AI assistant can perform every action a user can do:

- **Workspaces (Teams)**: List workspaces, view stats, create/update workspaces, invite or remove team members, transfer ownership.
- **Projects**: List, create, rename, delete projects, manage project members, empty project trash.
- **Forms**: Create forms (Survey, Quiz, Contact), publish drafts to live, duplicate, archive, trash, restore, delete, move across projects, search.
- **Form Builder & Question Fields**: Add questions (short text, long text, number, multiple choice, rating, NPS opinion scale, date, file upload, email, phone, etc.), edit questions, reorder questions, update theme styling, configure conditional branching logic, custom variables, and hidden tracking fields.
- **Submissions & Analytics**: Query form submissions with pagination, filter by category (inbox, starred, trash, spam), search answers, view aggregate question reports and analytics (visits, completion rates, average time), edit answers, and export to CSV.
- **Templates**: Browse templates, inspect template questions, and instantiate forms directly from templates.
- **Integrations & Webhooks**: List integrations, configure real-time webhooks, and toggle integration status.
- **Form Answering**: Open form sessions and submit live responses.

---

## Quick Start

### 1. Build the MCP Server

```bash
# From the repository root
pnpm build:mcp
```

### 2. Configure Your AI Client

#### Claude Desktop

Add the following to your `claude_desktop_config.json` (on macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "heyform": {
      "command": "node",
      "args": [
        "/path/to/heyform/packages/mcp/dist/index.js"
      ],
      "env": {
        "HEYFORM_API_URL": "http://localhost:8000",
        "HEYFORM_EMAIL": "your-email@example.com",
        "HEYFORM_PASSWORD": "your-password"
      }
    }
  }
}
```

#### Cursor

Add to your project's `.cursor/mcp.json` or user configuration:

```json
{
  "mcpServers": {
    "heyform": {
      "command": "node",
      "args": [
        "/path/to/heyform/packages/mcp/dist/index.js"
      ],
      "env": {
        "HEYFORM_API_URL": "http://localhost:8000",
        "HEYFORM_EMAIL": "your-email@example.com",
        "HEYFORM_PASSWORD": "your-password"
      }
    }
  }
}
```

#### Antigravity

Add to your Antigravity MCP settings:

```json
{
  "mcpServers": {
    "heyform": {
      "command": "node",
      "args": [
        "/path/to/heyform/packages/mcp/dist/index.js"
      ],
      "env": {
        "HEYFORM_API_URL": "http://localhost:8000",
        "HEYFORM_EMAIL": "your-email@example.com",
        "HEYFORM_PASSWORD": "your-password"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `HEYFORM_API_URL` | Base URL of the HeyForm server | `http://localhost:8000` |
| `HEYFORM_EMAIL` | User email for automatic login | — |
| `HEYFORM_PASSWORD` | User password for automatic login | — |
| `HEYFORM_SESSION_TOKEN` | Direct session token (`HEYFORM_SESSION` cookie/header) | — |
| `HEYFORM_DEVICE_ID` | Device identifier | Auto-generated |
| `HEYFORM_API_KEY` | Optional API token | — |
| `MCP_TRANSPORT` | Transport mode (`stdio` or `sse`) | `stdio` |
| `MCP_PORT` | HTTP port when running in SSE mode | `3333` |

---

## Server Transports

### Stdio Transport (Default)

Used by desktop applications and CLI agents:

```bash
pnpm mcp
# or
node packages/mcp/bin/heyform-mcp.js
```

### SSE (Server-Sent Events) Transport

Used for web clients or remote agent connections:

```bash
pnpm mcp -- --transport sse --port 3333
# or
node packages/mcp/bin/heyform-mcp.js --transport sse --port 3333
```

Endpoints:
- `GET http://localhost:3333/sse` — SSE stream endpoint
- `POST http://localhost:3333/messages?sessionId=...` — Message receiver
- `GET http://localhost:3333/health` — Health check

---

## Available Tools (58 Tools)

### Account & Authentication
- `heyform_login`: Authenticate with email and password to start a session.
- `heyform_get_current_user`: Fetch profile details of current user.

### Workspaces (Teams)
- `heyform_list_workspaces`: List all workspaces the user has access to.
- `heyform_get_workspace_overview`: Get stats (projects, forms, submissions, members).
- `heyform_get_workspace_members`: List members of a workspace.
- `heyform_create_workspace`: Create a new workspace.
- `heyform_update_workspace`: Update workspace name or avatar.
- `heyform_invite_workspace_members`: Invite members to a workspace by email.
- `heyform_remove_workspace_member`: Remove a member from a workspace.
- `heyform_leave_workspace`: Leave a workspace.
- `heyform_transfer_workspace`: Transfer workspace ownership.
- `heyform_search_workspace`: Search forms and projects across a workspace.

### Projects
- `heyform_list_projects`: List all projects in a workspace.
- `heyform_create_project`: Create a new project in a workspace.
- `heyform_rename_project`: Rename a project.
- `heyform_delete_project`: Delete a project and its forms.
- `heyform_list_project_members`: List members assigned to a project.
- `heyform_add_project_member`: Add member to a project.
- `heyform_delete_project_member`: Remove member from a project.
- `heyform_empty_project_trash`: Permanently clear all trashed forms in a project.

### Form Management
- `heyform_list_forms`: List forms in a project (filter by normal/trash, search keyword).
- `heyform_get_form`: Get full details of a form (questions, drafts, settings, theme, logic).
- `heyform_create_form`: Create a new form (Survey, Quiz, Contact).
- `heyform_update_form`: Update form settings (active, password, expiration, time limits, spam filter, redirection, email alerts).
- `heyform_duplicate_form`: Duplicate an existing form with a new title.
- `heyform_publish_form`: Publish drafts to make changes live for respondents.
- `heyform_move_form`: Move form to another project.
- `heyform_archive_form`: Archive or unarchive a form.
- `heyform_trash_form`: Move form to trash.
- `heyform_restore_form`: Restore form from trash.
- `heyform_delete_form`: Permanently delete a form.
- `heyform_search_forms`: Search forms by keyword.

### Question Fields & Form Schemas
- `heyform_add_field`: Add a question or screen (`short_text`, `long_text`, `number`, `multiple_choice`, `picture_choice`, `yes_no`, `email`, `phone_number`, `url`, `rating`, `opinion_scale`, `date`, `date_range`, `time`, `file_upload`, `address`, `full_name`, `legal_terms`, `signature`, `statement`, `welcome`, `thank_you`).
- `heyform_update_field`: Update a question's title, description, choices, validations, or properties.
- `heyform_delete_field`: Delete a question from form drafts.
- `heyform_reorder_fields`: Reorder questions in form drafts.
- `heyform_update_form_schemas`: Replace the entire drafts array in bulk.
- `heyform_update_theme`: Customize colors, fonts, background image, roundness, brightness.
- `heyform_update_logics`: Set conditional branching and jump logic rules.
- `heyform_update_variables`: Configure custom or score calculation variables.
- `heyform_update_hidden_fields`: Configure hidden tracking parameters.

### Submissions & Analytics
- `heyform_list_submissions`: Query submissions with pagination, category filter (inbox, starred, trash, spam), search.
- `heyform_get_submission_answers`: View all responses for a specific question.
- `heyform_update_submission_answer`: Edit an answer in an existing submission.
- `heyform_update_submissions_category`: Move submissions to star, trash, spam, or inbox.
- `heyform_delete_submissions`: Permanently delete submissions.
- `heyform_export_submissions`: Export submissions as CSV string.
- `heyform_get_form_analytics`: Get total visits, completion rates, and average completion time.
- `heyform_get_form_report`: Get aggregate statistical breakdown per question.

### Templates
- `heyform_list_templates`: List available form templates.
- `heyform_get_template`: Get template details and question structure.
- `heyform_use_template`: Create a new form from a template in a project.

### Webhooks & Integrations
- `heyform_list_integrations`: List active integrations on a form.
- `heyform_configure_webhook`: Configure real-time submission delivery to a webhook URL.
- `heyform_toggle_integration`: Enable or disable an integration.
- `heyform_delete_integration`: Remove an integration.

### Form Answering (Submitting)
- `heyform_open_form`: Open a form session to verify it is active and accepting submissions.
- `heyform_submit_response`: Submit answers to an active form.

---

## Resources & Prompts

### Resources
- `heyform://workspaces` — Dynamic resource listing all workspaces and projects.
- `heyform://forms/{formId}` — Resource returning full form definition and schema.
- `heyform://submissions/{formId}` — Resource returning recent submissions.

### Prompts
- `create_customer_feedback_survey` — Interactive prompt guiding the AI to design, style, and publish a feedback survey.
- `analyze_form_responses` — Interactive prompt guiding the AI to fetch submissions, compute stats, and generate an executive report.

---

## Testing

```bash
pnpm test:mcp
```
