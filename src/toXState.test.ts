import { describe, test } from 'node:test';
import assert from 'node:assert';
import { transition, initialTransition } from 'xstate';
import {
  toXStateConfig,
  toXStateMachine,
  isExpression,
  stripDelimiters,
  parseISO8601Duration,
} from './toXState';
import type { ExpressionEvaluator } from './toXState';
import type { StateMachine } from './machineSchema';
import {
  createJsonataEvaluator,
  jsonataToXStateConfig,
  jsonataToXStateMachine,
} from './jsonata';
import {
  createJmespathEvaluator,
  jmespathToXStateMachine,
} from './jmespath';
import {
  createJsonpathEvaluator,
  jsonpathToXStateMachine,
} from './jsonpath';

// --- Helpers ---

const noop: ExpressionEvaluator = () => undefined;

// --- Unit tests ---

describe('isExpression', () => {
  test('detects valid expression', () => {
    assert.ok(isExpression('{{ foo }}'));
    assert.ok(isExpression('{{ context.count + 1 }}'));
    assert.ok(isExpression('{{x}}'));
  });

  test('rejects non-expressions', () => {
    assert.ok(!isExpression('hello'));
    assert.ok(!isExpression('{{ no closing'));
    assert.ok(!isExpression(42));
    assert.ok(!isExpression(null));
  });
});

describe('stripDelimiters', () => {
  test('strips {{ }} and trims', () => {
    assert.strictEqual(stripDelimiters('{{ foo }}'), 'foo');
    assert.strictEqual(stripDelimiters('{{bar}}'), 'bar');
    assert.strictEqual(
      stripDelimiters('{{ context.count + 1 }}'),
      'context.count + 1'
    );
  });
});

describe('parseISO8601Duration', () => {
  test('parses seconds', () => {
    assert.strictEqual(parseISO8601Duration('PT30S'), 30000);
  });

  test('parses minutes', () => {
    assert.strictEqual(parseISO8601Duration('PT1M'), 60000);
  });

  test('parses hours', () => {
    assert.strictEqual(parseISO8601Duration('PT1H'), 3600000);
  });

  test('parses combined', () => {
    assert.strictEqual(parseISO8601Duration('PT1H30M5S'), 5405000);
  });

  test('parses days', () => {
    assert.strictEqual(parseISO8601Duration('P1D'), 86400000);
  });

  test('parses fractional seconds', () => {
    assert.strictEqual(parseISO8601Duration('PT0.5S'), 500);
  });

  test('passes through non-ISO strings', () => {
    assert.strictEqual(parseISO8601Duration('1000'), '1000');
    assert.strictEqual(parseISO8601Duration('notISO'), 'notISO');
  });
});

// --- Core converter structural tests ---

