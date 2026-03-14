import {
  createMachine,
  assign,
  raise,
  sendTo,
  log as xstateLog,
  emit as xstateEmit,
} from 'xstate';
import type { StateMachine } from './machineSchema';

/**
 * Evaluates an expression string against a data context.
 * Implementations exist per query language (jsonata, jmespath, jsonpath).
 */
export type ExpressionEvaluator = (
  expression: string,
  data: { context: any; event: any }
) => any;

const EXPR_RE = /^\{\{[\s\S]*\}\}$/;

export function isExpression(value: unknown): value is string {
  return typeof value === 'string' && EXPR_RE.test(value);
}

export function stripDelimiters(expr: string): string {
  return expr.slice(2, -2).trim();
}

/**
 * Parses an ISO 8601 duration string (e.g. PT30S, PT1M, PT1H30M5S) to milliseconds.
 * Falls through to the raw value if not a valid ISO duration.
 */
export function parseISO8601Duration(value: string): number | string {
  const match = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  );
  if (!match) return value; // not ISO — pass through (could be ms string)
  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const seconds = parseFloat(match[4] || '0');
  return (
    days * 86400000 + hours * 3600000 + minutes * 60000 + seconds * 1000
  );
}

function convertAction(action: any, evaluate: ExpressionEvaluator): any {
  switch (action.type) {
    case 'xstate.assign': {
      const assignments: Record<string, any> = {};
      for (const [key, value] of Object.entries(
        action.params as Record<string, any>
      )) {
        if (isExpression(value)) {
          const expr = stripDelimiters(value);
          assignments[key] = ({ context, event }: any) =>
            evaluate(expr, { context, event });
        } else {
          // Static value — wrap in function for xstate v5
          const v = value;
          assignments[key] = () => v;
        }
      }
      return assign(assignments);
    }
    case 'xstate.raise': {
      const evt = action.params.event;
      if (isExpression(evt)) {
        const expr = stripDelimiters(evt);
        return raise(({ context, event }: any) =>
          evaluate(expr, { context, event })
        );
      }
      return raise(evt);
    }
    case 'xstate.sendTo': {
      const { actorRef, event: evt, delay } = action.params;
      const actorArg = isExpression(actorRef)
        ? ({ context, event }: any) =>
            evaluate(stripDelimiters(actorRef), { context, event })
        : actorRef;
      const eventArg = isExpression(evt)
        ? ({ context, event }: any) =>
            evaluate(stripDelimiters(evt), { context, event })
        : evt;
      const opts: any = {};
      if (delay != null) {
        opts.delay = isExpression(delay)
          ? ({ context, event }: any) =>
              evaluate(stripDelimiters(delay as string), { context, event })
          : delay;
      }
      return sendTo(
        actorArg,
        eventArg,
        Object.keys(opts).length ? opts : undefined
      );
    }
    case 'xstate.log': {
      if (action.params?.message != null) {
        const msg = action.params.message;
        if (isExpression(msg)) {
          const expr = stripDelimiters(msg);
          return xstateLog(({ context, event }: any) =>
            evaluate(expr, { context, event })
          );
        }
        return xstateLog(msg);
      }
      return xstateLog();
    }
    case 'xstate.emit': {
      const evt = action.params.event;
      if (isExpression(evt)) {
        const expr = stripDelimiters(evt);
        return xstateEmit(({ context, event }: any) =>
          evaluate(expr, { context, event })
        );
      }
      return xstateEmit(evt);
    }
    default:
      // Custom action — pass through as-is (requires setup() to resolve)
      return { type: action.type, params: action.params };
  }
}

function convertGuard(guard: any, evaluate: ExpressionEvaluator): any {
  if (isExpression(guard)) {
    const expr = stripDelimiters(guard);
    return ({ context, event }: any) =>
      Boolean(evaluate(expr, { context, event }));
  }
  // Named guard
  return { type: guard.type, params: guard.params };
}

