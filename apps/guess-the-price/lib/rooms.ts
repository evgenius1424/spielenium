import { randomUUID } from "crypto";

export type GameState =
  | "category-selection"
  | "guessing"
  | "results"
  | "game-over";

export type Player = {
  id: string;
  name: string;
  score: number;
  lastGuess?: number;
};

export type Item = { name: string; price: number };

export type Room = {
  id: string;
  createdAt: number;
  state: GameState;
  selectedCategory: string | null;
  currentItem: Item | null;
  usedItems: Set<string>;
  players: Map<string, Player>;
  roundGuesses: Map<string, number>; // playerId -> guess
  subscribers: Set<(event: ServerEvent) => void>;
};

export type ServerEvent =
  | { type: "state"; payload: RoomPublic }
  | { type: "players"; payload: PlayerPublic[] }
  | {
      type: "guess";
      payload: { playerId: string; name: string; guess: number };
    }
  | { type: "question"; payload: { category: string; item: Item } }
  | {
      type: "result";
      payload: {
        item: Item;
        winner: PlayerPublic | null;
        diffs: Array<{
          playerId: string;
          name: string;
          diff: number;
          guess?: number;
        }>;
      };
    };

export type RoomPublic = {
  id: string;
  state: GameState;
  selectedCategory: string | null;
  currentItem: Item | null;
  players: PlayerPublic[];
  availableCategories: string[];
};

export type PlayerPublic = Pick<Player, "id" | "name" | "score">;

const gameData = {
  categories: {
    Electronics: [
      { name: "iPhone 15 Pro", price: 999 },
      { name: "MacBook Air M2", price: 1199 },
      { name: "AirPods Pro", price: 249 },
      { name: 'iPad Pro 12.9"', price: 1099 },
    ],
    Fashion: [
      { name: "Designer Handbag", price: 450 },
      { name: "Luxury Watch", price: 2500 },
      { name: "Silk Scarf", price: 180 },
      { name: "Leather Jacket", price: 320 },
    ],
    "Home & Garden": [
      { name: "Robot Vacuum", price: 399 },
      { name: "Smart Thermostat", price: 249 },
      { name: "Coffee Machine", price: 899 },
      { name: "Garden Tool Set", price: 125 },
    ],
    Sports: [
      { name: "Mountain Bike", price: 1200 },
      { name: "Tennis Racket", price: 180 },
      { name: "Running Shoes", price: 150 },
      { name: "Yoga Mat Set", price: 89 },
    ],
  },
};

const rooms = new Map<string, Room>();

export function createRoom(): RoomPublic {
  const id = randomUUID().slice(0, 6).toUpperCase();
  const room: Room = {
    id,
    createdAt: Date.now(),
    state: "category-selection",
    selectedCategory: null,
    currentItem: null,
    usedItems: new Set(),
    players: new Map(),
    roundGuesses: new Map(),
    subscribers: new Set(),
  };
  rooms.set(id, room);
  return roomToPublic(room);
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function roomToPublic(room: Room): RoomPublic {
  return {
    id: room.id,
    state: room.state,
    selectedCategory: room.selectedCategory,
    currentItem: room.currentItem,
    players: [...room.players.values()].map(({ id, name, score }) => ({
      id,
      name,
      score,
    })),
    availableCategories: Object.keys(gameData.categories).filter((cat) => {
      const all = (gameData.categories as any)[cat] as Item[];
      const usedInCat = all.filter((i) => room.usedItems.has(i.name));
      return usedInCat.length < all.length;
    }),
  };
}

export function subscribe(room: Room, cb: (e: ServerEvent) => void) {
  room.subscribers.add(cb);
  cb({ type: "state", payload: roomToPublic(room) });
  return () => room.subscribers.delete(cb);
}

function broadcast(room: Room, e: ServerEvent) {
  for (const cb of room.subscribers) {
    try {
      cb(e);
    } catch {
      /* ignore */
    }
  }
}

export function joinRoom(room: Room, name: string): PlayerPublic {
  const id = randomUUID().slice(0, 8);
  const player: Player = {
    id,
    name: name.trim() || `Player-${id.slice(0, 4)}`,
    score: 0,
  };
  room.players.set(id, player);
  broadcast(room, {
    type: "players",
    payload: [...room.players.values()].map(({ id, name, score }) => ({
      id,
      name,
      score,
    })),
  });
  return { id: player.id, name: player.name, score: player.score };
}

export function pickItem(
  room: Room,
  category: string,
): { category: string; item: Item } | null {
  const items = (gameData.categories as any)[category] as Item[] | undefined;
  if (!items) return null;
  const available = items.filter((i) => !room.usedItems.has(i.name));
  if (available.length === 0) return null;
  const item = available[Math.floor(Math.random() * available.length)];
  room.selectedCategory = category;
  // @ts-ignore
  room.currentItem = item;
  room.state = "guessing";
  room.roundGuesses.clear();
  // @ts-ignore
  broadcast(room, { type: "question", payload: { category, item } });
  broadcast(room, { type: "state", payload: roomToPublic(room) });
  // @ts-ignore
  return { category, item };
}

export function submitGuess(room: Room, playerId: string, guess: number) {
  const player = room.players.get(playerId);
  if (!player || !room.currentItem || room.state !== "guessing") return;
  room.roundGuesses.set(playerId, guess);
  player.lastGuess = guess;
  broadcast(room, {
    type: "guess",
    payload: { playerId, name: player.name, guess },
  });
}

export function closeRound(room: Room) {
  if (!room.currentItem) return;
  const item = room.currentItem!;
  let winner: Player | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  const diffs: Array<{
    playerId: string;
    name: string;
    diff: number;
    guess?: number;
  }> = [];
  for (const p of room.players.values()) {
    const g = room.roundGuesses.get(p.id);
    if (typeof g === "number" && !Number.isNaN(g)) {
      const d = Math.abs(g - item.price);
      diffs.push({ playerId: p.id, name: p.name, diff: d, guess: g });
      if (d < bestDiff) {
        bestDiff = d;
        winner = p;
      }
    } else {
      diffs.push({
        playerId: p.id,
        name: p.name,
        diff: Number.POSITIVE_INFINITY,
      });
    }
  }
  if (winner) winner.score += 1;

  room.usedItems.add(item.name);

  room.state = "results";
  broadcast(room, {
    type: "result",
    payload: {
      item,
      winner: winner
        ? { id: winner.id, name: winner.name, score: winner.score }
        : null,
      diffs,
    },
  });
  broadcast(room, { type: "state", payload: roomToPublic(room) });
}

export function nextStep(room: Room) {
  const remainingCategories = roomToPublic(room).availableCategories;
  if (remainingCategories.length === 0) {
    room.state = "game-over";
    broadcast(room, { type: "state", payload: roomToPublic(room) });
    return;
  }
  room.state = "category-selection";
  room.selectedCategory = null;
  room.currentItem = null;
  room.roundGuesses.clear();
  broadcast(room, { type: "state", payload: roomToPublic(room) });
}
