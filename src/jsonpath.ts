import { JSONPath } from 'jsonpath-plus';
import {
  toXStateConfig,
  toXStateMachine,
  type ExpressionEvaluator,
} from './toXState';
import type { StateMachine } from './machineSchema';

export const createJsonpathEvaluator = (): ExpressionEvaluator => {
  return (expression, data) => {
    const result = JSONPath({ path: expression, json: data, wrap: false });
    return result;
  };
};

export function jsonpathToXStateConfig(spec: StateMachine) {
  return toXStateConfig(spec, createJsonpathEvaluator());
}

export function jsonpathToXStateMachine(spec: StateMachine) {
  return toXStateMachine(spec, createJsonpathEvaluator());
}
