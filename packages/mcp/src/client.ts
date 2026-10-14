import crypto from 'crypto'

export interface HeyFormClientOptions {
  apiUrl?: string
  email?: string
  password?: string
  sessionToken?: string
  deviceId?: string
  apiKey?: string
}

export class HeyFormClient {
  public apiUrl: string
  public email?: string
  public password?: string
  public sessionToken?: string
  public deviceId: string
  public apiKey?: string

  constructor(options: HeyFormClientOptions = {}) {
    this.apiUrl = (
      options.apiUrl ||
      process.env.HEYFORM_API_URL ||
      'http://localhost:8000'
    ).replace(/\/+$/, '')
    this.email = options.email || process.env.HEYFORM_EMAIL
    this.password = options.password || process.env.HEYFORM_PASSWORD
    this.sessionToken = options.sessionToken || process.env.HEYFORM_SESSION_TOKEN
    this.deviceId =
      options.deviceId || process.env.HEYFORM_DEVICE_ID || crypto.randomBytes(16).toString('hex')
    this.apiKey = options.apiKey || process.env.HEYFORM_API_KEY
  }

  public isAuthenticated(): boolean {
    return Boolean(this.sessionToken || this.apiKey)
  }

  public async ensureAuthenticated(): Promise<void> {
    if (this.isAuthenticated()) {
      return
    }

    if (this.email && this.password) {
      await this.login(this.email, this.password)
      return
    }

    throw new Error(
      'Not authenticated with HeyForm. Please provide HEYFORM_EMAIL and HEYFORM_PASSWORD, or HEYFORM_SESSION_TOKEN, or call heyform_login tool.'
    )
  }

  public async login(email: string, password: string): Promise<boolean> {
    const query = `
      query login($input: LoginInput!) {
        login(input: $input)
      }
    `
    const variables = {
      input: { email, password }
    }

    const response = await fetch(`${this.apiUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': this.deviceId
      },
      body: JSON.stringify({ query, variables })
    })

    const setCookieHeaders = this.extractSetCookie(response)
    for (const cookie of setCookieHeaders) {
      const match = cookie.match(/HEYFORM_SESSION=([^;]+)/)
      if (match) {
        this.sessionToken = match[1]
      }
      const deviceMatch = cookie.match(/HEYFORM_DEVICE_ID=([^;]+)/)
      if (deviceMatch) {
        this.deviceId = deviceMatch[1]
      }
    }

    const json = (await response.json()) as any
    if (json.errors && json.errors.length > 0) {
      const errorMsg = json.errors.map((e: any) => e.message).join(', ')
      throw new Error(`HeyForm Login Failed: ${errorMsg}`)
    }

    this.email = email
    this.password = password
    return json.data?.login === true
  }

  private extractSetCookie(response: Response): string[] {
    const headers = response.headers
    // Node.js fetch supports getSetCookie()
    if (typeof (headers as any).getSetCookie === 'function') {
      return (headers as any).getSetCookie()
    }
    const single = headers.get('set-cookie')
    return single ? [single] : []
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-device-id': this.deviceId
    }

    const token = this.sessionToken || this.apiKey
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
      headers['x-session-token'] = token
      headers['Cookie'] = `HEYFORM_SESSION=${token}; HEYFORM_DEVICE_ID=${this.deviceId}`
    }

    return headers
  }

  public async request<T = any>(
    query: string,
    variables: Record<string, any> = {},
    requireAuth = true
  ): Promise<T> {
    if (requireAuth) {
      await this.ensureAuthenticated()
    }

    const response = await fetch(`${this.apiUrl}/graphql`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ query, variables })
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HeyForm API HTTP Error ${response.status}: ${text}`)
    }

    const json = (await response.json()) as any
    if (json.errors && json.errors.length > 0) {
      const errorMsg = json.errors.map((e: any) => e.message).join(', ')
      throw new Error(`HeyForm GraphQL Error: ${errorMsg}`)
    }

