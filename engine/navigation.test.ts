import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPaths, getPath } from './navigation.js';
import type { Node } from '../shared/types.js';

function node(id: string, neighbors: string[], type: Node['type'] = 'property', pairedNodeId?: string): Node {
  return { id, type, neighbors, coordinates: { x: 0, y: 0 }, pairedNodeId };
}

test('straight path — single destination, no decision points', () => {
  const board: Record<string, Node> = {
    A: node('A', ['B'], 'bank'),
    B: node('B', ['C']),
    C: node('C', ['D']),
    D: node('D', []),
  };

  const result = findPaths(board, 'A', 2);

  assert.deepEqual(result.destinations.sort(), ['C']);
  assert.deepEqual(result.decisionPoints, []);
});

test('branch mid-path — multiple destinations, decision point identified', () => {
  const board: Record<string, Node> = {
    A: node('A', ['B'], 'bank'),
    B: node('B', ['C', 'D'], 'vacant'),
    C: node('C', []),
    D: node('D', []),
  };

  const result = findPaths(board, 'A', 2);

  assert.deepEqual(result.destinations.sort(), ['C', 'D']);
  assert.deepEqual(result.decisionPoints, ['B']);
});

test('warp node — player teleports and continues stepping correctly', () => {
  // A -> W(warp→X) -> X -> Y -> Z
  // Roll 3: A(3) → step to W, warp to X(2) → step to Y(1) → step to Z(0)
  const board: Record<string, Node> = {
    A: node('A', ['W'], 'bank'),
    W: node('W', ['C'], 'warp', 'X'),  // neighbors unused; pairedNodeId drives teleport
    X: node('X', ['Y']),
    Y: node('Y', ['Z']),
    Z: node('Z', []),
  };

  const result = findPaths(board, 'A', 3);

  assert.deepEqual(result.destinations, ['Z']);
  assert.deepEqual(result.decisionPoints, []);
});

test('roll of 0 — starting node is the only destination', () => {
  const board: Record<string, Node> = {
    A: node('A', ['B', 'C'], 'bank'),
    B: node('B', []),
    C: node('C', []),
  };

  const result = findPaths(board, 'A', 0);

  assert.deepEqual(result.destinations, ['A']);
  assert.deepEqual(result.decisionPoints, []);
});

test('bidirectional path and backtrack prevention', () => {
  // A <-> B <-> C
  // Start B, roll 1: should reach A and C
  // Start A, roll 2: A -> B -> C (cannot go A -> B -> A), so destination is C
  const board: Record<string, Node> = {
    A: node('A', ['B']),
    B: node('B', ['A', 'C']),
    C: node('C', ['B']),
  };

  const result1 = findPaths(board, 'B', 1);
  assert.deepEqual(result1.destinations.sort(), ['A', 'C']);

  const result2 = findPaths(board, 'A', 2);
  assert.deepEqual(result2.destinations, ['C']);
});

test('exact roll path matching in getPath', () => {
  // Shortcut: B <-> F.
  // Shortest path B to F is B -> F (1 step).
  // But if we rolled 5, the path is B -> C -> D -> E -> F (5 steps).
  const board: Record<string, Node> = {
    A: node('A', ['B']),
    B: node('B', ['A', 'C', 'F']),
    C: node('C', ['B', 'D']),
    D: node('D', ['C', 'E']),
    E: node('E', ['D', 'F']),
    F: node('F', ['E', 'B']),
  };

  const path = getPath(board, 'B', 'F', 4);
  assert.deepEqual(path, ['B', 'C', 'D', 'E', 'F']);
});

