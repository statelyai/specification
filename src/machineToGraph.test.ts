import { test, describe } from 'node:test';
import assert from 'node:assert';
import { machineToGraph } from './machineToGraph';
import { StateMachine } from './machineSchema';

describe('machineToGraph', () => {
  test('empty machine', () => {
    const machine: StateMachine = {};
    const graph = machineToGraph(machine);

    assert.deepStrictEqual(graph.nodes, []);
    assert.deepStrictEqual(graph.edges, []);
  });

  test('machine with single state', () => {
    const machine: StateMachine = {
      id: 'test',
      states: {
        idle: {},
      },
    };
    const graph = machineToGraph(machine);

    assert.strictEqual(graph.nodes.length, 2); // root + idle
    assert.ok(graph.nodes.find((n) => n.id === 'test'));
    assert.ok(
      graph.nodes.find((n) => n.id === 'test.idle' && n.parentId === 'test')
    );
  });

  test('machine with initial state', () => {
    const machine: StateMachine = {
      id: 'test',
      initial: 'idle',
      states: {
        idle: {},
        active: {},
      },
    };
    const graph = machineToGraph(machine);

    const initialEdge = graph.edges.find(
      (e) => e.sourceId === 'test' && e.targetId === 'test.idle'
    );
    assert.ok(initialEdge);
    assert.strictEqual(initialEdge.description, 'Initial transition');
  });

  test('machine with event transitions', () => {
    const machine: StateMachine = {
      states: {
        idle: {
          on: {
            START: {
              target: 'active',
            },
          },
        },
        active: {},
      },
    };
    const graph = machineToGraph(machine);

    const edge = graph.edges.find(
      (e) => e.sourceId === 'idle' && e.targetId === 'active'
    );
    assert.ok(edge);
    assert.strictEqual(edge.description, 'On START');
  });

  test('machine with multiple transitions on same event', () => {
    const machine: StateMachine = {
      states: {
        idle: {
          on: {
            CLICK: [{ target: 'loading' }, { target: 'error' }],
          },
        },
        loading: {},
        error: {},
      },
    };
    const graph = machineToGraph(machine);

    const edges = graph.edges.filter(
      (e) => e.sourceId === 'idle' && e.description === 'On CLICK'
    );
    assert.strictEqual(edges?.length, 2);
  });

  test('machine with delayed transitions', () => {
    const machine: StateMachine = {
      states: {
        waiting: {
          after: {
            '1000': {
              target: 'done',
            },
          },
        },
        done: {},
      },
    };
    const graph = machineToGraph(machine);

    const edge = graph.edges.find(
      (e) => e.sourceId === 'waiting' && e.targetId === 'done'
    );
    assert.ok(edge);
    assert.strictEqual(edge.description, 'After 1000');
  });

  test('machine with always transitions', () => {
    const machine: StateMachine = {
      states: {
        checking: {
          always: {
            target: 'done',
          },
        },
        done: {},
      },
    };
    const graph = machineToGraph(machine);

    const edge = graph.edges.find(
      (e) => e.sourceId === 'checking' && e.targetId === 'done'
    );
    assert.ok(edge);
    assert.strictEqual(edge.description, 'Always');
  });

  test('machine with invoke transitions', () => {
    const machine: StateMachine = {
      states: {
        loading: {
          invoke: [
            {
              src: 'fetchData',
              onDone: {
                target: 'success',
              },
              onError: {
                target: 'error',
              },
            },
          ],
        },
        success: {},
        error: {},
      },
    };
    const graph = machineToGraph(machine);

    const doneEdge = graph.edges.find(
      (e) => e.sourceId === 'loading' && e.targetId === 'success'
    );
    assert.ok(doneEdge);
    assert.strictEqual(doneEdge.description, 'onDone: fetchData');

    const errorEdge = graph.edges.find(
      (e) => e.sourceId === 'loading' && e.targetId === 'error'
    );
    assert.ok(errorEdge);
    assert.strictEqual(errorEdge.description, 'onError: fetchData');
  });

  test('nested states', () => {
    const machine: StateMachine = {
      id: 'parent',
      states: {
        outer: {
          initial: 'inner1',
          states: {
            inner1: {},
            inner2: {},
          },
        },
      },
    };
    const graph = machineToGraph(machine);

    const outerNode = graph.nodes.find((n) => n.id === 'parent.outer');
    assert.ok(outerNode);
    assert.strictEqual(outerNode.parentId, 'parent');

    const inner1Node = graph.nodes.find((n) => n.id === 'parent.outer.inner1');
    assert.ok(inner1Node);
    assert.strictEqual(inner1Node.parentId, 'parent.outer');

    const initialEdge = graph.edges.find(
      (e) =>
        e.sourceId === 'parent.outer' && e.targetId === 'parent.outer.inner1'
    );
    assert.ok(initialEdge);
  });

  test('preserves metadata', () => {
    const machine: StateMachine = {
      description: 'Test machine',
      states: {
        idle: {
          description: 'Idle state',
          meta: { color: 'blue' },
          on: {
            START: {
              target: 'active',
              meta: { priority: 'high' },
            },
          },
        },
        active: {},
      },
    };
    const graph = machineToGraph(machine);

    assert.strictEqual(graph.description, 'Test machine');

    const idleNode = graph.nodes.find((n) => n.id === 'idle');
    assert.strictEqual(idleNode?.description, 'Idle state');
    assert.deepStrictEqual(idleNode?.meta, { color: 'blue' });

    const edge = graph.edges.find((e) => e.sourceId === 'idle');
    assert.deepStrictEqual(edge?.meta, { priority: 'high' });
  });

  test('complex machine', () => {
    const machine: StateMachine = {
      id: 'traffic',
      description: 'Traffic light controller',
      initial: 'red',
      states: {
        red: {
          description: 'Stop',
          after: {
            '30000': {
              target: 'green',
            },
          },
        },
        yellow: {
          description: 'Caution',
          after: {
            '3000': {
              target: 'red',
            },
          },
        },
        green: {
          description: 'Go',
          after: {
            '25000': {
              target: 'yellow',
            },
          },
          on: {
            EMERGENCY: {
              target: 'red',
            },
          },
        },
      },
    };
    const graph = machineToGraph(machine);

    assert.strictEqual(graph.nodes?.length, 4); // root + 3 states
    assert.strictEqual(graph.edges?.length, 5); // 1 initial + 4 transitions (3 after + 1 on)
    assert.strictEqual(graph.description, 'Traffic light controller');
  });
});