describe('toXStateConfig', () => {
  test('simple machine structure', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      initial: 'idle',
      states: {
        idle: {
          on: { START: { target: 'active' } },
        },
        active: {
          on: { STOP: { target: 'idle' } },
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.strictEqual(config.initial, 'idle');
    assert.ok(config.states.idle);
    assert.ok(config.states.active);
    assert.strictEqual(config.states.idle.on.START.target, 'active');
  });

  test('preserves context', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      context: { count: 0, name: 'test' },
      states: {},
    };
    const config = toXStateConfig(spec, noop);
    assert.deepStrictEqual(config.context, { count: 0, name: 'test' });
  });

  test('preserves state metadata', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        idle: {
          description: 'The idle state',
          tags: ['waiting'],
          meta: { color: 'gray' },
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.strictEqual(config.states.idle.description, 'The idle state');
    assert.deepStrictEqual(config.states.idle.tags, ['waiting']);
    assert.deepStrictEqual(config.states.idle.meta, { color: 'gray' });
  });

  test('converts nested states', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      initial: 'parent',
      states: {
        parent: {
          initial: 'child1',
          states: {
            child1: { on: { NEXT: { target: 'child2' } } },
            child2: { type: 'final' },
          },
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.strictEqual(config.states.parent.initial, 'child1');
    assert.ok(config.states.parent.states.child1);
    assert.strictEqual(config.states.parent.states.child2.type, 'final');
  });

  test('converts parallel states', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      type: 'parallel',
      states: {
        regionA: { states: { a1: {} } },
        regionB: { states: { b1: {} } },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.strictEqual(config.type, 'parallel');
  });

  test('converts history states', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        hist: {
          type: 'history',
          history: 'deep',
          target: 'idle',
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.strictEqual(config.states.hist.type, 'history');
    assert.strictEqual(config.states.hist.history, 'deep');
    assert.strictEqual(config.states.hist.target, 'idle');
  });

  test('converts custom action passthrough', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        idle: {
          entry: [{ type: 'myCustomAction', params: { foo: 'bar' } }],
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.deepStrictEqual(config.states.idle.entry[0], {
      type: 'myCustomAction',
      params: { foo: 'bar' },
    });
  });

  test('converts transition array with guard', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        idle: {
          on: {
            EVENT: [
              { target: 'a', guard: '{{ context.ready }}' },
              { target: 'b' },
            ],
          },
        },
        a: {},
        b: {},
      },
    };
    const config = toXStateConfig(spec, noop);
    const transitions = config.states.idle.on.EVENT;
    assert.ok(Array.isArray(transitions));
    assert.strictEqual(transitions.length, 2);
    assert.strictEqual(transitions[0].target, 'a');
    assert.strictEqual(typeof transitions[0].guard, 'function');
    assert.strictEqual(transitions[1].target, 'b');
  });

  test('converts after (delayed) transitions', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        waiting: {
          after: {
            '1000': { target: 'done' },
          },
        },
        done: {},
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.ok(config.states.waiting.after['1000']);
    assert.strictEqual(config.states.waiting.after['1000'].target, 'done');
  });

  test('converts after with ISO 8601 duration to ms', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        waiting: {
          after: {
            PT30S: { target: 'timeout' },
            PT1M: { target: 'longTimeout' },
          },
        },
        timeout: {},
        longTimeout: {},
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.ok(config.states.waiting.after[30000]);
    assert.strictEqual(config.states.waiting.after[30000].target, 'timeout');
    assert.ok(config.states.waiting.after[60000]);
    assert.strictEqual(config.states.waiting.after[60000].target, 'longTimeout');
  });

  test('converts always transitions', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        check: {
          always: { target: 'done', guard: '{{ context.ready }}' },
        },
        done: {},
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.ok(config.states.check.always);
    assert.strictEqual(typeof config.states.check.always.guard, 'function');
  });

  test('converts named guard', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        idle: {
          on: {
            GO: {
              target: 'active',
              guard: { type: 'isReady', params: { min: 5 } },
            },
          },
        },
        active: {},
      },
    };
    const config = toXStateConfig(spec, noop);
    const guard = config.states.idle.on.GO.guard;
    assert.deepStrictEqual(guard, { type: 'isReady', params: { min: 5 } });
  });

  test('converts invoke', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        loading: {
          invoke: [
            {
              src: 'fetchData',
              id: 'fetch',
              onDone: { target: 'success' },
              onError: { target: 'failure' },
            },
          ],
        },
        success: {},
        failure: {},
      },
    };
    const config = toXStateConfig(spec, noop);
    const inv = config.states.loading.invoke[0];
    assert.strictEqual(inv.src, 'fetchData');
    assert.strictEqual(inv.id, 'fetch');
    assert.strictEqual(inv.onDone.target, 'success');
    assert.strictEqual(inv.onError.target, 'failure');
  });

  test('converts invoke retry as metadata', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        loading: {
          invoke: [
            {
              src: 'fetchData',
              retry: { maxAttempts: 3, interval: 1000, backoff: 2 },
              onDone: { target: 'success' },
            },
          ],
        },
        success: {},
      },
    };
    const config = toXStateConfig(spec, noop);
    const inv = config.states.loading.invoke[0];
    assert.deepStrictEqual(inv.meta.retry, {
      maxAttempts: 3,
      interval: 1000,
      backoff: 2,
    });
  });

  test('transition context shorthand appends assign action', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            INC: {
              target: 'idle',
              context: { count: '{{ context.count + 1 }}' },
            },
          },
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    const actions = config.states.idle.on.INC.actions;
    assert.ok(Array.isArray(actions));
    assert.strictEqual(actions.length, 1);
  });

  test('transition context shorthand merges with explicit actions', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            INC: {
              target: 'idle',
              actions: [{ type: 'xstate.log' }],
              context: { count: '{{ context.count + 1 }}' },
            },
          },
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    const actions = config.states.idle.on.INC.actions;
    assert.strictEqual(actions.length, 2);
    // First is the explicit log, second is the appended assign
    assert.strictEqual(actions[0].type, 'xstate.log');
  });

  test('converts emit action with static event', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        idle: {
          entry: [
            {
              type: 'xstate.emit',
              params: { event: { type: 'NOTIFICATION', data: 'hi' } },
            },
          ],
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.ok(config.states.idle.entry[0]);
    // xstate emit returns a function-based action
    assert.strictEqual(config.states.idle.entry[0].type, 'xstate.emit');
  });

  test('converts emit action with expression event', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        idle: {
          entry: [
            {
              type: 'xstate.emit',
              params: { event: '{{ { "type": "PROGRESS", "value": context.pct } }}' },
            },
          ],
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.ok(config.states.idle.entry[0]);
    assert.strictEqual(config.states.idle.entry[0].type, 'xstate.emit');
  });

  test('converts final state output expression', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        done: {
          type: 'final',
          output: '{{ context.result }}',
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.strictEqual(typeof config.states.done.output, 'function');
  });

  test('converts final state static output', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      states: {
        done: {
          type: 'final',
          output: { status: 'ok' },
        },
      },
    };
    const config = toXStateConfig(spec, noop);
    assert.deepStrictEqual(config.states.done.output, { status: 'ok' });
  });
});

