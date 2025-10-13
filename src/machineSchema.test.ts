import { expect, test } from 'vitest';
import { machineSchema } from './machineSchema';

test('machineSchema', () => {
  expect(machineSchema).toBeDefined();
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
  expect(() =>
    machineSchema.parse({
      id: 3,
    })
  ).toThrowErrorMatchingInlineSnapshot(`
    [ZodError: [
      {
        "expected": "string",
        "code": "invalid_type",
        "path": [
          "id"
        ],
        "message": "Invalid input: expected string, received number"
      }
    ]]
  `);
});
