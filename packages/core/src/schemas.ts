export const keyTermsSchema = {
  type: 'object',
  properties: {
    keyTerms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          term: {
            type: 'string',
            description: 'The key concept, technical term, or algorithm name.',
          },
          definition: {
            type: 'string',
            description: 'A clear, concise definition or explanation of the term.',
          },
        },
        required: ['term', 'definition'],
        additionalProperties: false,
      },
    },
  },
  required: ['keyTerms'],
  additionalProperties: false,
} as const;

export const flashcardsSchema = {
  type: 'object',
  properties: {
    flashcards: {
      type: 'array',
      description: 'Maximum 12 flashcards, no duplicates, each answer strictly under 25 words.',
      items: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Direct question testing comprehension of a key lecture concept.',
          },
          answer: {
            type: 'string',
            description: 'Direct, clear answer under 25 words.',
          },
        },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
  },
  required: ['flashcards'],
  additionalProperties: false,
} as const;
