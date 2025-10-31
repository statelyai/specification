import { test, describe } from 'node:test';
import assert from 'node:assert';
import { machineSchema } from './machineSchema';
import z from 'zod';

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
        atomic: {
          after: {
            1000: {
              target: 'compound',
              actions: [
                {
                  type: 'log',
                  params: {
                    message: 'Hello, world!',
                  },
                },
              ],
            },
          },
        },
      },
    } satisfies z.infer<typeof machineSchema>);
  });

  test('invalid machine', () => {
    assert.throws(() =>
      machineSchema.parse({
        id: 3,
      })
    );
  });
});
