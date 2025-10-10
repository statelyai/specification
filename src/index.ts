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

// Define the recursive state schema using z.lazy()
export const stateSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    // Atomic state
    z.object({
      id: z.string().optional(),
      description: z.string().optional(),
      type: z.literal('atomic').optional(),
      entry: z.array(actionSchema).optional(),
      exit: z.array(actionSchema).optional(),
      on: z.record(z.string(), transitionSchema).optional(),
      after: z.record(z.string(), transitionSchema).optional(),
      always: z.array(transitionSchema).optional(),
    }),
    // Compound state
    z.object({
      id: z.string().optional(),
      description: z.string().optional(),
      type: z.literal('compound').optional(),
      entry: z.array(actionSchema).optional(),
      exit: z.array(actionSchema).optional(),
      initial: z.string(),
      states: z.record(z.string(), stateSchema),
      onDone: z.array(transitionSchema).optional(),
      after: z.record(z.string(), transitionSchema).optional(),
      always: z.array(transitionSchema).optional(),
    }),
    // Final state
    z.object({
      id: z.string().optional(),
      description: z.string().optional(),
      type: z.literal('final').optional(),
      entry: z.array(actionSchema).optional(),
      exit: z.array(actionSchema).optional(),
      output: z.any().optional(),
    }),
    // History state
    z.object({
      id: z.string().optional(),
      description: z.string().optional(),
      type: z.literal('history').optional(),
      entry: z.array(actionSchema).optional(),
      exit: z.array(actionSchema).optional(),
      history: z.enum(['shallow', 'deep']).optional(),
      target: z.string().optional(),
    }),
    // Parallel state
    z.object({
      id: z.string().optional(),
      description: z.string().optional(),
      type: z.literal('parallel').optional(),
      entry: z.array(actionSchema).optional(),
      exit: z.array(actionSchema).optional(),
      states: z.record(z.string(), stateSchema),
      onDone: z.array(invokeSchema).optional(),
      after: z.record(z.string(), transitionSchema).optional(),
      always: z.array(transitionSchema).optional(),
    }),
  ])
);

export const machineSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  initial: z.string(),
  states: z.record(z.string(), stateSchema),
});
