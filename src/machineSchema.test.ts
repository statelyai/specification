import { test, describe } from 'node:test';
import assert from 'node:assert';
import { machineSchema } from './machineSchema';

describe('machineSchema', () => {
  test('machineSchema is defined', () => {
    assert.ok(machineSchema);
  });

  test('trivial machine', () => {
    machineSchema.parse({});
  });

  test('all machine properties', () => {
    machineSchema.parse({
      id: 'test',
      description: 'test',
      version: 'test',
      initial: 'test',
      states: {
        test: {},
      },
    });
  });

  test('omni machine', () => {
    machineSchema.parse({
      id: 'test',
      description: 'test',
      version: 'test',
      initial: 'test',
      states: {
        test: {
          initial: 'one',
          states: {
            one: {
              type: 'final',
            },
            two: {
              type: 'final',
            },
            three: {
              type: 'final',
            },
            h: {
              type: 'history',
              target: 'two',
              history: 'shallow',
            },
          },
        },
      },
    });
  });

  test('invalid machine', () => {
    assert.throws(() =>
      machineSchema.parse({
        id: 3,
      })
    );
  });
});