function convertTransition(t: any, evaluate: ExpressionEvaluator): any {
  const result: any = {};
  if (t.target != null) result.target = t.target;
  if (t.description) result.description = t.description;
  if (t.guard) result.guard = convertGuard(t.guard, evaluate);

  // Collect explicit actions
  const actions: any[] = t.actions?.length
    ? t.actions.map((a: any) => convertAction(a, evaluate))
    : [];

  // Append implicit assign from transition `context`
  if (t.context) {
    actions.push(
      convertAction({ type: 'xstate.assign', params: t.context }, evaluate)
    );
  }

  if (actions.length) result.actions = actions;
  if (t.meta) result.meta = t.meta;
  return result;
}

function convertTransitions(trans: any, evaluate: ExpressionEvaluator): any {
  if (trans == null) return undefined;
  if (Array.isArray(trans))
    return trans.map((t: any) => convertTransition(t, evaluate));
  return convertTransition(trans, evaluate);
}

function convertState(state: any, evaluate: ExpressionEvaluator): any {
  const result: any = {};
  if (state.id) result.id = state.id;
  if (state.description) result.description = state.description;
  if (state.type) result.type = state.type;
  if (state.history) result.history = state.history;
  if (state.target) result.target = state.target;
  if (state.initial) result.initial = state.initial;
  if (state.tags) result.tags = state.tags;

  if (state.entry?.length) {
    result.entry = state.entry.map((a: any) => convertAction(a, evaluate));
  }
  if (state.exit?.length) {
    result.exit = state.exit.map((a: any) => convertAction(a, evaluate));
  }

  if (state.on) {
    result.on = {} as Record<string, any>;
    for (const [event, trans] of Object.entries(state.on)) {
      result.on[event] = convertTransitions(trans, evaluate);
    }
  }

  if (state.after) {
    result.after = {} as Record<string, any>;
    for (const [delay, trans] of Object.entries(state.after)) {
      // Convert ISO 8601 durations to ms
      const key = parseISO8601Duration(delay);
      result.after[key] = convertTransitions(trans, evaluate);
    }
  }

  if (state.always) {
    result.always = convertTransitions(state.always, evaluate);
  }

  if (state.invoke) {
    result.invoke = state.invoke.map((inv: any) => {
      const r: any = { src: inv.src };
      if (inv.id) r.id = inv.id;
      if (inv.input != null) {
        if (isExpression(inv.input)) {
          const expr = stripDelimiters(inv.input);
          r.input = ({ context, event }: any) =>
            evaluate(expr, { context, event });
        } else {
          r.input = inv.input;
        }
      }
      if (inv.onDone) r.onDone = convertTransitions(inv.onDone, evaluate);
      if (inv.onError) r.onError = convertTransitions(inv.onError, evaluate);
      if (inv.onSnapshot)
        r.onSnapshot = convertTransitions(inv.onSnapshot, evaluate);
      // Pass retry config through as metadata
      if (inv.retry) {
        r.meta = { ...r.meta, retry: inv.retry };
      }
      return r;
    });
  }

  if (state.output !== undefined) {
    if (isExpression(state.output)) {
      const expr = stripDelimiters(state.output);
      result.output = ({ context, event }: any) =>
        evaluate(expr, { context, event });
    } else {
      result.output = state.output;
    }
  }

  if (state.meta) result.meta = state.meta;

  if (state.states) {
    result.states = {} as Record<string, any>;
    for (const [key, child] of Object.entries(state.states)) {
      result.states[key] = convertState(child, evaluate);
    }
  }

  return result;
}

/**
 * Converts a Stately spec machine to an xstate-compatible config object.
 * Can be passed to `createMachine()` or `setup().createMachine()`.
 */
export function toXStateConfig(
  spec: StateMachine,
  evaluate: ExpressionEvaluator
) {
  const config = convertState(spec, evaluate);
  if (spec.context) config.context = spec.context;
  if (spec.version) config.version = spec.version;
  return config;
}

/**
 * Converts a Stately spec machine to a live xstate machine via `createMachine()`.
 */
export function toXStateMachine(
  spec: StateMachine,
  evaluate: ExpressionEvaluator
) {
  return createMachine(toXStateConfig(spec, evaluate));
}
