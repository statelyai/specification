/**
 * Type-level tests for Zod schema inference.
 * Run with `tsc --noEmit` — these are compile-time only.
 *
 * NOTE: stateSchema uses `z.ZodObject<any>` for recursive child states,
 * which makes State and StateMachine inferred types too wide.
 * Sub-schemas (transitions, actions, guards, invoke) ARE well-typed.
 * Runtime Zod validation still catches all errors regardless.
 */
import type { z } from 'zod';
import type {
  machineSchema,
  stateSchema,
  transitionObjectSchema,
  transitionsSchema,
  actionSchema,
  assignActionSchema,
  raiseActionSchema,
  sendToActionSchema,
  logActionSchema,
  emitActionSchema,
  customActionSchema,
  guardSchema,
  namedGuardSchema,
  invokeSchema,
  retrySchema,
  schemasSchema,
} from './machineSchema';

type StateMachine = z.infer<typeof machineSchema>;
type State = z.infer<typeof stateSchema>;
type TransitionObject = z.infer<typeof transitionObjectSchema>;
type Transitions = z.infer<typeof transitionsSchema>;
type Action = z.infer<typeof actionSchema>;
type AssignAction = z.infer<typeof assignActionSchema>;
type RaiseAction = z.infer<typeof raiseActionSchema>;
type SendToAction = z.infer<typeof sendToActionSchema>;
type LogAction = z.infer<typeof logActionSchema>;
type EmitAction = z.infer<typeof emitActionSchema>;
type CustomAction = z.infer<typeof customActionSchema>;
type Guard = z.infer<typeof guardSchema>;
type NamedGuard = z.infer<typeof namedGuardSchema>;
type Invoke = z.infer<typeof invokeSchema>;
type Retry = z.infer<typeof retrySchema>;
type Schemas = z.infer<typeof schemasSchema>;

// --- Helpers ---
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assert<T>(_value: T) {}

// ============================================================
// StateMachine / State — wide due to ZodObject<any> recursion.
// These compile-time tests verify assignability, not narrowness.
// ============================================================

assert<StateMachine>({});
assert<StateMachine>({
  version: '1.0',
  queryLanguage: 'jsonata',
  context: { count: 0 },
  initial: 'idle',
  states: {
    idle: { on: { GO: { target: 'active' } } },
    active: {},
  },
});
assert<State>({});
assert<State>({ type: 'parallel' });
assert<State>({ type: 'final' });
assert<State>({ type: 'history', history: 'deep' });

// ============================================================
// TransitionObject — well-typed
// ============================================================

assert<TransitionObject>({ target: 'foo' });
assert<TransitionObject>({
  target: 'bar',
  guard: '{{ context.ready }}',
  actions: [{ type: 'xstate.assign', params: { x: 1 } }],
  description: 'go to bar',
  order: 1,
});
assert<TransitionObject>({}); // all fields optional
assert<TransitionObject>({
  target: 'foo',
  context: { count: '{{ context.count + 1 }}' },
});
assert<TransitionObject>({
  target: 'foo',
  context: { status: 'done', count: 42 },
});

// @ts-expect-error — string shorthand not allowed
assert<TransitionObject>('target');

// @ts-expect-error — target must be string
assert<TransitionObject>({ target: 123 });

// @ts-expect-error — actions must be array
assert<TransitionObject>({ actions: { type: 'xstate.log' } });

// @ts-expect-error — order must be number
assert<TransitionObject>({ order: 'first' });

// @ts-expect-error — description must be string
assert<TransitionObject>({ description: 42 });

// ============================================================
// Transitions (union: object | object[]) — well-typed
// ============================================================

assert<Transitions>({ target: 'a' });
assert<Transitions>([
  { target: 'a', guard: '{{ context.x }}' },
  { target: 'b' },
]);

// @ts-expect-error — number not valid
assert<Transitions>(42);

// @ts-expect-error — array of strings not valid
assert<Transitions>(['a', 'b']);

// ============================================================
// Actions — well-typed (xstate. prefixed)
// ============================================================

