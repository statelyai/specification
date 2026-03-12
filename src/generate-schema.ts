import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import z from 'zod';
import {
  actionSchema,
  guardSchema,
  invokeSchema,
  machineSchema,
  metaSchema,
  stateSchema,
  transitionSchema,
} from './machineSchema';
import {
  edgeSchema,
  graphSchema,
  metaSchema as graphMetaSchema,
  nodeSchema,
} from './graphSchema';

// Register machine schema types
z.globalRegistry.add(invokeSchema, { id: 'Invoke' });
z.globalRegistry.add(actionSchema, { id: 'Action' });
z.globalRegistry.add(guardSchema, { id: 'Guard' });
z.globalRegistry.add(transitionSchema, { id: 'Transition' });
z.globalRegistry.add(stateSchema, { id: 'State' });
z.globalRegistry.add(metaSchema, { id: 'Meta' });

// Register graph schema types
z.globalRegistry.add(nodeSchema, { id: 'Node' });
z.globalRegistry.add(edgeSchema, { id: 'Edge' });
z.globalRegistry.add(graphMetaSchema, { id: 'GraphMeta' });

// Generate JSON schemas
const machineJsonSchema = z.toJSONSchema(machineSchema);
const graphJsonSchema = z.toJSONSchema(graphSchema);

// Ensure schemas/ directory exists
const schemasDir = join(process.cwd(), 'schemas');
mkdirSync(schemasDir, { recursive: true });

// Write schemas
const machineOutputPath = join(schemasDir, 'machine.json');
writeFileSync(machineOutputPath, JSON.stringify(machineJsonSchema, null, 2));
console.log(`Machine schema: ${machineOutputPath}`);

const graphOutputPath = join(schemasDir, 'graph.json');
writeFileSync(graphOutputPath, JSON.stringify(graphJsonSchema, null, 2));
console.log(`Graph schema: ${graphOutputPath}`);
