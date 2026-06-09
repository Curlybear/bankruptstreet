import { useEffect, useRef } from 'react';
import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
} from 'pixi.js';
import type { Socket } from 'socket.io-client';
import type { GameState } from '../shared/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TILE     = 82; // Balanced spacing for 11x5 Alefgard grid
const PAD      = 60;
const TILE_W   = 68;
const TILE_H   = 68;
const TOKEN_R  = 9;

const SUIT_ICON: Record<string, string> = {
  heart: '♥', diamond: '♦', spade: '♠', club: '♣',
};

const DISTRICT_COLOR: Record<string, number> = {
  tantegel: 0x3b82f6, // Neon royal blue
  garinham: 0x10b981, // Premium forest green
  kol:      0x06b6d4, // Bright cyan/teal
  domdora:  0xf59e0b, // Warm amber orange
  cantlin:  0xef4444, // Vibrant crimson red
  rimuldar: 0x8b5cf6, // Intense violet purple
  charlock: 0xec4899, // Cyberpunk magenta / Indigo purple
  bridges:  0x64748b, // Cool steel gray
};

const PLAYER_COLOR = [0xff4e50, 0x00f2fe, 0xa855f7, 0xfacc15]; // Premium neon colors

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenInfo {
  container: Container;
  color: number;
  offset: number;
  nodeId: string;
}

