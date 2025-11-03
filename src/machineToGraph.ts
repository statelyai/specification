import { Graph, Node, Edge } from './graphSchema';
import { StateMachine } from './machineSchema';

function normalizeTransitions(
  transitions: any
): Array<{ target?: string; description?: string; meta?: any }> {
  if (!transitions) return [];
  if (Array.isArray(transitions)) return transitions;
  return [transitions];
}

export function machineToGraph(machine: StateMachine): Graph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function traverseState(
    stateKey: string | undefined,
    state: any,
    parentId?: string
  ) {
    if (!stateKey) return;

    const nodeId = parentId ? `${parentId}.${stateKey}` : stateKey;

    // Add node
    nodes.push({
      id: nodeId,
      parentId,
      description: state.description,
      meta: state.meta,
    });

    // Handle initial transition
    if (state.initial) {
      const initialTarget = parentId
        ? `${nodeId}.${state.initial}`
        : state.initial;
      edges.push({
        name: '',
        sourceId: nodeId,
        targetId: initialTarget,
        description: 'Initial transition',
      });
    }

    // Handle event transitions (on)
    if (state.on) {
      for (const [event, transitionObject] of Object.entries(state.on)) {
        const transitions = normalizeTransitions(transitionObject);
        for (const t of transitions) {
          if (t.target) {
            edges.push({
              name: event,
              sourceId: nodeId,
              targetId: t.target,
              description: `On ${event}`,
              meta: t.meta,
            });
          }
        }
      }
    }

    // Handle delayed transitions (after)
    if (state.after) {
      for (const [delay, trans] of Object.entries(state.after)) {
        const transitions = normalizeTransitions(trans);
        for (const t of transitions) {
          if (t.target) {
            edges.push({
              name: `after.${delay}`,
              sourceId: nodeId,
              targetId: t.target,
              description: `After ${delay}`,
              meta: t.meta,
            });
          }
        }
      }
    }

    // Handle always transitions
    if (state.always) {
      const transitions = normalizeTransitions(state.always);
      for (const t of transitions) {
        if (t.target) {
          edges.push({
            name: 'always',
            sourceId: nodeId,
            targetId: t.target,
            description: 'Always',
            meta: t.meta,
          });
        }
      }
    }

    // Handle invoke transitions
    if (state.invoke) {
      for (const inv of state.invoke) {
        if (inv.onDone) {
          const transitions = normalizeTransitions(inv.onDone);
          for (const t of transitions) {
            if (t.target) {
              edges.push({
                name: `${inv.src}.onDone`,
                sourceId: nodeId,
                targetId: t.target,
                description: `onDone: ${inv.src}`,
                meta: t.meta,
              });
            }
          }
        }
        if (inv.onError) {
          const transitions = normalizeTransitions(inv.onError);
          for (const t of transitions) {
            if (t.target) {
              edges.push({
                name: `${inv.src}.onError`,
                sourceId: nodeId,
                targetId: t.target,
                description: `onError: ${inv.src}`,
                meta: t.meta,
              });
            }
          }
        }
      }
    }

    // Recursively traverse child states
    if (state.states) {
      for (const [childKey, childState] of Object.entries(state.states)) {
        traverseState(childKey, childState, nodeId);
      }
    }
  }

  // Traverse all root states
  if (machine.states) {
    for (const [stateKey, state] of Object.entries(machine.states)) {
      traverseState(stateKey, state, machine.id);
    }
  }

  // Handle root machine (after states so it appears first in the list)
  if (machine.id) {
    nodes.unshift({
      id: machine.id,
      description: machine.description,
      meta: machine.meta,
    });

    if (machine.initial) {
      edges.push({
        name: '',
        sourceId: machine.id,
        targetId: machine.id
          ? `${machine.id}.${machine.initial}`
          : machine.initial,
        description: 'Initial transition',
      });
    }
  }

  return {
    description: machine.description,
    nodes,
    edges,
  };
}