// --- toXStateMachine with transition() ---

describe('toXStateMachine', () => {
  test('basic transitions via transition()', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      initial: 'idle',
      states: {
        idle: { on: { GO: { target: 'active' } } },
        active: { on: { STOP: { target: 'idle' } } },
      },
    };
    const machine = toXStateMachine(spec, noop);
    const [s0] = initialTransition(machine);
    assert.strictEqual(s0.value, 'idle');

    const [s1] = transition(machine, s0, { type: 'GO' });
    assert.strictEqual(s1.value, 'active');

    const [s2] = transition(machine, s1, { type: 'STOP' });
    assert.strictEqual(s2.value, 'idle');
  });
});

// --- JSONata integration ---

describe('jsonata converter', () => {
  test('createJsonataEvaluator returns promise', async () => {
    const evaluate = createJsonataEvaluator();
    const result = evaluate('context.count + 1', {
      context: { count: 5 },
      event: {},
    });
    assert.ok(result instanceof Promise, 'jsonata v2 evaluate returns a Promise');
    assert.strictEqual(await result, 6);
  });

  test('jsonata arithmetic expressions', async () => {
    const evaluate = createJsonataEvaluator();
    assert.strictEqual(
      await evaluate('context.a * context.b', { context: { a: 3, b: 7 }, event: {} }),
      21
    );
    assert.strictEqual(
      await evaluate('context.x > 10', { context: { x: 15 }, event: {} }),
      true
    );
    assert.strictEqual(
      await evaluate('context.x > 10', { context: { x: 5 }, event: {} }),
      false
    );
  });

  test('jsonata event data access', async () => {
    const evaluate = createJsonataEvaluator();
    assert.strictEqual(
      await evaluate('event.amount', {
        context: {},
        event: { type: 'SET', amount: 42 },
      }),
      42
    );
  });

  test('jsonata string concatenation', async () => {
    const evaluate = createJsonataEvaluator();
    assert.strictEqual(
      await evaluate('context.first & " " & context.last', {
        context: { first: 'John', last: 'Doe' },
        event: {},
      }),
      'John Doe'
    );
  });

  test('jsonata array/object expressions', async () => {
    const evaluate = createJsonataEvaluator();
    const data = {
      context: {
        items: [
          { name: 'a', active: true },
          { name: 'b', active: false },
        ],
      },
      event: {},
    };
    const result = await evaluate('context.items[active = true].name', data);
    assert.strictEqual(result, 'a');
  });

  test('jsonataToXStateConfig produces config with expression wrappers', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            INC: {
              target: 'idle',
              actions: [
                {
                  type: 'xstate.assign',
                  params: { count: '{{ context.count + 1 }}' },
                },
              ],
            },
          },
        },
      },
    };
    const config = jsonataToXStateConfig(spec);
    assert.strictEqual(config.initial, 'idle');
    assert.deepStrictEqual(config.context, { count: 0 });
    const actions = config.states.idle.on.INC.actions;
    assert.ok(actions.length === 1);
  });

  test('jsonataToXStateMachine transitions work', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonata',
      initial: 'idle',
      states: {
        idle: { on: { GO: { target: 'active' } } },
        active: { on: { STOP: { target: 'idle' } } },
      },
    };
    const machine = jsonataToXStateMachine(spec);
    const [s0] = initialTransition(machine);
    assert.strictEqual(s0.value, 'idle');
    const [s1] = transition(machine, s0, { type: 'GO' });
    assert.strictEqual(s1.value, 'active');
  });
});