assert<AssignAction>({ type: 'xstate.assign', params: { x: 1, y: '{{ event.val }}' } });
assert<RaiseAction>({ type: 'xstate.raise', params: { event: { type: 'DONE' } } });
assert<SendToAction>({
  type: 'xstate.sendTo',
  params: { actorRef: 'myActor', event: { type: 'PING' } },
});
assert<LogAction>({ type: 'xstate.log' });
assert<LogAction>({ type: 'xstate.log', params: { message: 'hello' } });
assert<EmitAction>({ type: 'xstate.emit', params: { event: { type: 'NOTIFY' } } });
assert<CustomAction>({ type: 'myAction', params: { foo: 'bar' } });
assert<CustomAction>({ type: 'myAction' });

// @ts-expect-error — assign requires params
assert<AssignAction>({ type: 'xstate.assign' });

// Note: Zod v4 infers params.event as optional at type level; validated at runtime
assert<RaiseAction>({ type: 'xstate.raise', params: {} as any });

// Note: Zod v4 infers params.event as optional at type level; validated at runtime
assert<SendToAction>({ type: 'xstate.sendTo', params: { actorRef: 'a' } as any });

// @ts-expect-error — assign type must be literal 'xstate.assign'
assert<AssignAction>({ type: 'other', params: { x: 1 } });

// @ts-expect-error — raise type must be literal 'xstate.raise'
assert<RaiseAction>({ type: 'other', params: { event: 'E' } });

// @ts-expect-error — sendTo type must be literal 'xstate.sendTo'
assert<SendToAction>({ type: 'other', params: { actorRef: 'a', event: 'E' } });

// @ts-expect-error — log type must be literal 'xstate.log'
assert<LogAction>({ type: 'other' });

// @ts-expect-error — emit type must be literal 'xstate.emit'
assert<EmitAction>({ type: 'other', params: { event: 'E' } });

// Action union accepts all
assert<Action>({ type: 'xstate.assign', params: { x: 1 } });
assert<Action>({ type: 'xstate.raise', params: { event: 'E' } });
assert<Action>({ type: 'xstate.log' });
assert<Action>({ type: 'xstate.emit', params: { event: { type: 'X' } } });
assert<Action>({ type: 'custom' });

// ============================================================
// Guards — well-typed
// ============================================================

assert<Guard>('{{ context.ready }}');
assert<Guard>({ type: 'isReady' });
assert<Guard>({ type: 'isReady', params: { threshold: 5 } });
assert<NamedGuard>({ type: 'isReady' });

// @ts-expect-error — named guard requires type
assert<NamedGuard>({ params: { x: 1 } });

// Note: Guard accepts any string at type level — regex {{ }} is
// enforced at runtime by Zod, not in the TS type.
assert<Guard>('notAnExpression'); // compiles, but fails Zod parse

// ============================================================
// Invoke — well-typed
// ============================================================

assert<Invoke>({ src: 'fetchUser' });
assert<Invoke>({
  id: 'fetcher',
  src: 'fetchUser',
  input: '{{ context.userId }}',
  onDone: { target: 'success' },
  onError: { target: 'failure' },
  onSnapshot: { target: 'updating' },
  timeout: 'PT30S',
  heartbeat: 'PT5S',
  retry: { maxAttempts: 3, interval: 1000, backoff: 2 },
});

// @ts-expect-error — invoke requires src
assert<Invoke>({ id: 'fetcher' });

// @ts-expect-error — src must be string
assert<Invoke>({ src: 123 });

// @ts-expect-error — timeout must be string
assert<Invoke>({ src: 'foo', timeout: 30 });

// ============================================================
// Retry
// ============================================================

assert<Retry>({ maxAttempts: 3 });
assert<Retry>({ maxAttempts: 5, interval: 1000, backoff: 2 });
assert<Retry>({ maxAttempts: 5, interval: 'PT5S' });

// @ts-expect-error — maxAttempts required
assert<Retry>({ interval: 1000 });

// ============================================================
// Schemas
// ============================================================

assert<Schemas>({
  context: { count: { type: 'number' } },
  events: { INCREMENT: { amount: { type: 'number' } } },
});
assert<Schemas>(undefined);
