export function generateOpenApiSpec(origin: string) {
  const sessionParam = {
    name: 'sessionId',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'Active session ID. If omitted, and not logged in, response provides a login link.'
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'HeyForm Assistant API',
      description:
        'Zero-configuration API for ChatGPT to manage HeyForm forms, workspaces, questions, and submissions. Directs user to a simple browser login page without requiring any OAuth client IDs or secrets.',
      version: '1.0.0'
    },
    servers: [
      {
        url: origin,
        description: 'HeyForm Cloudflare Worker Server'
      }
    ],
    paths: {
      '/api/action/auth/login-url': {
        get: {
          operationId: 'getLoginUrl',
          summary: 'Get OAuth Login URL',
          description:
            'Generates a secure browser login link for the user. Call this whenever you need to prompt the user to log in.',
          responses: {
            '200': {
              description: 'Login link and sessionId',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      sessionId: {
                        type: 'string',
                        description: 'Session identifier to use after user logs in'
                      },
                      loginUrl: {
                        type: 'string',
                        description: 'Browser link for the user to authenticate'
                      },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/action/auth/status': {
        get: {
          operationId: 'checkLoginStatus',
          summary: 'Check if user is logged in',
          description: 'Verify if the user has completed login in their browser.',
          parameters: [
            {
              name: 'sessionId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Session ID from getLoginUrl'
            }
          ],
          responses: {
            '200': {
              description: 'Authentication status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      authenticated: { type: 'boolean' },
                      sessionId: { type: 'string' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: 'string' }
                        }
                      },
                      loginUrl: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/action/workspaces': {
        get: {
          operationId: 'listWorkspaces',
          summary: 'List workspaces (teams)',
          description: 'Get all workspaces that the user belongs to.',
          parameters: [sessionParam],
          responses: {
            '200': {
              description: 'List of workspaces',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        role: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/action/projects': {
        get: {
          operationId: 'listProjects',
          summary: 'List projects in a workspace',
          description: 'Get all projects within a specified workspace.',
          parameters: [
            sessionParam,
            {
              name: 'teamId',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Optional workspace ID filter'
            }
          ],
          responses: {
            '200': {
              description: 'List of projects',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        teamId: { type: 'string' },
                        name: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/action/forms': {
        get: {
          operationId: 'listForms',
          summary: 'List forms in a project',
          description: 'Get all forms in a project.',
          parameters: [
            sessionParam,
            {
              name: 'projectId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Project ID containing forms'
            }
          ],
          responses: {
            '200': {
              description: 'List of forms',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        status: { type: 'integer' },
                        submissionCount: { type: 'integer' },
                        url: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          operationId: 'createForm',
          summary: 'Create a new form',
          description: 'Create a new empty form in a project.',
          parameters: [sessionParam],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['projectId', 'name'],
                  properties: {
                    sessionId: { type: 'string', description: 'Session ID' },
                    projectId: { type: 'string', description: 'Project ID to create form in' },
                    name: { type: 'string', description: 'Title of the new form' },
                    kind: {
                      type: 'integer',
                      default: 1,
                      description: '1 = Survey, 2 = Quiz, 3 = Contact'
                    },
                    interactiveMode: {
                      type: 'integer',
                      default: 1,
                      description: '1 = General, 2 = Interactive'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Created form details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      formId: { type: 'string' },
                      name: { type: 'string' },
                      url: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/action/forms/{formId}': {
        get: {
          operationId: 'getForm',
          summary: 'Get form details',
          description: 'Get questions, drafts, settings, and status of a form.',
          parameters: [
            sessionParam,
            {
              name: 'formId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Form ID'
            }
          ],
          responses: {
            '200': {
              description: 'Form details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      url: { type: 'string' },
                      version: { type: 'integer' },
                      fields: { type: 'array', items: { type: 'object' } },
                      drafts: { type: 'array', items: { type: 'object' } },
                      settings: { type: 'object' },
                      submissionCount: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/action/forms/{formId}/fields': {
        post: {
          operationId: 'addField',
          summary: 'Add question field to form',
          description:
            'Add a new question field to a form. Supports short_text, long_text, number, multiple_choice, rating, opinion_scale, yes_no, date, email, phone_number, etc.',
          parameters: [
            sessionParam,
            {
              name: 'formId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Form ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['kind', 'title'],
                  properties: {
                    sessionId: { type: 'string', description: 'Session ID' },
                    kind: {
                      type: 'string',
                      description:
                        'Question kind (short_text, long_text, number, multiple_choice, yes_no, rating, opinion_scale, email, date, etc.)'
                    },
                    title: { type: 'string', description: 'Question title prompt' },
                    description: { type: 'string', description: 'Subtitle or helper description' },
                    required: {
                      type: 'boolean',
                      default: false,
                      description: 'Mandatory question'
                    },
                    choices: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          label: { type: 'string' }
                        }
                      },
                      description: 'Options for multiple choice questions'
                    },
                    publish: {
                      type: 'boolean',
                      default: false,
                      description: 'Auto-publish form after adding field'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Field added successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      fieldId: { type: 'string' },
                      version: { type: 'integer' },
                      published: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/action/forms/{formId}/publish': {
        post: {
          operationId: 'publishForm',
          summary: 'Publish form',
          description: 'Publish latest draft changes so the form is live for respondents.',
          parameters: [
            sessionParam,
            {
              name: 'formId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Form ID'
            }
          ],
          responses: {
            '200': {
              description: 'Form published',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      published: { type: 'boolean' },
                      url: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/action/forms/{formId}/submissions': {
        get: {
          operationId: 'listSubmissions',
          summary: 'List form submissions',
          description: 'Get submissions/answers submitted to a form.',
          parameters: [
            sessionParam,
            {
              name: 'formId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Form ID'
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 30 },
              description: 'Max submissions to return'
            }
          ],
          responses: {
            '200': {
              description: 'Submissions list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      submissions: {
                        type: 'array',
                        items: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/action/forms/{formId}/analytics': {
        get: {
          operationId: 'getFormAnalytics',
          summary: 'Get form analytics',
          description: 'Get total visits, submission counts, and completion metrics.',
          parameters: [
            sessionParam,
            {
              name: 'formId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Form ID'
            }
          ],
          responses: {
            '200': {
              description: 'Analytics data',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      submissionCount: { type: 'integer' },
                      viewsCount: { type: 'integer' },
                      completionRate: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Optional Bearer token'
        }
      }
    },
    security: []
  }
}
