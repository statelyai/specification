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

export const stateSchema = z.intersection(
  z.union([
    atomicState,
    compoundState,
    parallelState,
    historyState,
    finalState,
  ]),
  z.object({
    get states() {
      return stateSchema;
    },
  })
);

type Test = z.infer<typeof stateSchema>;

export const machineSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  initial: z.string().optional(),
  states: z.record(z.string(), stateSchema).optional(),
  entry: z.array(actionSchema).optional(),
  exit: z.array(actionSchema).optional(),
  invoke: z.array(invokeSchema).optional(),
  on: z.array(transitionSchema).optional(),
  meta: metaSchema.optional(),
});
