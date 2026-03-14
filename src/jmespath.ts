import jmespath from 'jmespath';
import {
  toXStateConfig,
  toXStateMachine,
  type ExpressionEvaluator,
} from './toXState';
import type { StateMachine } from './machineSchema';

export const createJmespathEvaluator = (): ExpressionEvaluator => {
  return (expression, data) => {
    return jmespath.search(data, expression);
  };
};

export function jmespathToXStateConfig(spec: StateMachine) {
  return toXStateConfig(spec, createJmespathEvaluator());
}

export function jmespathToXStateMachine(spec: StateMachine) {
  return toXStateMachine(spec, createJmespathEvaluator());
}
