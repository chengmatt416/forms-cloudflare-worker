export function generateOpenApiSpec(origin: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'HeyForm Actions API',
      description:
        'API for ChatGPT to interact with HeyForm to manage workspaces, projects, forms, questions, and responses.',
      version: '1.0.0'
    },
    servers: [
      {
        url: origin,
        description: 'HeyForm Cloudflare Worker Server'
      }
    ],
    paths: {
      '/api/action/login': {
        post: {
          operationId: 'login',
          summary: 'Log in to HeyForm',
          description: 'Authenticate with email and password to receive a session token.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: {
                      type: 'string',
                      format: 'email',
                      description: 'User email address'
                    },
                    password: {
                      type: 'string',
                      description: 'User password'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful login',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string', description: 'Session Bearer Token' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          email: { type: 'string' },
                          name: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '401': { description: 'Invalid credentials' }
          }
        }
      },
      '/api/action/workspaces': {
        get: {
          operationId: 'listWorkspaces',
          summary: 'List workspaces (teams)',
          description: 'Get all workspaces that the user belongs to.',
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
          description: 'Create a new empty or template form in a project.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['projectId', 'name'],
                  properties: {
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
        oauth2: {
          type: 'oauth2',
          description: 'HeyForm OAuth 2.0 authentication',
          flows: {
            authorizationCode: {
              authorizationUrl: `${origin}/oauth/authorize`,
              tokenUrl: `${origin}/oauth/token`,
              scopes: {
                read: 'Read workspaces, projects, forms, and submissions',
                write: 'Create and edit forms, add fields, publish forms'
              }
            }
          }
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Bearer token obtained from OAuth 2.0 or /api/action/login'
        }
      }
    },
    security: [
      {
        oauth2: ['read', 'write']
      },
      {
        bearerAuth: []
      }
    ]
  }
}
