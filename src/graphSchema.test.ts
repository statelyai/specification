import { test, describe } from 'node:test';
import assert from 'node:assert';
import { graphSchema, nodeSchema, edgeSchema } from './graphSchema';
import z from 'zod';

describe('graphSchema', () => {
  test('graphSchema is defined', () => {
    assert.ok(graphSchema);
  });

  test('trivial graph', () => {
    graphSchema.parse({});
  });

  test('graph with type', () => {
    graphSchema.parse({
      type: 'directed',
    });

    graphSchema.parse({
      type: 'undirected',
    });
  });

  test('graph with nodes', () => {
    graphSchema.parse({
      nodes: [
        { id: 'n0' },
        { id: 'n1' },
      ],
    });
  });

  test('graph with edges', () => {
    graphSchema.parse({
      edges: [
        { sourceId: 'n0', targetId: 'n1' },
      ],
    });
  });

  test('complete graph', () => {
    graphSchema.parse({
      type: 'directed',
      description: 'A simple directed graph',
      nodes: [
        {
          id: 'n0',
          description: 'Start node',
          meta: { color: 'blue' },
        },
        {
          id: 'n1',
          description: 'End node',
          meta: { color: 'green' },
        },
      ],
      edges: [
        {
          id: 'e0',
          sourceId: 'n0',
          targetId: 'n1',
          description: 'Transition edge',
          meta: { weight: 1 },
        },
      ],
    } satisfies z.infer<typeof graphSchema>);
  });

  test('nested graph with parentId', () => {
    graphSchema.parse({
      nodes: [
        { id: 'n0' },
        { id: 'n1', parentId: 'n0' },
        { id: 'n2', parentId: 'n0' },
      ],
    });
  });

  test('hyperedge with multiple targets', () => {
    graphSchema.parse({
      edges: [
        {
          sourceId: 'n0',
          targetId: ['n1', 'n2', 'n3'],
          description: 'Hyperedge to multiple nodes',
        },
      ],
    });
  });

  test('invalid node without id', () => {
    assert.throws(() =>
      nodeSchema.parse({
        description: 'Invalid node',
      })
    );
  });

  test('invalid edge without sourceId', () => {
    assert.throws(() =>
      edgeSchema.parse({
        targetId: 'n1',
      })
    );
  });

  test('invalid edge without targetId', () => {
    assert.throws(() =>
      edgeSchema.parse({
        sourceId: 'n0',
      })
    );
  });

  test('invalid graph type', () => {
    assert.throws(() =>
      graphSchema.parse({
        type: 'invalid',
      })
    );
  });
});
