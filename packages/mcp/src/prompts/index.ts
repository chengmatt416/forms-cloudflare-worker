export interface McpPrompt {
  name: string
  description: string
  arguments?: Array<{
    name: string
    description: string
    required?: boolean
  }>
  handler: (args: Record<string, string>) => {
    description?: string
    messages: Array<{
      role: 'user' | 'assistant'
      content: {
        type: 'text'
        text: string
      }
    }>
  }
}

export const prompts: McpPrompt[] = [
  {
    name: 'create_customer_feedback_survey',
    description:
      'Guide the assistant to create a professional customer satisfaction / feedback survey in HeyForm.',
    arguments: [
      {
        name: 'projectId',
        description: 'The project ID to create the survey in',
        required: true
      },
      {
        name: 'topic',
        description:
          'Product or service being evaluated (e.g., "Mobile Banking App", "SaaS Platform")',
        required: false
      }
    ],
    handler: args => {
      const topic = args.topic || 'our product/service'
      return {
        description: `Create a customer feedback survey for ${topic}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please design and create a complete customer feedback survey for ${topic} in HeyForm project "${args.projectId}".

Steps to follow:
1. Use heyform_create_form to create a form titled "Customer Feedback - ${topic}".
2. Use heyform_add_field to add relevant questions:
   - An opinion_scale question for Net Promoter Score (NPS 1-10)
   - A rating question for overall satisfaction (1-5 stars)
   - A multiple_choice question for "What feature do you use most?"
   - A long_text question for "What could we improve?"
   - An email question for contact follow-up
3. Use heyform_update_theme to give the form a clean modern theme.
4. Use heyform_publish_form to publish the form so it is immediately ready.
5. Report back the live form URL and question summary.`
            }
          }
        ]
      }
    }
  },
  {
    name: 'analyze_form_responses',
    description:
      'Fetch and analyze form submissions and generate an executive summary with key trends and recommendations.',
    arguments: [
      {
        name: 'formId',
        description: 'The form ID whose responses to analyze',
        required: true
      }
    ],
    handler: args => {
      return {
        description: `Analyze responses for form ${args.formId}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please analyze the submissions for HeyForm form "${args.formId}".

Steps:
1. Fetch form details with heyform_get_form to understand the questions.
2. Fetch form analytics with heyform_get_form_analytics and heyform_get_form_report.
3. Fetch submissions with heyform_list_submissions.
4. Synthesize the findings into an executive report covering:
   - Response volume & completion rate
   - Common themes in open text responses
   - Breakdown of choice / rating distributions
   - Actionable recommendations based on the respondent feedback.`
            }
          }
        ]
      }
    }
  }
]
