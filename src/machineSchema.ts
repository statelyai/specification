import z from 'zod';
import {
  expressionOr,
  expressionSchema,
  jsonSchemaPropertySchema,
  queryLanguageSchema,
} from './expressionSchema';

// --- Actions ---

export const assignActionSchema = z.object({
  type: z.literal('xstate.assign'),
  params: z.record(z.string(), expressionOr(z.any())),
});

export const raiseActionSchema = z.object({
  type: z.literal('xstate.raise'),
  params: z.object({
    event: expressionOr(z.any()),
  }),
});

export const sendToActionSchema = z.object({
  type: z.literal('xstate.sendTo'),
  params: z.object({
    actorRef: expressionOr(z.string()),
    event: expressionOr(z.any()),
    delay: expressionOr(z.union([z.string(), z.number()])).optional(),
  }),
});

export const logActionSchema = z.object({
  type: z.literal('xstate.log'),
  params: z
    .object({
      message: expressionOr(z.string()),
    })
    .optional(),
});

export const emitActionSchema = z.object({
  type: z.literal('xstate.emit'),
  params: z.object({
    event: expressionOr(z.any()),
  }),
});

export const customActionSchema = z.object({
  type: z.string(),
  params: z.record(z.string(), z.any()).optional(),
});

export const actionSchema = z.union([
  assignActionSchema,
  raiseActionSchema,
  sendToActionSchema,
  logActionSchema,
  emitActionSchema,
  customActionSchema,
]);

// --- Guards ---

export const namedGuardSchema = z.object({
  type: z.string(),
  params: z.record(z.string(), z.any()).optional(),
});

export const guardSchema = z.union([namedGuardSchema, expressionSchema]);

// --- Meta ---

export const metaSchema = z.record(z.string(), z.any());

// --- Transitions ---

export const transitionObjectSchema = z.object({
  target: z.string().optional(),
  context: z
    .record(z.string(), expressionOr(z.any()))
    .optional()
    .describe(
      'Context assignments applied when this transition is taken. Appended as an assign action.'
    ),
  actions: z.array(actionSchema).optional(),
  description: z.string().optional(),
  guard: guardSchema.optional(),
  meta: metaSchema.optional(),
  order: z.number().optional().describe('Explicit transition priority'),
});

/** A transition is an object or an array of objects (for branching) */
export const transitionSchema = transitionObjectSchema;

export const transitionsSchema = z.union([
  z.array(transitionObjectSchema),
  transitionObjectSchema,
]);

// --- Retry ---

export const retrySchema = z.object({
  maxAttempts: z
    .number()
    .int()
    .min(1)
    .describe('Maximum number of retry attempts'),
  interval: z
    .union([z.string(), z.number()])
    .optional()
    .describe('Delay between retries: ms (number) or ISO 8601 duration (string)'),
  backoff: z
    .number()
    .optional()
    .describe('Backoff multiplier applied to interval after each retry'),
});

// --- Invoke ---

export const invokeSchema = z.object({
  id: z.string().optional(),
  src: z.string(),
  input: expressionOr(z.any()).optional().describe('Input passed to the invoked actor'),
  meta: z.record(z.string(), z.any()).optional(),
  onDone: transitionsSchema.optional(),
  onError: transitionsSchema.optional(),
  onSnapshot: transitionsSchema
    .optional()
    .describe('Transitions triggered when the invoked actor emits a snapshot'),
  timeout: z
    .string()
    .optional()
    .describe('ISO 8601 duration for invocation timeout'),
  heartbeat: z
    .string()
    .optional()
    .describe('ISO 8601 duration for heartbeat interval'),
  retry: retrySchema
    .optional()
    .describe('Retry policy for the invoked actor on error'),
});

// --- State ---

export const stateSchema = z.object({
  id: z.string().optional().describe('The state node ID'),
  description: z
    .string()
    .optional()
    .describe('The text description of this state node'),
  type: z
    .union([z.literal('parallel'), z.literal('history'), z.literal('final')])
    .optional()
    .describe(
      'The state type, if not a normal (atomic or compound) state node'
    ),
  target: z
    .string()
    .optional()
    .describe('The target state for history states'),
  history: z
    .enum(['shallow', 'deep'])
    .optional()
    .describe('The history type for history states'),
  entry: z.array(actionSchema).optional().describe('The entry actions'),
  exit: z.array(actionSchema).optional().describe('The exit actions'),
  initial: z.string().optional().describe('The initial child state'),
  on: z
    .record(z.string(), transitionsSchema)
    .optional()
    .describe('The transitions'),
  after: z
    .record(z.string(), transitionsSchema)
    .optional()
    .describe(
      'Delayed transitions. Keys can be milliseconds (number as string) or ISO 8601 durations (e.g. PT30S, PT1M).'
    ),
  always: transitionsSchema
    .optional()
    .describe(
      'Eventless transitions that trigger immediately when their guard is true'
    ),
  invoke: z
    .array(invokeSchema)
    .optional()
    .describe('Invoked actors spawned when the state is entered'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Tags for categorizing this state'),
  output: expressionOr(z.any())
    .optional()
    .describe('Output data for final states'),
  meta: metaSchema.optional().describe('The metadata for this state node'),
  get states() {
    return z
      .record(z.string(), stateSchema)
      .optional()
      .describe('The child states');
  },
});

// --- Machine (root) ---

export const schemasSchema = z
  .object({
    context: z
      .record(z.string(), jsonSchemaPropertySchema)
      .optional()
      .describe('JSON Schema definitions for each context property'),
    events: z
      .record(z.string(), z.record(z.string(), jsonSchemaPropertySchema))
      .optional()
      .describe('JSON Schema definitions for each event type'),
  })
  .optional();

export const machineSchema = stateSchema.extend({
  version: z.string().optional().describe('The machine version'),
  queryLanguage: queryLanguageSchema,
  context: z
    .record(z.string(), z.any())
    .optional()
    .describe('Initial context values'),
  input: jsonSchemaPropertySchema
    .optional()
    .describe('JSON Schema for machine input'),
  schemas: schemasSchema,
});

export type StateMachine = z.infer<typeof machineSchema>;
