import { test, describe } from 'node:test';
import assert from 'node:assert';
import { machineSchema } from './machineSchema';
import z from 'zod';

describe('machineSchema', () => {
  test('trivial machine', () => {
    machineSchema.parse({});
  });

  test('all basic properties', () => {
    machineSchema.parse({
      id: 'test',
      description: 'test',
      version: '1.0.0',
      initial: 'idle',
      states: {
        idle: {},
      },
    });
  });

  test('invalid machine', () => {
    assert.throws(() => machineSchema.parse({ id: 3 }));
  });

  // --- queryLanguage ---

  test('queryLanguage', () => {
    machineSchema.parse({ queryLanguage: 'jsonata' });
    machineSchema.parse({ queryLanguage: 'jmespath' });
    machineSchema.parse({ queryLanguage: 'jsonpath' });
  });

  test('invalid queryLanguage', () => {
    assert.throws(() => machineSchema.parse({ queryLanguage: 'sql' }));
  });

  // --- Context ---

  test('context with initial values', () => {
    machineSchema.parse({
      context: { count: 0, name: '', items: [] },
    });
  });

  // --- Schemas ---

  test('schemas for context and events', () => {
    machineSchema.parse({
      context: { count: 0 },
      schemas: {
        context: {
          count: { type: 'number' },
        },
        events: {
          INCREMENT: {
            amount: { type: 'number' },
          },
        },
      },
    });
  });

  // --- Input ---

  test('input JSON Schema', () => {
    machineSchema.parse({
      input: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
        },
      },
    });
  });

  // --- Expressions ---

  test('assign action with expressions', () => {
    machineSchema.parse({
      initial: 'active',
      states: {
        active: {
          entry: [
            {
              type: 'xstate.assign',
              params: {
                count: '{{ $context.count + 1 }}',
                name: 'literal string',
              },
            },
          ],
        },
      },
    });
  });

  test('inline guard expression', () => {
    machineSchema.parse({
      initial: 'active',
      states: {
        active: {
          on: {
            NEXT: {
              target: 'done',
              guard: '{{ $context.count > 0 }}',
            },
          },
        },
        done: { type: 'final' },
      },
    });
  });

  test('named guard object', () => {
    machineSchema.parse({
      initial: 'active',
      states: {
        active: {
          on: {
            NEXT: {
              target: 'done',
              guard: { type: 'isReady', params: { threshold: 5 } },
            },
          },
        },
        done: { type: 'final' },
      },
    });
  });

  // --- Transition object ---

  test('transition object', () => {
    machineSchema.parse({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: { target: 'b' },
          },
        },
        b: {},
      },
    });
  });

  test('string transition shorthand rejected', () => {
    assert.throws(() =>
      machineSchema.parse({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: 'b',
            },
          },
          b: {},
        },
      })
    );
  });

  test('transition with context shorthand', () => {
    machineSchema.parse({
      initial: 'a',
      states: {
        a: {
          on: {
            INC: {
              target: 'a',
              context: { count: '{{ context.count + 1 }}' },
            },
          },
        },
      },
    });
  });

  test('transition with context shorthand and static value', () => {
    machineSchema.parse({
      initial: 'a',
      states: {
        a: {
          on: {
            RESET: {
              target: 'a',
              context: { count: 0, name: 'default' },
            },
          },
        },
      },
    });
  });

  test('transition with order', () => {
    machineSchema.parse({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: [
              { target: 'b', guard: '{{ $context.x }}', order: 1 },
              { target: 'c', order: 2 },
            ],
          },
        },
        b: {},
        c: {},
      },
    });
  });

  // --- Built-in actions ---

  test('raise action', () => {
    machineSchema.parse({
      initial: 'a',
      states: {
        a: {
          entry: [{ type: 'xstate.raise', params: { event: 'DONE' } }],
        },
      },
    });
  });

  test('sendTo action', () => {
    machineSchema.parse({
      initial: 'a',
      states: {
        a: {
          entry: [
            {
              type: 'xstate.sendTo',
              params: {
                actorRef: '{{ $system.worker }}',
                event: '{{ { "type": "PING" } }}',
              },
            },
          ],
        },
      },
    });
  });

  test('log action', () => {
    machineSchema.parse({
      initial: 'a',
      states: {
        a: {
          entry: [
            { type: 'xstate.log', params: { message: '{{ "count: " & $context.count }}' } },
            { type: 'xstate.log' },
          ],
        },
      },
    });
  });

  test('emit action', () => {
    machineSchema.parse({
      initial: 'a',
      states: {
        a: {
          entry: [
            {
              type: 'xstate.emit',
              params: { event: { type: 'NOTIFICATION', message: 'hello' } },
            },
            {
              type: 'xstate.emit',
              params: { event: '{{ { "type": "PROGRESS", "value": context.progress } }}' },
            },
          ],
        },
      },
    });
  });

  test('custom action', () => {
    machineSchema.parse({
      initial: 'a',
      states: {
        a: {
          entry: [
            { type: 'myCustomAction', params: { foo: 'bar' } },
          ],
        },
      },
    });
  });

  // --- Tags ---

  test('state tags', () => {
    machineSchema.parse({
      initial: 'loading',
      states: {
        loading: { tags: ['busy', 'pending'] },
        idle: { tags: ['ready'] },
      },
    });
  });

  // --- Output ---

  test('final state output', () => {
    machineSchema.parse({
      initial: 'active',
      states: {
        active: {
          on: { DONE: { target: 'complete' } },
        },
        complete: {
          type: 'final',
          output: '{{ { "result": $context.data } }}',
        },
      },
    });
  });

  test('final state static output', () => {
    machineSchema.parse({
      initial: 'active',
      states: {
        active: { on: { DONE: { target: 'complete' } } },
        complete: {
          type: 'final',
          output: { status: 'ok' },
        },
      },
    });
  });

  // --- Invoke extensions ---

  test('invoke with input, onSnapshot, timeout', () => {
    machineSchema.parse({
      initial: 'processing',
      states: {
        processing: {
          invoke: [
            {
              id: 'worker',
              src: 'processOrder',
              input: '{{ { "orderId": $context.orderId } }}',
              timeout: 'PT30S',
              heartbeat: 'PT5S',
              onDone: { target: 'done' },
              onError: [
                { target: 'processing', guard: '{{ $context.retries < 3 }}' },
                { target: 'failed' },
              ],
              onSnapshot: {
                actions: [
                  {
                    type: 'xstate.assign',
                    params: { progress: '{{ $event.snapshot }}' },
                  },
                ],
              },
            },
          ],
        },
        done: { type: 'final' },
        failed: { type: 'final' },
      },
    });
  });

  test('invoke with retry policy', () => {
    machineSchema.parse({
      initial: 'loading',
      states: {
        loading: {
          invoke: [
            {
              src: 'fetchData',
              retry: { maxAttempts: 3, interval: 1000, backoff: 2 },
              onDone: { target: 'success' },
              onError: { target: 'failed' },
            },
          ],
        },
        success: { type: 'final' },
        failed: { type: 'final' },
      },
    });
  });

  test('invoke with retry ISO duration interval', () => {
    machineSchema.parse({
      initial: 'loading',
      states: {
        loading: {
          invoke: [
            {
              src: 'fetchData',
              retry: { maxAttempts: 5, interval: 'PT5S', backoff: 1.5 },
              onDone: { target: 'success' },
            },
          ],
        },
        success: { type: 'final' },
      },
    });
  });

  // --- After with ISO 8601 ---

  test('after with ISO 8601 duration', () => {
    machineSchema.parse({
      initial: 'waiting',
      states: {
        waiting: {
          after: {
            PT30S: { target: 'timeout' },
          },
        },
        timeout: { type: 'final' },
      },
    });
  });

  // --- History states ---

  test('history state', () => {
    machineSchema.parse({
      initial: 'active',
      states: {
        active: {
          initial: 'a',
          states: {
            a: {},
            b: {},
            hist: { type: 'history', history: 'deep', target: 'a' },
          },
        },
      },
    });
  });

  // --- Parallel states ---

  test('parallel state', () => {
    machineSchema.parse({
      type: 'parallel',
      states: {
        upload: {
          initial: 'idle',
          states: { idle: {}, uploading: {} },
        },
        download: {
          initial: 'idle',
          states: { idle: {}, downloading: {} },
        },
      },
    });
  });

  // --- Full integration ---

  test('full order flow machine', () => {
    machineSchema.parse({
      version: '1.0.0',
      id: 'orderFlow',
      queryLanguage: 'jsonata',
      input: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
      },
      context: { retries: 0, result: null, items: [] },
      schemas: {
        context: {
          retries: { type: 'number' },
          result: {},
          items: { type: 'array' },
        },
        events: {
          SUBMIT: { paymentMethod: { type: 'string' } },
        },
      },
      initial: 'pending',
      states: {
        pending: {
          tags: ['idle'],
          entry: [
            {
              type: 'xstate.assign',
              params: { retries: '{{ $context.retries + 1 }}' },
            },
          ],
          on: {
            SUBMIT: {
              target: 'processing',
              guard: '{{ $context.items.length > 0 }}',
              actions: [
                {
                  type: 'xstate.log',
                  params: {
                    message: "{{ 'Order ' & $event.orderId }}",
                  },
                },
              ],
            },
            CANCEL: { target: 'cancelled' },
          },
        },
        processing: {
          invoke: [
            {
              id: 'processOrder',
              src: 'orderProcessor',
              input:
                "{{ { 'orderId': $context.orderId, 'items': $context.items } }}",
              timeout: 'PT30S',
              retry: { maxAttempts: 3, interval: 'PT2S', backoff: 2 },
              onDone: {
                target: 'complete',
                actions: [
                  {
                    type: 'xstate.assign',
                    params: { result: '{{ $event.output }}' },
                  },
                ],
              },
              onError: [
                {
                  target: 'pending',
                  guard: '{{ $context.retries < 3 }}',
                },
                { target: 'failed' },
              ],
              onSnapshot: {
                actions: [
                  {
                    type: 'xstate.assign',
                    params: { progress: '{{ $event.snapshot }}' },
                  },
                ],
              },
            },
          ],
        },
        complete: {
          type: 'final',
          output: "{{ { 'result': $context.result } }}",
        },
        cancelled: { type: 'final' },
        failed: { type: 'final' },
      },
    } satisfies z.infer<typeof machineSchema>);
  });
});