// --- JMESPath integration (sync — full expression evaluation via transition()) ---

describe('jmespath converter', () => {
  test('createJmespathEvaluator evaluates expressions', () => {
    const evaluate = createJmespathEvaluator();
    assert.strictEqual(
      evaluate('context.count', { context: { count: 42 }, event: {} }),
      42
    );
  });

  test('jmespath assign updates context via transition()', () => {
    const spec: StateMachine = {
      queryLanguage: 'jmespath',
      initial: 'idle',
      context: { name: 'world', greeting: '' },
      states: {
        idle: {
          on: {
            GREET: {
              target: 'idle',
              actions: [
                {
                  type: 'xstate.assign',
                  params: { greeting: '{{ context.name }}' },
                },
              ],
            },
          },
        },
      },
    };
    const machine = jmespathToXStateMachine(spec);
    const [s0] = initialTransition(machine);
    assert.strictEqual(s0.context.greeting, '');

    const [s1] = transition(machine, s0, { type: 'GREET' });
    assert.strictEqual(s1.context.greeting, 'world');
  });

  test('jmespath guard blocks/allows transitions via transition()', () => {
    const spec: StateMachine = {
      queryLanguage: 'jmespath',
      initial: 'idle',
      context: { ready: false },
      states: {
        idle: {
          on: {
            GO: [{ target: 'active', guard: '{{ context.ready }}' }],
            ENABLE: {
              target: 'idle',
              actions: [
                { type: 'xstate.assign', params: { ready: true } },
              ],
            },
          },
        },
        active: {},
      },
    };
    const machine = jmespathToXStateMachine(spec);
    const [s0] = initialTransition(machine);

    // Guard blocks: ready is false
    const [s1] = transition(machine, s0, { type: 'GO' });
    assert.strictEqual(s1.value, 'idle');

    // Enable ready
    const [s2] = transition(machine, s0, { type: 'ENABLE' });
    assert.strictEqual(s2.context.ready, true);

    // Now guard passes
    const [s3] = transition(machine, s2, { type: 'GO' });
    assert.strictEqual(s3.value, 'active');
  });

  test('jmespath transition context shorthand assigns via transition()', () => {
    const spec: StateMachine = {
      queryLanguage: 'jmespath',
      initial: 'idle',
      context: { name: 'world', greeting: '' },
      states: {
        idle: {
          on: {
            GREET: {
              target: 'idle',
              context: { greeting: '{{ context.name }}' },
            },
          },
        },
      },
    };
    const machine = jmespathToXStateMachine(spec);
    const [s0] = initialTransition(machine);
    assert.strictEqual(s0.context.greeting, '');

    const [s1] = transition(machine, s0, { type: 'GREET' });
    assert.strictEqual(s1.context.greeting, 'world');
  });

  test('jmespath transition context shorthand with static values', () => {
    const spec: StateMachine = {
      queryLanguage: 'jmespath',
      initial: 'idle',
      context: { status: 'pending' },
      states: {
        idle: {
          on: {
            SUBMIT: {
              target: 'done',
              context: { status: 'submitted' },
            },
          },
        },
        done: {},
      },
    };
    const machine = jmespathToXStateMachine(spec);
    const [s0] = initialTransition(machine);
    const [s1] = transition(machine, s0, { type: 'SUBMIT' });
    assert.strictEqual(s1.value, 'done');
    assert.strictEqual(s1.context.status, 'submitted');
  });

  test('jmespath event data access via transition()', () => {
    const spec: StateMachine = {
      queryLanguage: 'jmespath',
      initial: 'idle',
      context: { selected: null },
      states: {
        idle: {
          on: {
            SELECT: {
              target: 'idle',
              actions: [
                {
                  type: 'xstate.assign',
                  params: { selected: '{{ event.id }}' },
                },
              ],
            },
          },
        },
      },
    };
    const machine = jmespathToXStateMachine(spec);
    const [s0] = initialTransition(machine);
    const [s1] = transition(machine, s0, {
      type: 'SELECT',
      id: 'item-1',
    } as any);
    assert.strictEqual(s1.context.selected, 'item-1');
  });

  test('jmespath branching with multiple guards via transition()', () => {
    const spec: StateMachine = {
      queryLanguage: 'jmespath',
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            CHECK: [
              { target: 'high', guard: '{{ context.count }}' },
              { target: 'low' },
            ],
          },
        },
        high: {},
        low: {},
      },
    };
    const machine = jmespathToXStateMachine(spec);

    // count=0 is falsy → falls to second branch
    const [s0] = initialTransition(machine);
    const [s1] = transition(machine, s0, { type: 'CHECK' });
    assert.strictEqual(s1.value, 'low');

    // count=5 is truthy → first branch
    const withCount = { ...s0, context: { count: 5 } };
    const [s2] = transition(machine, withCount, { type: 'CHECK' });
    assert.strictEqual(s2.value, 'high');
  });
});

