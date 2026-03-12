import z from 'zod';
import {
  expressionOr,
  expressionSchema,
  jsonSchemaPropertySchema,
  queryLanguageSchema,
} from './expressionSchema';

// --- Actions ---

export const assignActionSchema = z.object({
  type: z.literal('assign'),
  params: z.record(z.string(), expressionOr(z.any())),
});

export const raiseActionSchema = z.object({
  type: z.literal('raise'),
  params: z.object({
    event: expressionOr(z.any()),
  }),
});

export const sendToActionSchema = z.object({
  type: z.literal('sendTo'),
  params: z.object({
    actorRef: expressionOr(z.string()),
    event: expressionOr(z.any()),
    delay: expressionOr(z.union([z.string(), z.number()])).optional(),
  }),
});

export const logActionSchema = z.object({
  type: z.literal('log'),
  params: z
    .object({
      message: expressionOr(z.string()),
    })
    .optional(),
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
  actions: z.array(actionSchema).optional(),
  description: z.string().optional(),
  guard: guardSchema.optional(),
  meta: metaSchema.optional(),
  order: z.number().optional().describe('Explicit transition priority'),
});

/** A transition can be a string (target shorthand), an object, or an array of objects */
export const transitionSchema = z.union([
  z.string(),
  transitionObjectSchema,
]);

export const transitionsSchema = z.union([
  z.array(transitionObjectSchema),
  transitionSchema,
]);

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
});

// --- State ---

export const stateSchema: z.ZodObject<any> = z.object({
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
      'The delayed transitions that will trigger after the specified delay'
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
