import { writeFileSync } from 'fs';
import { join } from 'path';
import z from 'zod';
import {
  actionSchema,
  guardSchema,
  invokeSchema,
  machineSchema,
  stateSchema,
  transitionSchema,
} from './index.js';

z.globalRegistry.add(invokeSchema, {
  id: 'Invoke',
});

z.globalRegistry.add(actionSchema, {
  id: 'Action',
});

z.globalRegistry.add(guardSchema, {
  id: 'Guard',
});

z.globalRegistry.add(transitionSchema, {
  id: 'Transition',
});

z.globalRegistry.add(stateSchema, {
  id: 'State',
});

// Generate JSON schema from the Zod schema
const jsonSchema = z.toJSONSchema(machineSchema);

// Write the JSON schema to a file
const outputPath = join(process.cwd(), 'machineSchema.json');
writeFileSync(outputPath, JSON.stringify(jsonSchema, null, 2));

console.log(`✅ JSON schema generated successfully at: ${outputPath}`);