// --- JSONPath integration (sync — full expression evaluation via transition()) ---

describe('jsonpath converter', () => {
  test('createJsonpathEvaluator evaluates expressions', () => {
    const evaluate = createJsonpathEvaluator();
    assert.strictEqual(
      evaluate('$.context.count', { context: { count: 99 }, event: {} }),
      99
    );
  });

  test('jsonpath assign updates context via transition()', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonpath',
      initial: 'idle',
      context: { items: ['a', 'b', 'c'], first: null },
      states: {
        idle: {
          on: {
            PICK: {
              target: 'idle',
              actions: [
                {
                  type: 'xstate.assign',
                  params: { first: '{{ $.context.items[0] }}' },
                },
              ],
            },
          },
        },
      },
    };
    const machine = jsonpathToXStateMachine(spec);
    const [s0] = initialTransition(machine);
    assert.strictEqual(s0.context.first, null);

    const [s1] = transition(machine, s0, { type: 'PICK' });
    assert.strictEqual(s1.context.first, 'a');
  });

  test('jsonpath guard blocks/allows transitions via transition()', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonpath',
      initial: 'idle',
      context: { enabled: false },
      states: {
        idle: {
          on: {
            GO: [{ target: 'active', guard: '{{ $.context.enabled }}' }],
            TURN_ON: {
              target: 'idle',
              actions: [
                { type: 'xstate.assign', params: { enabled: true } },
              ],
            },
          },
        },
        active: {},
      },
    };
    const machine = jsonpathToXStateMachine(spec);
    const [s0] = initialTransition(machine);

    // Guard blocks: enabled is false
    const [s1] = transition(machine, s0, { type: 'GO' });
    assert.strictEqual(s1.value, 'idle');

    // Turn on
    const [s2] = transition(machine, s0, { type: 'TURN_ON' });
    assert.strictEqual(s2.context.enabled, true);

    // Now guard passes
    const [s3] = transition(machine, s2, { type: 'GO' });
    assert.strictEqual(s3.value, 'active');
  });

  test('jsonpath event data access via transition()', () => {
    const spec: StateMachine = {
      queryLanguage: 'jsonpath',
      initial: 'idle',
      context: { lastEvent: null },
      states: {
        idle: {
          on: {
            UPDATE: {
              target: 'idle',
              actions: [
                {
                  type: 'xstate.assign',
                  params: { lastEvent: '{{ $.event.payload }}' },
                },
              ],
            },
          },
        },
      },
    };
    const machine = jsonpathToXStateMachine(spec);
    const [s0] = initialTransition(machine);
    const [s1] = transition(machine, s0, {
      type: 'UPDATE',
      payload: 'hello',
    } as any);
    assert.strictEqual(s1.context.lastEvent, 'hello');
  });
});
