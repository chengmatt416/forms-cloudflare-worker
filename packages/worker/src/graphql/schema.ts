import { buildSchema } from 'graphql'

export const typeDefs = `
  scalar JSON
  scalar Any

  type UserDetail {
    id: String!
    name: String!
    email: String!
    avatar: String
    lang: String
    role: String
    isAdmin: Boolean
    isEmailVerified: Boolean
    isSocialAccount: Boolean
    isDeletionScheduled: Boolean
    deletionScheduledAt: Float
  }

  type ActivationCode {
    code: String!
    createdBy: String!
    usedBy: String
    usedAt: Float
    createdAt: Float!
  }

  type ProjectItem {
    id: String!
    teamId: String!
    name: String!
    ownerId: String!
    icon: String
    members: [String]
    formCount: Int
    isOwner: Boolean
  }

  type BrandKit {
    id: String!
    logo: String
    theme: JSON
  }

  type Team {
    id: String!
    name: String!
    ownerId: String!
    avatar: String
    storageQuota: Float
    memberCount: Int
    additionalSeats: Int
    isOwner: Boolean
    inviteCode: String
    inviteCodeExpireAt: Float
    removeBranding: Boolean
    createdAt: Float
    projects: [ProjectItem]
    brandKits: [BrandKit]
  }

  type PublicTeamOwner {
    name: String!
    avatar: String
  }

  type PublicTeamDetail {
    id: String!
    name: String!
    avatar: String
    allowJoinByInviteLink: Boolean
    memberCount: Int
    owner: PublicTeamOwner
  }

  type TeamOverview {
    memberCount: Int
    formCount: Int
    submissionQuota: Int
    storageQuota: Float
  }

  type FormSettings {
    captchaKind: String
    googleRecaptchaKey: String
    active: Boolean
    enableExpirationDate: Boolean
    expirationTimeZone: String
    enabledAt: Float
    closedAt: Float
    enableTimeLimit: Boolean
    timeLimit: Int
    filterSpam: Boolean
    allowArchive: Boolean
    password: String
    requirePassword: Boolean
    redirectOnCompletion: Boolean
    redirectUrl: String
    enableQuotaLimit: Boolean
    quotaLimit: Int
    enableIpLimit: Boolean
    ipLimitCount: Int
    ipLimitTime: Int
    enableProgress: Boolean
    enableQuestionList: Boolean
    enableNavigationArrows: Boolean
    locale: String
    languages: [String]
    enableClosedMessage: Boolean
    closedFormTitle: String
    closedFormDescription: String
    metaTitle: String
    metaDescription: String
    metaOGImageUrl: String
    enableEmailNotification: Boolean
  }

  type FormListItem {
    id: String!
    teamId: String!
    projectId: String!
    memberId: String!
    name: String!
    interactiveMode: String
    kind: String
    submissionCount: Int
    settings: FormSettings
    version: Int
    isDraft: Boolean
    canPublish: Boolean
    fieldsUpdatedAt: Float
    retentionAt: Float
    suspended: Boolean
    status: String
    updatedAt: Float
  }

  type RecentForm {
    id: String!
    teamId: String!
    projectId: String!
    memberId: String!
    name: String!
    interactiveMode: String
    kind: String
    submissionCount: Int
    settings: FormSettings
    retentionAt: Float
    suspended: Boolean
    status: String
    updatedAt: Float
    version: Int
    isDraft: Boolean
    canPublish: Boolean
    fieldsUpdatedAt: Float
  }

  type CustomReport {
    id: String
    hiddenFields: [String]
    theme: JSON
    enablePublicAccess: Boolean
  }

  type FormDetail {
    id: String!
    teamId: String!
    memberId: String!
    name: String!
    description: String
    interactiveMode: String
    kind: String
    settings: FormSettings
    drafts: [JSON]
    fields: [JSON]
    hiddenFields: [JSON]
    translations: JSON
    logics: [JSON]
    variables: [JSON]
    themeSettings: JSON
    retentionAt: Float
    suspended: Boolean
    version: Int
    isDraft: Boolean
    canPublish: Boolean
    fieldsUpdatedAt: Float
    submissionCount: Int
    customReport: CustomReport
    status: String
    updatedAt: Float
  }

  type PublicForm {
    id: String!
    teamId: String!
    projectId: String!
    memberId: String!
    name: String!
    description: String
    interactiveMode: String
    kind: String
    settings: FormSettings
    drafts: [JSON]
    fields: [JSON]
    translations: JSON
    hiddenFields: [JSON]
    logics: [JSON]
    variables: [JSON]
    fieldsUpdatedAt: Float
    themeSettings: JSON
    retentionAt: Float
    suspended: Boolean
    isDraft: Boolean
    status: String
    version: Int
    canPublish: Boolean
    customReport: CustomReport
    integrations: JSON
  }

  type UpdateFormSchemasOutput {
    version: Int
    drafts: [JSON]
    canPublish: Boolean
  }

  type CompleteSubmissionOutput {
    clientSecret: String
  }

  type SubmissionItem {
    id: String!
    formId: String!
    category: String!
    status: String!
    answers: JSON
    hiddenFields: [JSON]
    variables: [JSON]
    startAt: Float
    endAt: Float
    createdAt: Float!
  }

  type SubmissionDetail {
    id: String!
    formId: String!
    category: String!
    status: String!
    answers: JSON
    hiddenFields: [JSON]
    variables: [JSON]
    startAt: Float
    endAt: Float
    createdAt: Float!
  }

  type FormReport {
    submissions: [SubmissionItem]
    total: Int
  }

  type FormAnalytic {
    views: Int
    submissions: Int
    starts: Int
    completionRate: Float
  }

  type TemplateItem {
    id: String!
    name: String!
    category: String
    fields: [JSON]
    themeSettings: JSON
  }

  type CdnToken {
    urlPrefix: String!
    token: String!
    key: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input SignUpInput {
    name: String!
    email: String!
    password: String!
    teamId: String
    inviteCode: String
  }

  input CreateTeamInput {
    name: String!
  }

  input UpdateTeamInput {
    teamId: String!
    name: String
    avatar: String
  }

  input TeamDetailInput {
    teamId: String!
  }

  input PublicTeamDetailInput {
    teamId: String!
  }

  input RecentFormsInput {
    teamId: String!
    limit: Int
  }

  input CreateProjectInput {
    teamId: String!
    name: String!
  }

  input RenameProjectInput {
    projectId: String!
    name: String!
  }

  input DeleteProjectInput {
    projectId: String!
  }

  input FormsInput {
    projectId: String!
    status: String
  }

  input FormDetailInput {
    formId: String!
  }

  input CreateFormInput {
    projectId: String!
    name: String
    interactiveMode: String
  }

  input UpdateFormInput {
    formId: String!
    name: String
    description: String
    interactiveMode: String
    settings: JSON
  }

  input UpdateFormSchemasInput {
    formId: String!
    drafts: [JSON]
    canPublish: Boolean
  }

  input DeleteFormFieldInput {
    formId: String!
  }

  input UpdateFormThemeInput {
    formId: String!
    themeSettings: JSON
  }

  input UpdateFormLogicsInput {
    formId: String!
    logics: [JSON]
  }

  input UpdateFormVariablesInput {
    formId: String!
    variables: [JSON]
  }

  input UpdateHiddenFieldsInput {
    formId: String!
    hiddenFields: [JSON]
  }

  input OpenFormInput {
    formId: String!
  }

  input VerifyPasswordInput {
    formId: String!
    password: String!
  }

  input CompleteSubmissionInput {
    formId: String!
    contactId: String
    openToken: String!
    passwordToken: String
    answers: JSON!
    hiddenFields: [JSON]
    recaptchaToken: String
    partialSubmission: Boolean
  }

  input SubmissionsInput {
    formId: String!
    page: Int
    pageSize: Int
    category: String
  }

  input SubmissionDetailInput {
    submissionId: String!
  }

  input FormReportInput {
    formId: String!
  }

  input FormAnalyticInput {
    formId: String!
  }

  input CdnTokenInput {
    filename: String!
    mime: String!
  }

  type Query {
    login(input: LoginInput!): Boolean!
    userDetail: UserDetail
    teams: [Team!]!
    publicTeamDetail(input: PublicTeamDetailInput!): PublicTeamDetail
    teamOverview(input: TeamDetailInput!): TeamOverview
    teamRecentForms(input: RecentFormsInput!): [RecentForm!]!
    forms(input: FormsInput!): [FormListItem!]!
    formDetail(input: FormDetailInput!): FormDetail
    publicForm(input: FormDetailInput!): PublicForm
    openForm(input: OpenFormInput!): String!
    verifyFormPassword(input: VerifyPasswordInput!): String!
    submissions(input: SubmissionsInput!): [SubmissionItem!]!
    submissionDetail(input: SubmissionDetailInput!): SubmissionDetail
    formReport(input: FormReportInput!): FormReport
    formAnalytic(input: FormAnalyticInput!): FormAnalytic
    templates: [TemplateItem!]!
    userCdnToken(input: CdnTokenInput!): CdnToken
    activationCodes: [ActivationCode!]!
  }

  type Mutation {
    signUp(input: SignUpInput!): Boolean!
    createTeam(input: CreateTeamInput!): String!
    updateTeam(input: UpdateTeamInput!): Boolean!
    createProject(input: CreateProjectInput!): String!
    renameProject(input: RenameProjectInput!): Boolean!
    deleteProject(input: DeleteProjectInput!): Boolean!
    createForm(input: CreateFormInput!): String!
    updateForm(input: UpdateFormInput!): Boolean!
    updateFormSchemas(input: UpdateFormSchemasInput!): UpdateFormSchemasOutput!
    publishForm(input: UpdateFormSchemasInput!): Boolean!
    deleteForm(input: DeleteFormFieldInput!): Boolean!
    updateFormTheme(input: UpdateFormThemeInput!): Boolean!
    updateFormLogics(input: UpdateFormLogicsInput!): Boolean!
    updateFormVariables(input: UpdateFormVariablesInput!): Boolean!
    updateFormHiddenFields(input: UpdateHiddenFieldsInput!): Boolean!
    completeSubmission(input: CompleteSubmissionInput!): CompleteSubmissionOutput!
    generateActivationCode: String!
    deleteActivationCode(code: String!): Boolean!
  }
`

export const schema = buildSchema(typeDefs)