interface PixiRefs {
  app: Application;
  camera: Container;
  nodePos: Map<string, { px: number; py: number }>;
  tokens: Map<string, TokenInfo>;
  highlightContainer?: Container;
  highlightTickerFn?: (ticker: { deltaMS: number }) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPixel(cx: number, cy: number) {
  return { px: PAD + cx * TILE, py: PAD + cy * TILE };
}

function sleep(ms: number) {
  return new Promise<void>(res => setTimeout(res, ms));
}

function safeDestroyApp(app: Application) {
  try { app.destroy(true); } catch (_) { /* PixiJS 8 ResizePlugin bug */ }
}

function fadeTo(target: Container, goal: number, ms: number): Promise<void> {
  return new Promise(resolve => {
    const start   = performance.now();
    const initial = target.alpha;
    (function frame() {
      const t = Math.min((performance.now() - start) / ms, 1);
      target.alpha = initial + (goal - initial) * t;
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    })();
  });
}

// ─── Visual Backdrop ─────────────────────────────────────────────────────────

function drawBackground(camera: Container) {
  const bg = new Graphics();
  // Large background sheet to support panning space
  bg.rect(-500, -500, 3000, 1500);
  bg.fill({ color: 0x0b0b14 }); // Deep matte dark space

  // Glowing colorful nebulae (high blur aura simulations)
  bg.circle(400, 160, 220).fill({ color: 0x7c3aed, alpha: 0.08 }); // Royal violet aura
  bg.circle(850, 200, 180).fill({ color: 0x0ea5e9, alpha: 0.06 }); // Cyan aura
  bg.circle(100, 100, 160).fill({ color: 0xec4899, alpha: 0.04 }); // Rose aura

  // Starfield drawing using seeded random for stable positions
  let seed = 99;
  function random() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  for (let i = 0; i < 180; i++) {
    const sx = -200 + random() * 2200;
    const sy = -200 + random() * 1000;
    const size = random() * 1.5 + 0.4;
    const alpha = random() * 0.5 + 0.3;
    const color = random() > 0.8 ? 0xaabeff : 0xffffff; // subtle cool blue stars
    bg.circle(sx, sy, size).fill({ color, alpha });
  }

  camera.addChild(bg);
}

// ─── Rendering Methods ────────────────────────────────────────────────────────

function drawEdges(state: GameState, camera: Container, nodePos: Map<string, { px: number; py: number }>) {
  const glow = new Graphics();
  const border = new Graphics();
  const core = new Graphics();

  for (const [id, node] of Object.entries(state.board)) {
    const from = nodePos.get(id)!;
    for (const nid of node.neighbors) {
      const to = nodePos.get(nid);
      if (!to) continue;

      glow.moveTo(from.px, from.py).lineTo(to.px, to.py);
      border.moveTo(from.px, from.py).lineTo(to.px, to.py);
      core.moveTo(from.px, from.py).lineTo(to.px, to.py);
    }
  }

  glow.stroke({ color: 0x00f2fe, width: 10, alpha: 0.35 }); // Wide neon cyber-cyan shadow glow
  border.stroke({ color: 0x0891b2, width: 4.5, alpha: 0.9 }); // Strong teal outline pathway rail
  core.stroke({ color: 0xe0f7fa, width: 2, alpha: 1.0 }); // High-intensity bright white-cyan center track

  camera.addChild(glow);
  camera.addChild(border);
  camera.addChild(core);
}

function drawNodes(state: GameState, camera: Container, nodePos: Map<string, { px: number; py: number }>) {
  for (const [id, node] of Object.entries(state.board)) {
    const { px, py } = nodePos.get(id)!;
    const g = new Graphics();

    if (node.type === 'property') {
      const prop = Object.values(state.properties).find(p => p.nodeId === node.id);
      const isOwned = prop && prop.ownerId !== null;
      const ownerColor = isOwned
        ? PLAYER_COLOR[state.turnOrder.indexOf(prop!.ownerId!) % PLAYER_COLOR.length]
        : 0x22223a;

      const tx = px - TILE_W / 2;
      const ty = py - TILE_H / 2;

      // Sleek rounded glassmorphic tile background
      g.roundRect(tx, ty, TILE_W, TILE_H, 10);
      g.fill({ color: 0x0c0c1b }); // High contrast dark backfill

      // Glowing ownership border / clean border
      g.roundRect(tx, ty, TILE_W, TILE_H, 10);
      g.stroke({
        color: isOwned ? ownerColor : 0x475569, // Highly visible unowned outline
        width: isOwned ? 2.5 : 1.5,
        alpha: isOwned ? 0.95 : 0.75,
      });

      // District header banner at the top (15px tall)
      const distColor = prop ? (DISTRICT_COLOR[prop.districtId] ?? 0xa855f7) : 0x2c2c4d;
      g.roundRect(tx + 1, ty + 1, TILE_W - 2, 14, 8);
      g.fill({ color: distColor });
      // Overlay rect to flatten bottom rounded corners of top banner
      g.rect(tx + 1, ty + 8, TILE_W - 2, 7);
      g.fill({ color: distColor });

      camera.addChild(g);

      // Render Shop ID in high contrast bold inside top banner
      const idText = new Text({
        text: id.toUpperCase(),
        style: new TextStyle({
          fontSize: 8.5,
          fill: 0x000000,
          fontFamily: 'Outfit',
          fontWeight: '900',
          letterSpacing: 0.5,
        }),
      });
      idText.anchor.set(0.5, 0.5);
      idText.position.set(px, ty + 8);
      camera.addChild(idText);

      if (prop) {
        // Price values displayed elegantly in the middle
        const priceVal = new Text({
          text: `${prop.currentPrice}G`,
          style: new TextStyle({
            fontSize: 10.5,
            fill: 0xe2e8f0,
            fontFamily: 'JetBrains Mono',
            fontWeight: 'bold',
          }),
        });
        priceVal.anchor.set(0.5, 0.5);
        priceVal.position.set(px, py + 3);
        camera.addChild(priceVal);

        // Rent value displayed clearly at the bottom
        const rentVal = new Text({
          text: `R: ${prop.currentRent}`,
          style: new TextStyle({
            fontSize: 8.5,
            fill: isOwned ? ownerColor : 0x94a3b8,
            fontFamily: 'JetBrains Mono',
            fontWeight: '700',
          }),
        });
        rentVal.anchor.set(0.5, 0.5);
        rentVal.position.set(px, ty + TILE_H - 12);
        camera.addChild(rentVal);

        // Small stylish ownership flag on top right corner
        if (isOwned) {
          const flag = new Graphics();
          flag.poly([tx + TILE_W - 14, ty + 15, tx + TILE_W - 2, ty + 15, tx + TILE_W - 2, ty + 27]);
          flag.fill({ color: ownerColor });
          camera.addChild(flag);
        }
      }
    } else if (node.type === 'bank') {
      const r = 35;
      // Diamond base polygon
      g.poly([px, py - r, px + r, py, px, py + r, px - r, py]);
      g.fill({ color: 0xeab308 }); // Rich Amber Gold
      g.poly([px, py - r, px + r, py, px, py + r, px - r, py]);
      g.stroke({ color: 0xffffff, width: 2, alpha: 0.75 });
      camera.addChild(g);

      // Icon Bank
      const bankIcon = new Text({
        text: '🏦',
        style: new TextStyle({ fontSize: 20 }),
      });
      bankIcon.anchor.set(0.5, 0.5);
      bankIcon.position.set(px, py - 6);
      camera.addChild(bankIcon);

      const bankLabel = new Text({
        text: 'BANK',
        style: new TextStyle({ fontSize: 9, fill: 0x000000, fontFamily: 'Outfit', fontWeight: '900', letterSpacing: 0.5 }),
      });
      bankLabel.anchor.set(0.5, 0.5);
      bankLabel.position.set(px, py + 14);
      camera.addChild(bankLabel);
    } else if (node.type === 'stockbroker') {
      const w = 62;
      g.roundRect(px - w/2, py - w/2, w, w, 12);
      g.fill({ color: 0x0284c7 }); // Sky blue Stockbroker
      g.roundRect(px - w/2, py - w/2, w, w, 12);
      g.stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
      camera.addChild(g);

      const brokerIcon = new Text({
        text: '📈',
        style: new TextStyle({ fontSize: 18 }),
      });
      brokerIcon.anchor.set(0.5, 0.5);
      brokerIcon.position.set(px, py - 6);
      camera.addChild(brokerIcon);

      const brokerLabel = new Text({
        text: 'BROKER',
        style: new TextStyle({ fontSize: 8.5, fill: 0xffffff, fontFamily: 'Outfit', fontWeight: '900', letterSpacing: 0.5 }),
      });
      brokerLabel.anchor.set(0.5, 0.5);
      brokerLabel.position.set(px, py + 14);
      camera.addChild(brokerLabel);
    } else if (node.type === 'suit') {
      const isRed = node.suit === 'heart' || node.suit === 'diamond';
      const glowColor = isRed ? 0xf87171 : 0x06b6d4; // Vibrant neon red or cyan/blue
      g.circle(px, py, 26).fill({ color: isRed ? 0x2e1010 : 0x082f49 }); // Custom deep suit backfill
      g.circle(px, py, 26).stroke({ color: glowColor, width: 2.5, alpha: 0.95 });
      camera.addChild(g);

      const suitColor = node.suit === 'heart' || node.suit === 'diamond' ? 0xef4444 : 0x3b82f6; // High contrast red/blue
      const icon = new Text({
        text: SUIT_ICON[node.suit!] ?? '',
        style: new TextStyle({ fontSize: 26, fill: suitColor, fontFamily: 'serif', fontWeight: 'bold' }),
      });
      icon.anchor.set(0.5, 0.5);
      icon.position.set(px, py);
      camera.addChild(icon);
    } else if (node.type === 'warp') {
      g.circle(px, py, 24).fill({ color: 0x450a0a });
      g.circle(px, py, 24).stroke({ color: 0xf87171, width: 2 });
      camera.addChild(g);

      const dashed = new Graphics();
      dashed.circle(px, py, 31).stroke({ color: 0xfca5a5, width: 1, alpha: 0.4 });
      camera.addChild(dashed);

      const warpIcon = new Text({
        text: '🌀',
        style: new TextStyle({ fontSize: 17 }),
      });
      warpIcon.anchor.set(0.5, 0.5);
      warpIcon.position.set(px, py);
      camera.addChild(warpIcon);
    } else if (node.type === 'venture') {
      const r = 26;
      g.poly([px, py - r, px + r, py, px, py + r, px - r, py]);
      g.fill({ color: 0xf59e0b }); // Amber
      g.poly([px, py - r, px + r, py, px, py + r, px - r, py]);
      g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
      camera.addChild(g);

      const label = new Text({
        text: '❓',
        style: new TextStyle({ fontSize: 16 }),
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(px, py);
      camera.addChild(label);
    } else if (node.type === 'break') {
      g.circle(px, py, 24).fill({ color: 0x0f3d3e }); // Calm teal — rest stop
      g.circle(px, py, 24).stroke({ color: 0x2dd4bf, width: 2, alpha: 0.8 });
      camera.addChild(g);

      const breakIcon = new Text({
        text: '☕',
        style: new TextStyle({ fontSize: 16 }),
      });
      breakIcon.anchor.set(0.5, 0.5);
      breakIcon.position.set(px, py);
      camera.addChild(breakIcon);
    } else if (node.type === 'tax_office') {
      const w = 56;
      g.roundRect(px - w/2, py - w/2, w, w, 10);
      g.fill({ color: 0x7f1d1d }); // Deep red — taxes hurt
      g.roundRect(px - w/2, py - w/2, w, w, 10);
      g.stroke({ color: 0xfca5a5, width: 2, alpha: 0.7 });
      camera.addChild(g);

      const taxIcon = new Text({
        text: '🏛️',
        style: new TextStyle({ fontSize: 17 }),
      });
      taxIcon.anchor.set(0.5, 0.5);
      taxIcon.position.set(px, py - 6);
      camera.addChild(taxIcon);

      const taxLabel = new Text({
        text: 'TAX',
        style: new TextStyle({ fontSize: 8.5, fill: 0xfecaca, fontFamily: 'Outfit', fontWeight: '900', letterSpacing: 0.5 }),
      });
      taxLabel.anchor.set(0.5, 0.5);
      taxLabel.position.set(px, py + 14);
      camera.addChild(taxLabel);
    } else {
      // Vacant node or built structure
      const prop = Object.values(state.properties).find(p => p.nodeId === node.id);
      const isOwned = prop && prop.ownerId !== null;
      const ownerColor = isOwned
        ? PLAYER_COLOR[state.turnOrder.indexOf(prop!.ownerId!) % PLAYER_COLOR.length]
        : 0x22223a;

      g.roundRect(px - 22, py - 22, 44, 44, 10);
      g.fill({ color: isOwned ? 0x0c0c1b : 0x374151 });
      g.roundRect(px - 22, py - 22, 44, 44, 10);
      g.stroke({
        color: isOwned ? ownerColor : 0x6b7280,
        width: isOwned ? 2.5 : 1,
        alpha: isOwned ? 0.95 : 0.4,
      });
      camera.addChild(g);

      let icon = '🔲';
      let title = 'VACANT';
      if (prop && prop.buildingType) {
        if (prop.buildingType === 'checkpoint') {
          icon = '🛃';
          title = `CK: ${prop.checkpointToll ?? 200}`;
        } else if (prop.buildingType === 'circus') {
          icon = '🎪';
          const lvl = prop.circusLevel ?? 0;
          const circusPrices = [100, 500, 1000, 2000];
          title = `CIRC: ${circusPrices[lvl]}`;
        } else if (prop.buildingType === 'balloonport') {
          icon = '🎈';
          title = 'BALLOON';
        } else if (prop.buildingType === 'tax_office') {
          icon = '🏛️';
          title = 'TAX 10%';
        } else if (prop.buildingType === 'home') {
          icon = '🏠';
          title = 'HOME';
        } else if (prop.buildingType === 'estate_agency') {
          icon = '🏢';
          title = 'ESTATE';
        } else if (prop.buildingType === 'three_star_shop') {
          icon = '⭐⭐⭐';
          title = `SHOP: ${prop.currentRent}`;
        }
      }

      const iconText = new Text({
        text: icon,
        style: new TextStyle({ fontSize: prop?.buildingType === 'three_star_shop' ? 10 : 16 }),
      });
      iconText.anchor.set(0.5, 0.5);
      iconText.position.set(px, py - 4);
      camera.addChild(iconText);

      const labelText = new Text({
        text: title,
        style: new TextStyle({
          fontSize: 7.5,
          fill: isOwned ? ownerColor : 0x94a3b8,
          fontFamily: 'Outfit',
          fontWeight: '900',
        }),
      });
      labelText.anchor.set(0.5, 0.5);
      labelText.position.set(px, py + 14);
      camera.addChild(labelText);
    }

    // Floating text label below node (only for non-properties to avoid clutter)
    if (node.type !== 'property') {
      const labelText = id.replace(/_/g, ' ').toUpperCase();
      const label = new Text({
        text: labelText,
        style: new TextStyle({ fontSize: 9, fill: 0x94a3b8, fontFamily: 'Outfit', fontWeight: 'bold' }),
      });
      label.anchor.set(0.5, 0);
      label.position.set(px, py + TILE_H / 2 + 5);
      camera.addChild(label);
    }
  }
}

function drawTokens(
  state: GameState,
  camera: Container,
  nodePos: Map<string, { px: number; py: number }>,
  tokens: Map<string, TokenInfo>,
) {
  const order = state.turnOrder;
  for (let i = 0; i < order.length; i++) {
    const pid    = order[i];
    const player = state.players[pid];
    const pos    = nodePos.get(player.currentNodeId);
    if (!pos) continue;

    const color  = PLAYER_COLOR[i % PLAYER_COLOR.length];
    const offset = (i - (order.length - 1) / 2) * 16;

    const container = new Container();
    container.position.set(pos.px + offset, pos.py);

    // Dynamic drop shadow offset for floating appearance
    const shadow = new Graphics();
    shadow.ellipse(0, 10, 12, 4).fill({ color: 0x000000, alpha: 0.45 });
    container.addChild(shadow);

    // Glowing aura rings
    const glow = new Graphics();
    glow.circle(0, 0, TOKEN_R + 4).fill({ color, alpha: 0.25 });
    container.addChild(glow);

    // Token core
    const circle = new Graphics();
    circle.circle(0, 0, TOKEN_R).fill({ color });
    circle.circle(0, 0, TOKEN_R).stroke({ color: 0xffffff, width: 2 });
    container.addChild(circle);

    // Initial label text inside the token
    const initialText = new Text({
      text: player.name.slice(0, 1).toUpperCase(),
      style: new TextStyle({
        fontSize: 11,
        fill: 0xffffff,
        fontFamily: 'Outfit',
        fontWeight: '900',
      }),
    });
    initialText.anchor.set(0.5, 0.5);
    container.addChild(initialText);

    // Active halo for the current player's turn
    const isActive = pid === state.currentPlayerId;
    if (isActive) {
      const activeRing = new Graphics();
      activeRing.circle(0, 0, TOKEN_R + 6).stroke({ color: 0xfacc15, width: 2, alpha: 0.95 });
      container.addChild(activeRing);
    }

    // High fidelity name tag above token
    const nameTag = new Text({
      text: player.name.slice(0, 6),
      style: new TextStyle({
        fontSize: 9.5,
        fill: isActive ? 0xffffff : color,
        fontFamily: 'Outfit',
        fontWeight: 'bold',
        stroke: { color: 0x070710, width: 2.5 },
      }),
    });
    nameTag.anchor.set(0.5, 1);
    nameTag.position.set(0, -TOKEN_R - 5);
    container.addChild(nameTag);

    camera.addChild(container);

    tokens.set(pid, { container, color, offset, nodeId: player.currentNodeId });
  }
}

function drawHighlights(state: GameState, refs: PixiRefs, hoveredNodeId: string | null) {
  const { highlightContainer, nodePos, app } = refs;
  if (!highlightContainer) return;

  highlightContainer.removeChildren();

  if (refs.highlightTickerFn) {
    app.ticker.remove(refs.highlightTickerFn);
    refs.highlightTickerFn = undefined;
  }

  const pending = state.pendingDestinations ?? [];
  if (state.currentPhase !== 'CHOOSING_PATH' || pending.length === 0) {
    return;
  }

  const highlights: Array<{
    graphics: Graphics;
    px: number;
    py: number;
    isHovered: boolean;
  }> = [];

  for (const destId of pending) {
    const pos = nodePos.get(destId);
    if (!pos) continue;

    const hG = new Graphics();
    highlightContainer.addChild(hG);

    highlights.push({
      graphics: hG,
      px: pos.px,
      py: pos.py,
      isHovered: destId === hoveredNodeId,
    });
  }

  let time = 0;

  function highlightTick(ticker: { deltaMS: number }) {
    time += ticker.deltaMS * 0.005;
    const basePulse = Math.sin(time) * 0.5 + 0.5;

    for (const h of highlights) {
      h.graphics.clear();
      if (h.isHovered) {
        // High visibility pulsing neon amber/orange aura
        const size = 42 + basePulse * 14;
        const alpha = 0.4 + basePulse * 0.45;
        h.graphics.circle(h.px, h.py, size).fill({ color: 0xf59e0b, alpha: alpha * 0.35 });
        h.graphics.circle(h.px, h.py, size).stroke({ color: 0xf59e0b, width: 3, alpha: alpha });
        h.graphics.circle(h.px, h.py, size + 8).stroke({ color: 0xf59e0b, width: 1.5, alpha: alpha * 0.3 });
      } else {
        // Subtle blue/cyan breathing highlight for normal destinations
        const breathing = Math.sin(time * 0.5) * 0.15 + 0.85;
        const size = 44;
        h.graphics.circle(h.px, h.py, size).fill({ color: 0x06b6d4, alpha: 0.08 * breathing });
        h.graphics.circle(h.px, h.py, size).stroke({ color: 0x06b6d4, width: 2.5, alpha: 0.45 * breathing });
      }
    }
  }

  refs.highlightTickerFn = highlightTick;
  app.ticker.add(highlightTick);
}

function renderAll(state: GameState, refs: PixiRefs, hoveredNodeId: string | null) {
  const { camera, nodePos, tokens } = refs;
  camera.removeChildren();
  nodePos.clear();
  tokens.clear();

  // 1. Draw Starry/Cosmic space backdrop first
  drawBackground(camera);

  // Create highlightContainer behind edges/nodes
  const highlightContainer = new Container();
  camera.addChild(highlightContainer);
  refs.highlightContainer = highlightContainer;

  // 2. Pre-calculate positions
  for (const [id, node] of Object.entries(state.board)) {
    nodePos.set(id, toPixel(node.coordinates.x, node.coordinates.y));
  }

  // 3. Draw neon edges, custom nodes, and floating tokens
  drawEdges(state, camera, nodePos);
  drawNodes(state, camera, nodePos);
  drawTokens(state, camera, nodePos, tokens);

  // 4. Draw highlights
  drawHighlights(state, refs, hoveredNodeId);
}

function panToNode(nodeId: string | undefined, refs: PixiRefs) {
  if (!nodeId) return;
  const { app, camera, nodePos } = refs;
  const pos = nodePos.get(nodeId);
  if (!pos) return;

  const targetX = app.screen.width  / 2 - pos.px * camera.scale.x;
  const targetY = app.screen.height / 2 - pos.py * camera.scale.y;

  let elapsed = 0;
  const dur = 400; // slightly smoother pan
  const sx = camera.x, sy = camera.y;

  app.ticker.remove(panTick);
  function panTick(ticker: { deltaMS: number }) {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / dur, 1);
    camera.x = sx + (targetX - sx) * t;
    camera.y = sy + (targetY - sy) * t;
    if (t >= 1) app.ticker.remove(panTick);
  }
  app.ticker.add(panTick);
}

async function animateToken(
  playerId: string,
  path: string[],
  board: GameState['board'] | undefined,
  refs: PixiRefs,
) {
  const { tokens, nodePos } = refs;
  const tok = tokens.get(playerId);
  if (!tok || path.length === 0) return;

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];
    const pos    = nodePos.get(nodeId);
    if (!pos) continue;

    const prevId = i > 0 ? path[i - 1] : null;
    const isWarp =
      prevId !== null &&
      board !== undefined &&
      !board[prevId]?.neighbors.includes(nodeId);

    if (isWarp) {
      await fadeTo(tok.container, 0, 200);
      tok.container.position.set(pos.px + tok.offset, pos.py);
      await fadeTo(tok.container, 1, 200);
    } else {
      tok.container.position.set(pos.px + tok.offset, pos.py);
      await sleep(100); // slightly longer pacing for visual appreciation
    }

    tok.nodeId = nodeId;
  }
}

