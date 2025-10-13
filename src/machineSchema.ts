import z from 'zod';

export const actionSchema = z.object({
  type: z.string(),
  params: z.record(z.string(), z.any()).optional(),
});

export const invokeSchema = z.object({
  id: z.string().optional(),
  src: z.string(),
  // input: z.record(z.string(), z.any()).optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

export const guardSchema = z.object({
  type: z.string(),
  params: z.record(z.string(), z.any()).optional(),
});

export const metaSchema = z.record(z.string(), z.any());

export const transitionSchema = z.object({
  target: z.string().optional(),
  actions: z.array(actionSchema).optional(),
  description: z.string().optional(),
  guard: guardSchema.optional(),
  meta: metaSchema.optional(),
});

const baseState = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
});

export const atomicState = baseState.extend({
  type: z.literal('atomic').optional(),
  entry: z.array(actionSchema).optional(),
  exit: z.array(actionSchema).optional(),
  on: z.record(z.string(), transitionSchema).optional(),
  after: z.record(z.string(), transitionSchema).optional(),
  always: z.array(transitionSchema).optional(),
  invoke: z.array(invokeSchema).optional(),
});

export const compoundState = baseState.extend({
  type: z.literal('compound').optional(),
  entry: z.array(actionSchema).optional(),
  exit: z.array(actionSchema).optional(),
  initial: z.string(),
});

export const parallelState = baseState.extend({
  type: z.literal('parallel').optional(),
  entry: z.array(actionSchema).optional(),
  exit: z.array(actionSchema).optional(),
});

export const historyState = baseState.extend({
  type: z.literal('history').optional(),
  history: z.enum(['shallow', 'deep']).optional(),
  target: z.string().optional(),
});

export const finalState = baseState.extend({
  type: z.literal('final').optional(),
});

export const stateSchema = z.object({
  id: z.string().optional().describe('The state node ID'),
  description: z
    .string()
    .optional()
    .describe('The text description of this state node'),
  type: z
    .union([
      z.literal('atomic'),
      z.literal('compound'),
      z.literal('parallel'),
      z.literal('history'),
      z.literal('final'),
    ])
    .optional()
    .describe(
      'The state type, if not a normal (atomic or compound) state node'
    ),
  entry: z.array(actionSchema).optional().describe('The entry actions'),
  exit: z.array(actionSchema).optional().describe('The exit actions'),
  initial: z.string().optional().describe('The initial child state'),
  on: z
    .record(z.string(), transitionSchema)
    .optional()
    .describe('The transitions'),
  after: z
    .record(z.string(), transitionSchema)
    .optional()
    .describe(
      'The delayed transitions that will trigger after the specified delay'
    ),
  always: z
    .array(transitionSchema)
    .optional()
    .describe(
      'The transitions that will immediately trigger if they are enabled; i.e. their guard evaluates to true'
    ),
  invoke: z
    .array(invokeSchema)
    .optional()
    .describe(
      'The invoked actors that will be spawned when the state is entered'
    ),
  meta: metaSchema.optional().describe('The metadata for this state node'),
  get states() {
    return z
      .record(z.string(), stateSchema)
      .optional()
      .describe('The child states');
  },
});

export const machineSchema = stateSchema.extend({
  version: z.string().optional(),
});
