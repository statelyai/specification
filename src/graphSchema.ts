import z from 'zod';

export const metaSchema = z.record(z.string(), z.any());

export const nodeSchema = z.object({
  id: z
    .string()
    .describe(
      'Unique identifier for the node within the document. Required attribute.'
    ),
  parentId: z
    .string()
    .optional()
    .describe(
      'ID of the parent node for nested graphs. See http://graphml.ethz.ch/specification.html#Nested_Graphs'
    ),
  description: z
    .string()
    .optional()
    .describe('Optional description of the node'),
  meta: metaSchema.optional().describe('Metadata for the node'),
});

export const edgeSchema = z.object({
  id: z.string().optional().describe('Optional unique identifier for the edge'),
  name: z
    .string()
    .describe(
      'Name or label of the edge. For state machines, this is the event name.'
    ),
  sourceId: z.string().describe('ID of the source node. Required attribute.'),
  targetId: z
    .union([
      z.string().describe('ID of the target node'),
      z
        .array(z.string())
        .describe(
          'IDs of multiple target nodes for hyperedges. See http://graphml.ethz.ch/specification.html#element-hyperedge'
        ),
    ])
    .describe(
      'ID(s) of the target node(s). Single string for regular edges, array for hyperedges.'
    ),
  description: z
    .string()
    .optional()
    .describe('Optional description of the edge'),
  meta: metaSchema.optional().describe('Metadata for the edge'),
});

export const graphSchema = z.object({
  description: z
    .string()
    .optional()
    .describe('Optional description of the graph'),
  nodes: z
    .array(nodeSchema)
    .describe(
      'Nodes in the graph. See http://graphml.ethz.ch/specification.html#element-node'
    ),
  edges: z
    .array(edgeSchema)
    .describe(
      'Edges connecting nodes. See http://graphml.ethz.ch/specification.html#element-edge'
    ),
});

export type Node = z.infer<typeof nodeSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Graph = z.infer<typeof graphSchema>;
