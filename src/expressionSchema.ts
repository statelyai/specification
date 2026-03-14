import z from 'zod';

export const queryLanguageSchema = z
  .enum(['jsonata', 'jmespath', 'jsonpath'])
  .optional()
  .describe(
    'The expression language used for evaluating expressions in the machine'
  );

export const expressionSchema = z
  .string()
  .regex(/^\{\{[\s\S]*\}\}$/)
  .describe('An expression string delimited by {{ }}');

/** Creates a union of expression string or the given schema */
export function expressionOr<T extends z.ZodType>(schema: T) {
  return z.union([expressionSchema, schema]);
}

/** A JSON Schema property definition (permissive) */
export const jsonSchemaPropertySchema: z.ZodType<Record<string, any>> = z
  .record(z.string(), z.any())
  .describe('A JSON Schema property definition');
