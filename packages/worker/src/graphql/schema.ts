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
    captchaKind: Int
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
    redirectDelay: Float
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
    removeBranding: Boolean
  }

  type FormField {
    id: String!
    title: JSON
    titleSchema: JSON
    description: JSON
    kind: String
    validations: JSON
    properties: JSON
    layout: JSON
    width: Int
    hide: Boolean
    frozen: Boolean
  }

  type HiddenField {
    id: String!
    name: String!
  }

  type ThemeSettings {
    logo: String
    favicon: String
    theme: JSON
  }

  type StripeAccount {
    accountId: String
    email: String
  }

  type FormListItem {
    id: String!
    teamId: String!
    projectId: String!
    memberId: String!
    name: String!
    interactiveMode: Int
    kind: Int
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
    interactiveMode: Int
    kind: Int
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
    projectId: String!
    memberId: String!
    name: String!
    description: String
    interactiveMode: Int
    kind: Int
    stripeAccount: StripeAccount
    settings: FormSettings
    drafts: [FormField!]
    fields: [FormField!]
    hiddenFields: [HiddenField!]
    translations: JSON
    logics: [JSON]
    variables: [JSON]
    themeSettings: ThemeSettings
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
    interactiveMode: Int
    kind: Int
    stripeAccount: StripeAccount
    settings: FormSettings
    drafts: [FormField!]
    fields: [FormField!]
    translations: JSON
    hiddenFields: [HiddenField!]
    logics: [JSON]
    variables: [JSON]
    fieldsUpdatedAt: Float
    themeSettings: ThemeSettings
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
    drafts: [FormField!]
    canPublish: Boolean
  }

  type TeamMember {
    id: String!
    name: String!
    email: String!
    avatar: String
    role: String!
    isOwner: Boolean!
    lastSeenAt: Float
  }

  type SubmissionsOutput {
    total: Int!
    submissions: [SubmissionItem!]!
  }

  type CompleteSubmissionOutput {
    clientSecret: String
  }

  type SubmissionHiddenField {
    id: String
    name: String
    value: String
  }

  type SubmissionItem {
    id: String!
    formId: String
    category: String!
    status: String
    title: String
    answers: JSON
    hiddenFields: [SubmissionHiddenField!]
    variables: [JSON]
    startAt: Float
    endAt: Float
    createdAt: Float
  }

  type SubmissionDetail {
    id: String!
    formId: String
    category: String!
    status: String
    title: String
    answers: JSON
    hiddenFields: [SubmissionHiddenField!]
    variables: [JSON]
    startAt: Float
    endAt: Float
    createdAt: Float
  }

  type FormAnalyticMetric {
    value: Float
    change: Float
  }

  type FormAnalytic {
    totalVisits: FormAnalyticMetric
    submissionCount: FormAnalyticMetric
    completeRate: FormAnalyticMetric
    averageTime: FormAnalyticMetric
    views: Int
    submissions: Int
    starts: Int
    completionRate: Float
  }

  type FormReportAnswer {
    submissionId: String
    kind: String
    value: JSON
    endAt: Float
  }

  type FormReportSubmissionGroup {
    _id: String
    answers: [FormReportAnswer]
  }

  type FormReportResponse {
    id: String
    total: Int
    count: Int
    average: Float
    chooses: JSON
  }

  type FormReport {
    responses: [FormReportResponse]
    submissions: [FormReportSubmissionGroup]
  }

  type TemplateItem {
    id: String!
    recordId: String
    name: String!
    category: String
    thumbnail: String
    description: String
    interactiveMode: Int
    kind: Int
    fields: [FormField!]
    themeSettings: ThemeSettings
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
    projectId: String
    name: String
    nameSchema: [JSON]
    interactiveMode: Int
    kind: Int
  }

  input TemplateDetailInput {
    templateId: String!
    templateSlug: String
  }

  input UseTemplateInput {
    projectId: String
    templateId: String!
    recordId: String
    name: String
  }

  input CreateFormWithAIInput {
    projectId: String
    topic: String!
    reference: String
  }

  input CreateFieldsWithAIInput {
    formId: String!
    prompt: String!
  }

  input CreateFormThemeWithAIInput {
    formId: String!
    prompt: String!
    theme: String!
  }

  input DuplicateFormInput {
    formId: String!
    name: String!
  }

  input UpdateFormArchiveInput {
    formId: String!
    allowArchive: Boolean!
  }

  input UpdateFormInput {
    formId: String!
    name: String
    description: String
    interactiveMode: Int
    kind: Int
    settings: JSON
    status: String
    captchaKind: Int
    active: Boolean
    enableExpirationDate: Boolean
    expirationTimeZone: String
    enabledAt: Float
    closedAt: Float
    enableTimeLimit: Boolean
    timeLimit: Float
    filterSpam: Boolean
    password: String
    requirePassword: Boolean
    languages: [String]
    redirectUrl: String
    redirectOnCompletion: Boolean
    redirectDelay: Float
    enableQuotaLimit: Boolean
    quotaLimit: Int
    enableIpLimit: Boolean
    ipLimitCount: Int
    ipLimitTime: Float
    enableProgress: Boolean
    enableQuestionList: Boolean
    enableNavigationArrows: Boolean
    emailNotification: String
    locale: String
    enableClosedMessage: Boolean
    closedFormTitle: String
    closedFormDescription: String
    allowArchive: Boolean
    metaTitle: String
    metaDescription: String
    metaOGImageUrl: String
    enableEmailNotification: Boolean
  }

  input UpdateFormSchemasInput {
    formId: String!
    drafts: [JSON]
    version: Int
    canPublish: Boolean
  }

  input CreateFormFieldInput {
    formId: String!
    field: JSON!
  }

  input UpdateFormFieldInput {
    formId: String!
    fieldId: String!
    updates: JSON!
  }

  input DeleteFormFieldInput {
    formId: String!
    fieldId: String
  }

  input UpdateFormThemeInput {
    formId: String!
    themeSettings: JSON
    theme: JSON
    logo: String
    favicon: String
  }

  input MoveFormInput {
    formId: String!
    targetProjectId: String!
  }

  input UpdateFormCustomReportInput {
    formId: String!
    hiddenFields: [String]
    theme: JSON
    enablePublicAccess: Boolean
  }

  input UpdateFormIntegrationInput {
    formId: String!
    appId: String
    attributes: JSON
    config: JSON
    status: String
  }

  input SearchTeamInput {
    teamId: String!
    keyword: String!
  }

  input SearchFormInput {
    keyword: String!
  }

  type SearchFormItem {
    formId: String!
    formName: String
    teamId: String
    teamName: String
    templateId: String
    templateName: String
  }

  type SearchTeamOutput {
    forms: [FormListItem!]!
  }

  type FormIntegration {
    formId: String!
    appId: String!
    config: JSON
    status: String
  }

  type AppItem {
    id: String!
    name: String!
    description: String
    icon: String
    settings: JSON
  }

  input UpdateSubmissionsCategoryInput {
    formId: String!
    submissionIds: [String!]!
    category: String!
  }

  input DeleteSubmissionInput {
    formId: String!
    submissionIds: [String!]!
  }

  input UpdateSubmissionAnswerInput {
    formId: String!
    submissionId: String!
    answer: JSON!
  }

  input SubmissionLocationsInput {
    formId: String!
    start: Float
    end: Float
  }

  type SubmissionLocation {
    code: String!
    total: Int!
  }

  input SubmissionAnswersInput {
    formId: String!
    fieldId: String!
    page: Int
    limit: Int
  }

  type SubmissionAnswerItem {
    submissionId: String
    kind: String
    value: JSON
    endAt: Float
  }

  type SubmissionAnswersOutput {
    total: Int!
    answers: [SubmissionAnswerItem!]!
  }

  input UpdateUserInput {
    name: String
    avatar: String
    restoreGravatar: Boolean
    lang: String
  }

  input UpdateUserPasswordInput {
    currentPassword: String!
    newPassword: String
  }

  input ProjectMemberInput {
    projectId: String!
    memberId: String!
  }

  input ProjectDetailInput {
    projectId: String!
  }

  input TransferTeamInput {
    teamId: String!
    memberId: String!
  }

  input UpdateTeamMemberInput {
    teamId: String!
    memberId: String!
    role: String!
  }

  input InviteMemberInput {
    teamId: String!
    emails: [String]
    email: String
    role: String
  }

  input ShareFormInput {
    formId: String!
    emails: [String!]!
    role: String
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
    openToken: String
    passwordToken: String
    answers: JSON!
    hiddenFields: [JSON]
    recaptchaToken: String
    partialSubmission: Boolean
  }

  input SubmissionsInput {
    formId: String!
    page: Int
    limit: Int
    pageSize: Int
    category: String
    labelId: String
    keyword: String
  }

  input SubmissionDetailInput {
    submissionId: String!
  }

  input FormReportInput {
    formId: String!
  }

  input FormAnalyticInput {
    formId: String!
    range: String
  }

  input CdnTokenInput {
    filename: String!
    mime: String!
  }

  input UploadFormFileInput {
    formId: String!
    filename: String!
    mime: String!
  }

  type Query {
    login(input: LoginInput!): Boolean!
    userDetail: UserDetail
    teams: [Team!]!
    teamMembers(input: TeamDetailInput!): [TeamMember!]!
    publicTeamDetail(input: PublicTeamDetailInput!): PublicTeamDetail
    teamOverview(input: TeamDetailInput!): TeamOverview
    teamRecentForms(input: RecentFormsInput!): [RecentForm!]!
    searchTeam(input: SearchTeamInput!): SearchTeamOutput!
    searchForms(input: SearchFormInput!): [SearchFormItem!]!
    forms(input: FormsInput!): [FormListItem!]!
    formDetail(input: FormDetailInput!): FormDetail
    publicForm(input: FormDetailInput!): PublicForm
    openForm(input: OpenFormInput!): String!
    verifyFormPassword(input: VerifyPasswordInput!): String!
    formIntegrations(input: FormDetailInput!): [FormIntegration!]!
    apps: [AppItem!]!
    submissions(input: SubmissionsInput!): SubmissionsOutput!
    submissionDetail(input: SubmissionDetailInput!): SubmissionDetail
    submissionLocations(input: SubmissionLocationsInput!): [SubmissionLocation!]!
    submissionAnswers(input: SubmissionAnswersInput!): SubmissionAnswersOutput!
    formReport(input: FormDetailInput!): FormReport
    formAnalytic(input: FormAnalyticInput!): FormAnalytic
    templates: [TemplateItem!]!
    templateDetail(input: TemplateDetailInput!): TemplateItem
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
    addProjectMember(input: ProjectMemberInput!): Boolean!
    deleteProjectMember(input: ProjectMemberInput!): Boolean!
    leaveProject(input: ProjectDetailInput!): Boolean!
    transferTeam(input: TransferTeamInput!): Boolean!
    removeTeamMember(input: TransferTeamInput!): Boolean!
    updateTeamMemberRole(input: UpdateTeamMemberInput!): Boolean!
    leaveTeam(input: TeamDetailInput!): Boolean!
    inviteMember(input: InviteMemberInput!): Boolean!
    shareForm(input: ShareFormInput!): Boolean!
    createForm(input: CreateFormInput!): String!
    useTemplate(input: UseTemplateInput!): String!
    createFormWithAI(input: CreateFormWithAIInput!): String!
    createWithAI(input: CreateFormWithAIInput!): String!
    createFieldsWithAI(input: CreateFieldsWithAIInput!): Boolean!
    createFormLogicsWithAI(input: CreateFieldsWithAIInput!): Boolean!
    createFormThemeWithAI(input: CreateFormThemeWithAIInput!): Boolean!
    duplicateForm(input: DuplicateFormInput!): String!
    moveFormToTrash(input: FormDetailInput!): Boolean!
    restoreForm(input: FormDetailInput!): Boolean!
    deleteForm(input: FormDetailInput!): Boolean!
    moveForm(input: MoveFormInput!): Boolean!
    createFormField(input: CreateFormFieldInput!): Boolean!
    updateFormField(input: UpdateFormFieldInput!): Boolean!
    deleteFormField(input: DeleteFormFieldInput!): Boolean!
    updateForm(input: UpdateFormInput!): Boolean!
    updateFormArchive(input: UpdateFormArchiveInput!): Boolean!
    updateFormSchemas(input: UpdateFormSchemasInput!): UpdateFormSchemasOutput!
    publishForm(input: UpdateFormSchemasInput!): Boolean!
    updateFormTheme(input: UpdateFormThemeInput!): Boolean!
    updateFormLogics(input: UpdateFormLogicsInput!): Boolean!
    updateFormVariables(input: UpdateFormVariablesInput!): Boolean!
    updateFormHiddenFields(input: UpdateHiddenFieldsInput!): Boolean!
    updateHiddenFields(input: UpdateHiddenFieldsInput!): Boolean!
    createFormCustomReport(input: FormDetailInput!): Boolean!
    updateFormCustomReport(input: UpdateFormCustomReportInput!): Boolean!
    updateFormIntegration(input: UpdateFormIntegrationInput!): Boolean!
    updateSubmissionsCategory(input: UpdateSubmissionsCategoryInput!): Boolean!
    deleteSubmissions(input: DeleteSubmissionInput!): Boolean!
    updateSubmissionAnswer(input: UpdateSubmissionAnswerInput!): Boolean!
    updateUser(input: UpdateUserInput!): Boolean!
    updateUserPassword(input: UpdateUserPasswordInput!): Boolean!
    completeSubmission(input: CompleteSubmissionInput!): CompleteSubmissionOutput!
    uploadFileToken(input: UploadFormFileInput!): CdnToken!
    generateActivationCode: String!
    deleteActivationCode(code: String!): Boolean!
  }
`

export const schema = buildSchema(typeDefs)