// ─── Board component ──────────────────────────────────────────────────────────

interface Props {
  socket: Socket | null;
  state: GameState | null;
  hoveredNodeId: string | null;
}

export function Board({ socket, state, hoveredNodeId }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pixiRef  = useRef<PixiRefs | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const lastPannedPlayerIdRef = useRef<string | null>(null);

  // Init PixiJS once.
  useEffect(() => {
    let destroyed    = false;
    let initialized  = false;
    let pixiApp: Application | null = null;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let camStartX = 0;
    let camStartY = 0;

    let touchStartX = 0;
    let touchStartY = 0;

    let canvasEl: HTMLCanvasElement | null = null;
    let cameraContainer: Container | null = null;

    const onMouseDown = (e: MouseEvent) => {
      if (!cameraContainer || !canvasEl) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      camStartX = cameraContainer.x;
      camStartY = cameraContainer.y;
      canvasEl.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !cameraContainer) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      cameraContainer.x = camStartX + dx;
      cameraContainer.y = camStartY + dy;
    };

    const onMouseUp = () => {
      isDragging = false;
      if (canvasEl) canvasEl.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      if (!cameraContainer || !canvasEl) return;
      e.preventDefault();

      const rect = canvasEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const localX = (mouseX - cameraContainer.x) / cameraContainer.scale.x;
      const localY = (mouseY - cameraContainer.y) / cameraContainer.scale.y;

      const zoomIntensity = 0.08;
      const zoomFactor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
      const nextScale = Math.max(0.4, Math.min(2.0, cameraContainer.scale.x * zoomFactor));

      cameraContainer.x = mouseX - localX * nextScale;
      cameraContainer.y = mouseY - localY * nextScale;
      cameraContainer.scale.set(nextScale);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !cameraContainer) return;
      isDragging = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      camStartX = cameraContainer.x;
      camStartY = cameraContainer.y;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1 || !cameraContainer) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      cameraContainer.x = camStartX + dx;
      cameraContainer.y = camStartY + dy;
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    async function init() {
      const app = new Application();
      pixiApp = app;
      await app.init({
        width: 1000,
        height: 480, // Expanded height for 11x5 grid Alefgard layout
        backgroundColor: 0x0b0b14,
        antialias: true,
      });

      initialized = true;

      if (destroyed) { safeDestroyApp(app); return; }

      mountRef.current?.appendChild(app.canvas);
      canvasEl = app.canvas;

      const camera = new Container();
      cameraContainer = camera;
      app.stage.addChild(camera);

      // Attach interactions
      canvasEl.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      canvasEl.addEventListener('wheel', onWheel, { passive: false });

      canvasEl.addEventListener('touchstart', onTouchStart, { passive: true });
      canvasEl.addEventListener('touchmove', onTouchMove, { passive: true });
      canvasEl.addEventListener('touchend', onTouchEnd);

      canvasEl.style.cursor = 'grab';

      const refs: PixiRefs = {
        app,
        camera,
        nodePos: new Map(),
        tokens:  new Map(),
      };
      pixiRef.current = refs;

      if (stateRef.current) {
        renderAll(stateRef.current, refs, hoveredRef.current);
        panToNode(stateRef.current.players[stateRef.current.currentPlayerId]?.currentNodeId, refs);
      }
    }

    void init();

    return () => {
      destroyed        = true;
      if (canvasEl) {
        canvasEl.removeEventListener('mousedown', onMouseDown);
        canvasEl.removeEventListener('wheel', onWheel);
        canvasEl.removeEventListener('touchstart', onTouchStart);
        canvasEl.removeEventListener('touchmove', onTouchMove);
        canvasEl.removeEventListener('touchend', onTouchEnd);
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (pixiRef.current) {
        if (pixiRef.current.highlightTickerFn) {
          pixiRef.current.app.ticker.remove(pixiRef.current.highlightTickerFn);
        }
      }
      pixiRef.current  = null;
      if (initialized && pixiApp) safeDestroyApp(pixiApp);
    };
  }, []);

  // Re-render board only when state changes.
  useEffect(() => {
    stateRef.current = state;
    if (!state || !pixiRef.current) return;
    renderAll(state, pixiRef.current, hoveredRef.current);
    
    // Only auto-pan if the active player actually changed!
    if (state.currentPlayerId !== lastPannedPlayerIdRef.current) {
      lastPannedPlayerIdRef.current = state.currentPlayerId;
      panToNode(state.players[state.currentPlayerId]?.currentNodeId, pixiRef.current);
    }
  }, [state]);

  // Update highlights dynamically when hoveredNodeId changes to optimize performance.
  useEffect(() => {
    hoveredRef.current = hoveredNodeId;
    if (!state || !pixiRef.current) return;
    drawHighlights(state, pixiRef.current, hoveredNodeId);
  }, [hoveredNodeId, state]);

  // Socket listener for delta animations.
  useEffect(() => {
    if (!socket) return;

    function handleStateDelta(delta: { type: string; payload: Record<string, unknown> }) {
      if (!pixiRef.current) return;

      if (delta.type === 'PLAYER_MOVED') {
        const { playerId, path } = delta.payload as { playerId: string; path: string[] };
        void animateToken(playerId, path, stateRef.current?.board, pixiRef.current!);
      }

      if (delta.type === 'TURN_ADVANCED') {
        const { nextPlayerId } = delta.payload as { nextPlayerId: string };
        setTimeout(() => {
          if (!pixiRef.current) return;
          const tok = pixiRef.current.tokens.get(nextPlayerId);
          if (tok) panToNode(tok.nodeId, pixiRef.current!);
        }, 500);
      }
    }

    socket.on('state_delta', handleStateDelta);
    return () => { socket.off('state_delta', handleStateDelta); };
  }, [socket]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={mountRef}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          padding: '16px 0',
          background: 'radial-gradient(circle at 50% 50%, #111124 0%, #070710 100%)',
          borderBottom: '1px solid #1a1a2e',
        }}
      />
      {state && (
        <button
          onClick={() => {
            if (pixiRef.current) {
              panToNode(state.players[state.currentPlayerId]?.currentNodeId, pixiRef.current);
            }
          }}
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            background: 'rgba(8, 8, 16, 0.75)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '6px 14px',
            color: '#c084fc',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
            e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(8, 8, 16, 0.75)';
            e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
          }}
        >
          🎥 Center on Player
        </button>
      )}
    </div>
  );
}