    return json.data
  }

  public async fetchRest(path: string, options: RequestInit = {}): Promise<Response> {
    await this.ensureAuthenticated()
    const url = `${this.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
    return fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...(options.headers as Record<string, string>)
      }
    })
  }

  // --- User Profile ---
  public async getCurrentUser(): Promise<any> {
    const query = `
      query user {
        user {
          id
          name
          email
          avatar
          isSocialAccount
          allowPassword
          isEmailVerified
          createdAt
        }
      }
    `
    const data = await this.request(query)
    return data.user
  }

  // --- Workspaces / Teams ---
  public async listWorkspaces(): Promise<any[]> {
    const query = `
      query teams {
        teams {
          id
          name
          ownerId
          avatar
          storageQuota
          memberCount
          additionalSeats
          isOwner
          inviteCode
          inviteCodeExpireAt
          removeBranding
          createdAt
          projects {
            id
            teamId
            name
            ownerId
            icon
            members
            formCount
            isOwner
          }
          brandKits {
            id
            logo
            theme
          }
        }
      }
    `
    const data = await this.request(query)
    return data.teams || []
  }

  public async getWorkspaceOverview(teamId: string): Promise<any> {
    const query = `
      query teamOverview($input: TeamDetailInput!) {
        teamOverview(input: $input) {
          projectCount
          formCount
          submissionCount
          memberCount
        }
      }
    `
    const data = await this.request(query, { input: { teamId } })
    return data.teamOverview
  }

  public async getWorkspaceMembers(teamId: string): Promise<any[]> {
    const query = `
      query teamMembers($input: TeamDetailInput!) {
        teamMembers(input: $input) {
          id
          name
          email
          avatar
          role
          isOwner
        }
      }
    `
    const data = await this.request(query, { input: { teamId } })
    return data.teamMembers || []
  }

  public async createWorkspace(input: {
    name: string
    avatar?: string
    members?: string[]
    projectName?: string
  }): Promise<string> {
    const query = `
      mutation createTeam($input: CreateTeamInput!) {
        createTeam(input: $input)
      }
    `
    const data = await this.request(query, {
      input: {
        name: input.name,
        avatar: input.avatar,
        members: input.members,
        projectName: input.projectName || 'My Project'
      }
    })
    return data.createTeam
  }

  public async updateWorkspace(input: {
    teamId: string
    name?: string
    avatar?: string
  }): Promise<boolean> {
    const query = `
      mutation updateTeam($input: UpdateTeamInput!) {
        updateTeam(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.updateTeam
  }

  public async inviteWorkspaceMembers(input: {
    teamId: string
    emails: string[]
  }): Promise<boolean> {
    const query = `
      mutation inviteMember($input: InviteMemberInput!) {
        inviteMember(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.inviteMember
  }

  public async removeWorkspaceMember(input: {
    teamId: string
    memberId: string
  }): Promise<boolean> {
    const query = `
      mutation removeTeamMember($input: RemoveTeamMemberInput!) {
        removeTeamMember(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.removeTeamMember
  }

  public async leaveWorkspace(teamId: string): Promise<boolean> {
    const query = `
      mutation leaveTeam($input: TeamDetailInput!) {
        leaveTeam(input: $input)
      }
    `
    const data = await this.request(query, { input: { teamId } })
    return data.leaveTeam
  }

  public async transferWorkspace(input: { teamId: string; memberId: string }): Promise<boolean> {
    const query = `
      mutation transferTeam($input: TransferTeamInput!) {
        transferTeam(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.transferTeam
  }

  public async searchWorkspace(input: { teamId: string; query: string }): Promise<any> {
    const query = `
      query searchTeam($input: SearchTeamInput!) {
        searchTeam(input: $input) {
          forms {
            id
            name
            projectId
          }
          projects {
            id
            name
          }
        }
      }
    `
    const data = await this.request(query, { input })
    return data.searchTeam
  }

  // --- Projects ---
  public async listProjects(teamId: string): Promise<any[]> {
    const query = `
      query projects($input: TeamDetailInput!) {
        projects(input: $input) {
          id
          teamId
          name
          icon
          ownerId
          members
          formCount
          isOwner
        }
      }
    `
    const data = await this.request(query, { input: { teamId } })
    return data.projects || []
  }

  public async createProject(input: {
    teamId: string
    name: string
    avatar?: string
    memberIds?: string[]
  }): Promise<any> {
    const query = `
      mutation createProject($input: CreateProjectInput!) {
        createProject(input: $input) {
          id
          teamId
          name
        }
      }
    `
    const data = await this.request(query, { input })
    return data.createProject
  }

  public async renameProject(input: { projectId: string; name: string }): Promise<boolean> {
    const query = `
      mutation renameProject($input: RenameProjectInput!) {
        renameProject(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.renameProject
  }

  public async deleteProject(input: {
    projectId: string
    name?: string
    code?: string
  }): Promise<boolean> {
    const query = `
      mutation deleteProject($input: DeleteProjectInput!) {
        deleteProject(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.deleteProject
  }

  public async listProjectMembers(projectId: string): Promise<any[]> {
    const query = `
      query projectMembers($input: ProjectDetailInput!) {
        projectMembers(input: $input) {
          id
          name
          email
          avatar
          isOwner
        }
      }
    `
    const data = await this.request(query, { input: { projectId } })
    return data.projectMembers || []
  }

  public async addProjectMember(input: { projectId: string; memberId: string }): Promise<boolean> {
    const query = `
      mutation addProjectMember($input: ProjectMemberInput!) {
        addProjectMember(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.addProjectMember
  }

  public async deleteProjectMember(input: {
    projectId: string
    memberId: string
  }): Promise<boolean> {
    const query = `
      mutation deleteProjectMember($input: ProjectMemberInput!) {
        deleteProjectMember(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.deleteProjectMember
  }

  public async emptyProjectTrash(projectId: string): Promise<boolean> {
    const query = `
      mutation emptyProjectTrash($input: ProjectDetailInput!) {
        emptyProjectTrash(input: $input)
      }
    `
    const data = await this.request(query, { input: { projectId } })
    return data.emptyProjectTrash
  }

  // --- Forms ---
  public async listForms(input: {
    projectId: string
    status?: number
    keyword?: string
  }): Promise<any[]> {
    const query = `
      query forms($input: FormsInput!) {
        forms(input: $input) {
          id
          teamId
          projectId
          name
          kind
          interactiveMode
          status
          submissionCount
          updatedAt
          publishedAt
          settings {
            active
            enableExpirationDate
            closedAt
            requirePassword
          }
        }
      }
    `
    const data = await this.request(query, {
      input: {
        projectId: input.projectId,
        status: input.status ?? 1,
        keyword: input.keyword
      }
    })
    return data.forms || []
  }

  public async getForm(formId: string): Promise<any> {
    const query = `
      query formDetail($input: FormDetailInput!) {
        formDetail(input: $input) {
          id
          teamId
          projectId
          memberId
          name
          description
          interactiveMode
          kind
          status
          version
          canPublish
          publishedAt
          fieldsUpdatedAt
          submissionCount
          updatedAt
          fields
          drafts
          settings
          themeSettings
          translations
          hiddenFields
          logics
          variables
          retentionAt
          suspended
          isDraft
        }
      }
    `
    const data = await this.request(query, { input: { formId } })
    return data.formDetail
  }

  public async createForm(input: {
    projectId: string
    name: string
    interactiveMode?: number
    kind?: number
  }): Promise<string> {
    const query = `
      mutation createForm($input: CreateFormInput!) {
        createForm(input: $input)
      }
    `
    const data = await this.request(query, {
      input: {
        projectId: input.projectId,
        name: input.name,
        interactiveMode: input.interactiveMode ?? 1,
        kind: input.kind ?? 1
      }
    })
    return data.createForm
  }

  public async updateForm(formId: string, updates: Record<string, any>): Promise<boolean> {
    const query = `
      mutation updateForm($input: UpdateFormInput!) {
        updateForm(input: $input)
      }
    `
    const data = await this.request(query, {
      input: {
        formId,
        ...updates
      }
    })
    return data.updateForm
  }

  public async duplicateForm(input: { formId: string; name: string }): Promise<string> {
    const query = `
      mutation duplicateForm($input: DuplicateFormInput!) {
        duplicateForm(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.duplicateForm
  }

  public async publishForm(input: {
    formId: string
    version: number
    drafts: any[]
  }): Promise<boolean> {
    const query = `
      mutation publishForm($input: UpdateFormSchemasInput!) {
        publishForm(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.publishForm
  }

  public async moveForm(input: { formId: string; projectId: string }): Promise<boolean> {
    const query = `
      mutation moveForm($input: MoveFormInput!) {
        moveForm(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.moveForm
  }

  public async archiveForm(input: { formId: string; allowArchive: boolean }): Promise<boolean> {
    const query = `
      mutation updateFormArchive($input: UpdateFormArchiveInput!) {
        updateFormArchive(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.updateFormArchive
  }

  public async trashForm(formId: string): Promise<boolean> {
    const query = `
      mutation moveFormToTrash($input: FormDetailInput!) {
        moveFormToTrash(input: $input)
      }
    `
    const data = await this.request(query, { input: { formId } })
    return data.moveFormToTrash
  }

  public async restoreForm(formId: string): Promise<boolean> {
    const query = `
      mutation restoreForm($input: FormDetailInput!) {
        restoreForm(input: $input)
      }
    `
    const data = await this.request(query, { input: { formId } })
    return data.restoreForm
  }

  public async deleteForm(formId: string): Promise<boolean> {
    const query = `
      mutation deleteForm($input: FormDetailInput!) {
        deleteForm(input: $input)
      }
    `
    const data = await this.request(query, { input: { formId } })
    return data.deleteForm
  }

  public async searchForms(input: { projectId?: string; keyword: string }): Promise<any[]> {
    const query = `
      query searchForms($input: SearchFormInput!) {
        searchForms(input: $input) {
          id
          name
          projectId
        }
      }
    `
    const data = await this.request(query, { input })
    return data.searchForms || []
  }

  // --- Form Schemas & Field Editing ---
  public async updateFormSchemas(input: {
    formId: string
    version: number
    drafts: any[]
  }): Promise<{ drafts: any[]; version: number; canPublish: boolean }> {
    const query = `
      mutation updateFormSchemas($input: UpdateFormSchemasInput!) {
        updateFormSchemas(input: $input) {
          drafts
          version
          canPublish
        }
      }
    `
    const data = await this.request(query, { input })
    return data.updateFormSchemas
  }

  public async updateTheme(input: {
    formId: string
    theme: Record<string, any>
  }): Promise<boolean> {
    const query = `
      mutation updateFormTheme($input: UpdateFormThemeInput!) {
        updateFormTheme(input: $input)
      }
    `
    const data = await this.request(query, {
      input: {
        formId: input.formId,
        theme: input.theme
      }
    })
    return data.updateFormTheme
  }

  public async updateLogics(input: { formId: string; logics: any[] }): Promise<boolean> {
    const query = `
      mutation updateFormLogics($input: UpdateFormLogicsInput!) {
        updateFormLogics(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.updateFormLogics
  }

  public async updateVariables(input: { formId: string; variables: any[] }): Promise<boolean> {
    const query = `
      mutation updateFormVariables($input: UpdateFormVariablesInput!) {
        updateFormVariables(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.updateFormVariables
  }

  public async updateHiddenFields(input: {
    formId: string
    hiddenFields: string[]
  }): Promise<boolean> {
    const query = `
      mutation updateFormHiddenFields($input: UpdateHiddenFieldsInput!) {
        updateFormHiddenFields(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.updateFormHiddenFields
  }

  // --- Submissions & Analytics ---
  public async listSubmissions(input: {
    formId: string
    category?: string
    keyword?: string
    page?: number
    limit?: number
  }): Promise<{ total: number; submissions: any[] }> {
    const query = `
      query submissions($input: SubmissionsInput!) {
        submissions(input: $input) {
          total
          submissions {
            id
            category
            answers
            hiddenFields
            variables
            startAt
            endAt
            status
            contact {
              id
              name
              email
            }
          }
        }
      }
    `
    const data = await this.request(query, { input })
    return data.submissions
  }

  public async getSubmissionAnswers(input: {
    formId: string
    fieldId: string
    page?: number
    limit?: number
  }): Promise<any> {
    const query = `
      query submissionAnswers($input: SubmissionAnswersInput!) {
        submissionAnswers(input: $input) {
          total
          answers {
            submissionId
            kind
            value
            endAt
          }
        }
      }
    `
    const data = await this.request(query, { input })
    return data.submissionAnswers
  }

  public async updateSubmissionAnswer(input: {
    formId: string
    submissionId: string
    answer: {
      id: string
      kind?: string
      value: any
      properties?: Record<string, any>
    }
  }): Promise<boolean> {
    const query = `
      mutation updateSubmissionAnswer($input: UpdateSubmissionAnswerInput!) {
        updateSubmissionAnswer(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.updateSubmissionAnswer
  }

  public async updateSubmissionsCategory(input: {
    formId: string
    submissionIds: string[]
    category: string
  }): Promise<boolean> {
    const query = `
      mutation updateSubmissionsCategory($input: UpdateSubmissionsCategoryInput!) {
        updateSubmissionsCategory(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.updateSubmissionsCategory
  }

  public async deleteSubmissions(input: {
    formId: string
    submissionIds: string[]
  }): Promise<boolean> {
    const query = `
      mutation deleteSubmissions($input: DeleteSubmissionInput!) {
        deleteSubmissions(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.deleteSubmissions
  }

  public async getFormAnalytics(input: { formId: string; range?: string }): Promise<any> {
    const query = `
      query formAnalytic($input: FormAnalyticInput!) {
        formAnalytic(input: $input) {
          totalVisits {
            value
            change
          }
          submissionCount {
            value
            change
          }
          completeRate {
            value
            change
          }
          averageTime {
            value
            change
          }
        }
      }
    `
    const data = await this.request(query, {
      input: {
        formId: input.formId,
        range: input.range || 'week'
      }
    })
    return data.formAnalytic
  }

  public async getFormReport(formId: string): Promise<any> {
    const query = `
      query formReport($input: FormDetailInput!) {
        formReport(input: $input) {
          reports
          submissions
        }
      }
    `
    const data = await this.request(query, { input: { formId } })
    return data.formReport
  }

  public async exportSubmissionsCsv(formId: string): Promise<string> {
    const res = await this.fetchRest(`/api/export/submissions?formId=${encodeURIComponent(formId)}`)
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Export submissions failed: ${err}`)
    }
    return res.text()
  }

  // --- Templates ---
  public async listTemplates(): Promise<any[]> {
    const query = `
      query templates {
        templates {
          id
          name
          description
          kind
          interactiveMode
        }
      }
    `
    const data = await this.request(query)
    return data.templates || []
  }

  public async getTemplateDetail(templateId: string): Promise<any> {
    const query = `
      query templateDetail($input: TemplateDetailInput!) {
        templateDetail(input: $input) {
          id
          name
          description
          kind
          interactiveMode
          fields
          themeSettings
        }
      }
    `
    const data = await this.request(query, { input: { templateId } })
    return data.templateDetail
  }

  public async useTemplate(input: { projectId: string; templateId: string }): Promise<string> {
    const query = `
      mutation useTemplate($input: UseTemplateInput!) {
        useTemplate(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.useTemplate
  }

  // --- Integrations & Webhooks ---
  public async listFormIntegrations(formId: string): Promise<any[]> {
    const query = `
      query formIntegrations($input: FormDetailInput!) {
        formIntegrations(input: $input) {
          id
          appId
          status
          config
        }
      }
    `
    const data = await this.request(query, { input: { formId } })
    return data.formIntegrations || []
  }

  public async updateIntegrationSettings(input: {
    formId: string
    appId: string
    config: Record<string, any>
  }): Promise<boolean> {
    const query = `
      mutation updateIntegrationSettings($input: UpdateIntegrationInput!) {
        updateIntegrationSettings(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.updateIntegrationSettings
  }

  public async updateIntegrationStatus(input: {
    formId: string
    appId: string
    status: number
  }): Promise<boolean> {
    const query = `
      mutation updateIntegrationStatus($input: UpdateIntegrationStatusInput!) {
        updateIntegrationStatus(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.updateIntegrationStatus
  }

  public async deleteIntegrationSettings(input: {
    formId: string
    appId: string
  }): Promise<boolean> {
    const query = `
      mutation deleteIntegrationSettings($input: DeleteIntegrationInput!) {
        deleteIntegrationSettings(input: $input)
      }
    `
    const data = await this.request(query, { input })
    return data.deleteIntegrationSettings
  }

  // --- Form Submitting & Answering ---
  public async openForm(formId: string): Promise<string> {
    const query = `
      query openForm($input: OpenFormInput!) {
        openForm(input: $input)
      }
    `
    const data = await this.request(query, { input: { formId } }, false)
    return data.openForm
  }

  public async completeSubmission(input: {
    formId: string
    openToken?: string
    passwordToken?: string
    answers: Record<string, any>
    hiddenFields?: Array<{ id: string; value: string }>
  }): Promise<{ submissionId: string; redirectUrl?: string }> {
    const query = `
      mutation completeSubmission($input: CompleteSubmissionInput!) {
        completeSubmission(input: $input) {
          submissionId
          redirectUrl
        }
      }
    `
    const data = await this.request(
      query,
      {
        input: {
          formId: input.formId,
          openToken: input.openToken,
          passwordToken: input.passwordToken,
          answers: input.answers,
          hiddenFields: input.hiddenFields || []
        }
      },
      false
    )
    return data.completeSubmission
  }
}
