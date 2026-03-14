import jsonata from 'jsonata';
import {
  toXStateConfig,
  toXStateMachine,
  type ExpressionEvaluator,
} from './toXState';
import type { StateMachine } from './machineSchema';

export const createJsonataEvaluator = (): ExpressionEvaluator => {
  return (expression, data) => {
    return jsonata(expression).evaluate(data);
  };
};

export function jsonataToXStateConfig(spec: StateMachine) {
  return toXStateConfig(spec, createJsonataEvaluator());
}

export function jsonataToXStateMachine(spec: StateMachine) {
  return toXStateMachine(spec, createJsonataEvaluator());
}
