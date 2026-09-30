export interface TemplateItem {
  id: string
  recordId?: string
  name: string
  category: string
  thumbnail?: string
  description?: string
  interactiveMode?: string
  kind?: string
  fields: any[]
  themeSettings?: any
}

function createSvgThumbnail(title: string, color1: string, color2: string, icon = '📝'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="100%" stop-color="${color2}"/>
    </linearGradient>
  </defs>
  <rect width="480" height="280" rx="16" fill="url(#g)"/>
  <g fill="#ffffff" opacity="0.12">
    <circle cx="430" cy="50" r="80"/>
    <circle cx="50" cy="230" r="60"/>
  </g>
  <rect x="40" y="44" width="400" height="192" rx="12" fill="#ffffff" fill-opacity="0.96" filter="drop-shadow(0 6px 12px rgba(0,0,0,0.12))"/>
  <text x="70" y="106" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="32">${icon}</text>
  <text x="118" y="103" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-weight="700" font-size="19" fill="#0f172a">${title}</text>
  <rect x="70" y="132" width="340" height="10" rx="5" fill="#e2e8f0"/>
  <rect x="70" y="152" width="240" height="10" rx="5" fill="#e2e8f0"/>
  <rect x="70" y="182" width="96" height="30" rx="6" fill="${color1}"/>
  <text x="118" y="202" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-weight="600" font-size="13" fill="#ffffff" text-anchor="middle">Start Form</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const DEFAULT_THEME = {
  theme: {
    fontFamily: 'Inter',
    heading: '#0f172a',
    question: '#1e293b',
    answer: '#2563eb',
    buttonBackground: '#2563eb',
    buttonColor: '#ffffff',
    backgroundColor: '#ffffff'
  }
}

export const BUILTIN_TEMPLATES: TemplateItem[] = [
  // 1. Feedback
  {
    id: 'csat-feedback',
    recordId: 'csat-feedback',
    name: 'Customer Satisfaction Survey (CSAT)',
    category: 'Feedback',
    thumbnail: createSvgThumbnail('CSAT Feedback', '#3b82f6', '#1d4ed8', '⭐'),
    description: 'Measure customer happiness and gather feedback to improve your service.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_csat_1',
        title: ['Overall Satisfaction'],
        description: ['How satisfied are you with our service?'],
        kind: 'rating',
        validations: { required: true },
        properties: { total: 5, shape: 'star' }
      },
      {
        id: 'f_csat_2',
        title: ['What feature do you value most?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: 'Ease of Use' },
            { id: 'c2', label: 'Speed & Performance' },
            { id: 'c3', label: 'Customer Support' },
            { id: 'c4', label: 'Integrations & Features' }
          ]
        }
      },
      {
        id: 'f_csat_3',
        title: ['How can we do better?'],
        description: ['Share your suggestions or what we could improve.'],
        kind: 'long_text',
        validations: { required: false },
        properties: {}
      },
      {
        id: 'f_csat_4',
        title: ['Thank you!'],
        description: [
          'We truly appreciate your feedback and will use it to make our product even better.'
        ],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },
  {
    id: 'website-feedback',
    recordId: 'website-feedback',
    name: 'Website Feedback Form',
    category: 'Feedback',
    thumbnail: createSvgThumbnail('Website Feedback', '#06b6d4', '#0284c7', '🌐'),
    description: 'Collect actionable feedback on website usability and design.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_wf_1',
        title: ['How easy was it to find what you were looking for?'],
        description: null,
        kind: 'opinion_scale',
        validations: { required: true },
        properties: { total: 10, leftLabel: 'Very Difficult', rightLabel: 'Very Easy' }
      },
      {
        id: 'f_wf_2',
        title: ['Did you encounter any bugs or broken links?'],
        description: null,
        kind: 'yes_no',
        validations: { required: true },
        properties: {
          choices: [
            { id: 'y', label: 'Yes' },
            { id: 'n', label: 'No' }
          ]
        }
      },
      {
        id: 'f_wf_3',
        title: ['What could we improve on this page?'],
        description: null,
        kind: 'long_text',
        validations: { required: false },
        properties: {}
      },
      {
        id: 'f_wf_4',
        title: ['Thank you!'],
        description: ['Your suggestions help us deliver a smoother browsing experience.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 2. Contact
  {
    id: 'contact-us',
    recordId: 'contact-us',
    name: 'Contact Us Form',
    category: 'Contact',
    thumbnail: createSvgThumbnail('Contact Us', '#10b981', '#047857', '✉️'),
    description: 'A clean and friendly contact form for inquiries and messages.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_cu_1',
        title: ['What is your full name?'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_cu_2',
        title: ['What is your email address?'],
        description: null,
        kind: 'email',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_cu_3',
        title: ['What company or organization are you with?'],
        description: null,
        kind: 'short_text',
        validations: { required: false },
        properties: {}
      },
      {
        id: 'f_cu_4',
        title: ['How can we help you?'],
        description: ['Please tell us about your project or inquiry.'],
        kind: 'long_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_cu_5',
        title: ['Message Received!'],
        description: ['Thank you for reaching out. We will get back to you within 24 hours.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },
  {
    id: 'support-ticket',
    recordId: 'support-ticket',
    name: 'Support Request Form',
    category: 'Contact',
    thumbnail: createSvgThumbnail('Support Request', '#6366f1', '#4338ca', '🛠️'),
    description: 'Streamline customer support inquiries and issue reporting.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_st_1',
        title: ['Your Name'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_st_2',
        title: ['Your Email'],
        description: null,
        kind: 'email',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_st_3',
        title: ['What category best describes your issue?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: 'Account & Login' },
            { id: 'c2', label: 'Billing & Payments' },
            { id: 'c3', label: 'Technical Bug' },
            { id: 'c4', label: 'Feature Request' }
          ]
        }
      },
      {
        id: 'f_st_4',
        title: ['Please describe the issue in detail'],
        description: ['Include steps to reproduce or any error messages you saw.'],
        kind: 'long_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_st_5',
        title: ['Ticket Created'],
        description: ['Our support team has received your ticket and will respond soon.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 3. Event
  {
    id: 'event-registration',
    recordId: 'event-registration',
    name: 'Event Registration Form',
    category: 'Event',
    thumbnail: createSvgThumbnail('Event Registration', '#ec4899', '#be185d', '🎉'),
    description: 'Capture attendee registrations and preferences for upcoming events.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_er_1',
        title: ['Full Name'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_er_2',
        title: ['Email Address'],
        description: ['We will send your event pass and schedule to this email.'],
        kind: 'email',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_er_3',
        title: ['Which session will you attend?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: 'Morning Keynote & Workshops' },
            { id: 'c2', label: 'Afternoon Panels & Showcase' },
            { id: 'c3', label: 'Full Day All-Access' }
          ]
        }
      },
      {
        id: 'f_er_4',
        title: ['Will you join the networking dinner?'],
        description: null,
        kind: 'yes_no',
        validations: { required: true },
        properties: {
          choices: [
            { id: 'y', label: 'Yes, count me in!' },
            { id: 'n', label: 'No, unable to attend dinner' }
          ]
        }
      },
      {
        id: 'f_er_5',
        title: ['You are all set!'],
        description: ['Looking forward to seeing you at the event.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },
  {
    id: 'rsvp-party',
    recordId: 'rsvp-party',
    name: 'RSVP Form',
    category: 'Event',
    thumbnail: createSvgThumbnail('RSVP Form', '#f59e0b', '#d97706', '🥂'),
    description: 'Quickly collect RSVPs and guest counts.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_rsvp_1',
        title: ['Your Name'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_rsvp_2',
        title: ['Can you make it?'],
        description: null,
        kind: 'yes_no',
        validations: { required: true },
        properties: {
          choices: [
            { id: 'y', label: 'Yes, gladly!' },
            { id: 'n', label: 'Regretfully decline' }
          ]
        }
      },
      {
        id: 'f_rsvp_3',
        title: ['How many guests are attending with you?'],
        description: null,
        kind: 'number',
        validations: { required: false },
        properties: {}
      },
      {
        id: 'f_rsvp_4',
        title: ['Any dietary restrictions or preferences?'],
        description: null,
        kind: 'short_text',
        validations: { required: false },
        properties: {}
      },
      {
        id: 'f_rsvp_5',
        title: ['Thank you!'],
        description: ['We have recorded your response.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 4. Employee/Job
  {
    id: 'job-application',
    recordId: 'job-application',
    name: 'Job Application Form',
    category: 'Employee/Job',
    thumbnail: createSvgThumbnail('Job Application', '#8b5cf6', '#6d28d9', '💼'),
    description: 'Collect candidate details, portfolios, and experience seamlessly.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_ja_1',
        title: ['Full Name'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_ja_2',
        title: ['Email Address'],
        description: null,
        kind: 'email',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_ja_3',
        title: ['Phone Number'],
        description: null,
        kind: 'phone_number',
        validations: { required: false },
        properties: { defaultCountryCode: 'US' }
      },
      {
        id: 'f_ja_4',
        title: ['Which position are you applying for?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: 'Frontend Engineer' },
            { id: 'c2', label: 'Backend Engineer' },
            { id: 'c3', label: 'Product Designer' },
            { id: 'c4', label: 'Growth & Marketing' }
          ]
        }
      },
      {
        id: 'f_ja_5',
        title: ['LinkedIn Profile or Portfolio URL'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_ja_6',
        title: ['Why are you excited to join our team?'],
        description: null,
        kind: 'long_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_ja_7',
        title: ['Application Submitted!'],
        description: [
          'Thank you for applying. We will review your background and get in touch soon.'
        ],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 5. Survey
  {
    id: 'nps-survey',
    recordId: 'nps-survey',
    name: 'Net Promoter Score (NPS) Survey',
    category: 'Survey',
    thumbnail: createSvgThumbnail('NPS Survey', '#f97316', '#c2410c', '📊'),
    description: 'Find out how likely your customers are to recommend your brand.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_nps_1',
        title: ['How likely are you to recommend us to a friend or colleague?'],
        description: ['0 = Not likely at all, 10 = Extremely likely'],
        kind: 'opinion_scale',
        validations: { required: true },
        properties: { total: 10, leftLabel: 'Not likely', rightLabel: 'Extremely likely' }
      },
      {
        id: 'f_nps_2',
        title: ['What is the primary reason for your score?'],
        description: null,
        kind: 'long_text',
        validations: { required: false },
        properties: {}
      },
      {
        id: 'f_nps_3',
        title: ['How long have you been using our service?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: 'Less than 1 month' },
            { id: 'c2', label: '1 to 6 months' },
            { id: 'c3', label: '6 months to 1 year' },
            { id: 'c4', label: 'More than a year' }
          ]
        }
      },
      {
        id: 'f_nps_4',
        title: ['Thank you!'],
        description: ['Your feedback helps us make continuous improvements.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 6. Lead Generation
  {
    id: 'sales-lead-qualification',
    recordId: 'sales-lead-qualification',
    name: 'Sales Lead Qualification Form',
    category: 'Lead Generation',
    thumbnail: createSvgThumbnail('Lead Qualification', '#14b8a6', '#0f766e', '🎯'),
    description: 'Capture inbound leads and qualify prospects effectively.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_lead_1',
        title: ['What is your company name?'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_lead_2',
        title: ['What is your work email?'],
        description: null,
        kind: 'email',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_lead_3',
        title: ['How many employees are in your organization?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: '1 - 10' },
            { id: 'c2', label: '11 - 50' },
            { id: 'c3', label: '51 - 200' },
            { id: 'c4', label: '201+' }
          ]
        }
      },
      {
        id: 'f_lead_4',
        title: ['What is your main goal or requirement?'],
        description: null,
        kind: 'long_text',
        validations: { required: false },
        properties: {}
      },
      {
        id: 'f_lead_5',
        title: ['Thank You!'],
        description: ['One of our product specialists will reach out to schedule a demo.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 7. Questionnaire & Quiz
  {
    id: 'persona-questionnaire',
    recordId: 'persona-questionnaire',
    name: 'Customer Persona Questionnaire',
    category: 'Questionnaire & Quiz',
    thumbnail: createSvgThumbnail('User Persona', '#64748b', '#334155', '📋'),
    description: 'Discover your audience demographics and pain points.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_pq_1',
        title: ['What best describes your current role?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: 'Founder / C-Level' },
            { id: 'c2', label: 'Product Manager' },
            { id: 'c3', label: 'Software Engineer' },
            { id: 'c4', label: 'Designer / UX' },
            { id: 'c5', label: 'Other' }
          ]
        }
      },
      {
        id: 'f_pq_2',
        title: ['What is your team’s biggest challenge today?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: 'Finding and retaining talent' },
            { id: 'c2', label: 'Scaling tech infrastructure' },
            { id: 'c3', label: 'Customer acquisition & growth' },
            { id: 'c4', label: 'Improving product velocity' }
          ]
        }
      },
      {
        id: 'f_pq_3',
        title: ['Thank you!'],
        description: ['Thanks for completing our questionnaire.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 8. Business
  {
    id: 'client-intake',
    recordId: 'client-intake',
    name: 'Client Intake Form',
    category: 'Business',
    thumbnail: createSvgThumbnail('Client Intake', '#0284c7', '#0369a1', '🏢'),
    description: 'Onboard new clients and gather project scopes.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_ci_1',
        title: ['Company or Brand Name'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_ci_2',
        title: ['Primary Contact Name'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_ci_3',
        title: ['Email Address'],
        description: null,
        kind: 'email',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_ci_4',
        title: ['What is your estimated project budget?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: 'Under $5,000' },
            { id: 'c2', label: '$5,000 - $15,000' },
            { id: 'c3', label: '$15,000 - $50,000' },
            { id: 'c4', label: '$50,000+' }
          ]
        }
      },
      {
        id: 'f_ci_5',
        title: ['Briefly describe the project goals and requirements'],
        description: null,
        kind: 'long_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_ci_6',
        title: ['Welcome Aboard!'],
        description: [
          'We are excited to work together. Our team will review your project brief and follow up.'
        ],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 9. Customer Support
  {
    id: 'bug-report',
    recordId: 'bug-report',
    name: 'Bug Report Form',
    category: 'Customer Support',
    thumbnail: createSvgThumbnail('Bug Report', '#ef4444', '#b91c1c', '🐞'),
    description: 'Structured form for users to report software bugs and errors.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_br_1',
        title: ['What went wrong? (Short summary)'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_br_2',
        title: ['Steps to Reproduce'],
        description: ['1. Go to...\n2. Click on...\n3. Error happens...'],
        kind: 'long_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_br_3',
        title: ['What browser and device are you using?'],
        description: null,
        kind: 'short_text',
        validations: { required: false },
        properties: {}
      },
      {
        id: 'f_br_4',
        title: ['Your Email Address'],
        description: ['So we can notify you when the bug is fixed.'],
        kind: 'email',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_br_5',
        title: ['Bug Report Received!'],
        description: ['Thank you for helping us squash this bug.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 10. Registration
  {
    id: 'workshop-registration',
    recordId: 'workshop-registration',
    name: 'Workshop Sign-up Form',
    category: 'Registration',
    thumbnail: createSvgThumbnail('Workshop Sign-up', '#a855f7', '#7e22ce', '🎓'),
    description: 'Registration form for classes, workshops, and webinars.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_wr_1',
        title: ['Participant Name'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_wr_2',
        title: ['Email Address'],
        description: null,
        kind: 'email',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_wr_3',
        title: ['What is your current experience level?'],
        description: null,
        kind: 'multiple_choice',
        validations: { required: true },
        properties: {
          allowMultiple: false,
          choices: [
            { id: 'c1', label: 'Beginner' },
            { id: 'c2', label: 'Intermediate' },
            { id: 'c3', label: 'Advanced' }
          ]
        }
      },
      {
        id: 'f_wr_4',
        title: ['Registration Confirmed!'],
        description: ['You will receive an email with calendar invite and preparation materials.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  },

  // 11. Booking & Order
  {
    id: 'consultation-booking',
    recordId: 'consultation-booking',
    name: 'Consultation Booking Request',
    category: 'Booking & Order',
    thumbnail: createSvgThumbnail('Consultation Booking', '#e11d48', '#9f1239', '📅'),
    description: 'Schedule discovery calls and client consultations.',
    interactiveMode: 'default',
    kind: 'survey',
    themeSettings: DEFAULT_THEME,
    fields: [
      {
        id: 'f_cb_1',
        title: ['Your Name'],
        description: null,
        kind: 'short_text',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_cb_2',
        title: ['Email Address'],
        description: null,
        kind: 'email',
        validations: { required: true },
        properties: {}
      },
      {
        id: 'f_cb_3',
        title: ['Phone Number'],
        description: null,
        kind: 'phone_number',
        validations: { required: false },
        properties: { defaultCountryCode: 'US' }
      },
      {
        id: 'f_cb_4',
        title: ['Preferred Consultation Date'],
        description: null,
        kind: 'date',
        validations: { required: true },
        properties: { format: 'YYYY-MM-DD', allowTime: false }
      },
      {
        id: 'f_cb_5',
        title: ['What would you like to discuss?'],
        description: null,
        kind: 'long_text',
        validations: { required: false },
        properties: {}
      },
      {
        id: 'f_cb_6',
        title: ['Request Sent!'],
        description: ['We will confirm your booking time shortly via email.'],
        kind: 'thank_you',
        validations: {},
        properties: {}
      }
    ]
  }
]
