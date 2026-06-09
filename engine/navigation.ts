import type { Node } from '../shared/types.js';

export interface PathResult {
  destinations: string[];
  decisionPoints: string[];
}

export function findPaths(
  board: Record<string, Node>,
  startNodeId: string,
  diceRoll: number
): PathResult {
  const destinations = new Set<string>();
  const decisionPoints = new Set<string>();
  const visited = new Set<string>();

  // BFS state: [nodeId, stepsRemaining, prevNodeId]
  const queue: Array<[string, number, string | null]> = [[startNodeId, diceRoll, null]];

  while (queue.length > 0) {
    const [nodeId, stepsLeft, prevNodeId] = queue.shift()!;

    const stateKey = `${nodeId}:${stepsLeft}:${prevNodeId ?? ''}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    if (stepsLeft === 0) {
      destinations.add(nodeId);
      continue;
    }

    const node = board[nodeId];
    if (!node) continue;

    // Mid-move node (at least 1 step taken) with a choice = decision point.
    // We check if we have more than 1 valid neighbor (excluding the node we just came from).
    const validNeighbors = node.neighbors.filter(neighborId => neighborId !== prevNodeId);

    if (stepsLeft < diceRoll && validNeighbors.length > 1) {
      decisionPoints.add(nodeId);
    }

    for (const neighborId of node.neighbors) {
      // Prevent immediate backtracking
      if (neighborId === prevNodeId) continue;

      const newStepsLeft = stepsLeft - 1;
      const neighbor = board[neighborId];

      if (neighbor && neighbor.type === 'warp' && neighbor.pairedNodeId) {
        // Step onto warp, immediately teleport to paired node; step was consumed
        queue.push([neighbor.pairedNodeId, newStepsLeft, nodeId]);
      } else {
        queue.push([neighborId, newStepsLeft, nodeId]);
      }
    }
  }

  return {
    destinations: Array.from(destinations),
    decisionPoints: Array.from(decisionPoints),
  };
}

export function getPath(
  board: Record<string, Node>,
  from: string,
  to: string,
  roll?: number
): string[] {
  if (from === to) return [from];

  if (roll !== undefined && roll > 0) {
    // Find a path of exactly 'roll' steps without immediate backtracking
    const queue: Array<{ nodeId: string; path: string[]; steps: number }> = [
      { nodeId: from, path: [from], steps: 0 }
    ];

    while (queue.length > 0) {
      const { nodeId, path, steps } = queue.shift()!;

      if (steps === roll) {
        if (nodeId === to) return path;
        continue;
      }

      const node = board[nodeId];
      if (!node) continue;

      for (const neighborId of node.neighbors) {
        // Prevent immediate backtracking
        if (path.length > 1 && neighborId === path[path.length - 2]) {
          continue;
        }

        const neighbor = board[neighborId];
        if (neighbor && neighbor.type === 'warp' && neighbor.pairedNodeId) {
          queue.push({
            nodeId: neighbor.pairedNodeId,
            path: [...path, neighborId, neighbor.pairedNodeId],
            steps: steps + 1,
          });
        } else {
          queue.push({
            nodeId: neighborId,
            path: [...path, neighborId],
            steps: steps + 1,
          });
        }
      }
    }
  }

  // Fallback to standard shortest-path BFS if no path of length 'roll' was found
  const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: from, path: [from] }];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;
    const node = board[nodeId];
    if (!node) continue;

    for (const neighborId of node.neighbors) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);

      const newPath = [...path, neighborId];
      if (neighborId === to) return newPath;

      const neighbor = board[neighborId];
      if (neighbor && neighbor.type === 'warp' && neighbor.pairedNodeId && !visited.has(neighbor.pairedNodeId)) {
        visited.add(neighbor.pairedNodeId);
        const warpPath = [...newPath, neighbor.pairedNodeId];
        if (neighbor.pairedNodeId === to) return warpPath;
        queue.push({ nodeId: neighbor.pairedNodeId, path: warpPath });
      } else {
        queue.push({ nodeId: neighborId, path: newPath });
      }
    }
  }

  return [from, to];
}
