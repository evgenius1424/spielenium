import { randomUUID } from "crypto";

export type GameState =
  | "lobby"
  | "category-selection"
  | "guessing"
  | "results"
  | "game-over";

type Player = {
  id: string;
  name: string;
  score: number;
  voted: boolean;
  lastGuess?: number;
};

export type PlayerPublic = Pick<Player, "id" | "name" | "score" | "voted">;

export type Item = {
  name: string;
  price: number;
  image?: string;
  imageAnswer?: string;
};

type Room = {
  id: string;
  createdAt: number;
  state: GameState;
  categories: Category[];
  selectedCategory: Category | null;
  currentItem: Item | null;
  players: Map<string, Player>;
  currentCategoryPickerIndex?: number;
  playerIdToGuess: Map<string, number>;
  subscribers: Set<(event: ServerEvent) => void>;
};

export type RoomPublic = {
  id: string;
  state: GameState;
  categories: Category[];
  selectedCategory: Category | null;
  currentItem: Item | null;
  players: PlayerPublic[];
  currentPickerIndex?: number;
};

export type Category = {
  name: string,
  type: string,
  logo: string;
  items: Item[];
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
      winners: string[];
      losers: string[];
      diffs: Array<{
        playerId: string;
        name: string;
        diff: number;
        guess?: number;
      }>;
    };
  };

const rooms = new Map<string, Room>();

export function createRoom(categories: Category[]): RoomPublic {
  const id = randomUUID().slice(0, 6).toUpperCase();
  const room: Room = {
    id,
    createdAt: Date.now(),
    state: "lobby",
    categories,
    selectedCategory: null,
    currentItem: null,
    players: new Map(),
    currentCategoryPickerIndex: 0,
    playerIdToGuess: new Map(),
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
    categories: room.categories,
    selectedCategory: room.selectedCategory,
    currentItem: room.currentItem,
    players: [...room.players.values()].map(({ id, name, score, voted }) => ({
      id,
      name,
      score,
      voted,
    })),
    currentPickerIndex: room.currentCategoryPickerIndex,
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

function broadcastRoomState(room: Room) {
  broadcast(room, { type: "state", payload: roomToPublic(room) });
}

export function joinRoom(room: Room, name: string): PlayerPublic {
  const id = randomUUID().slice(0, 8);
  const player: Player = {
    id,
    name: name.trim() || `Player-${id.slice(0, 4)}`,
    score: 0,
    voted: false,
  };
  room.players.set(id, player);
  broadcastRoomState(room);
  return { id: player.id, name: player.name, score: player.score, voted: player.voted };
}

export function startGame(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  if (room.state !== "lobby") {
    throw new Error("Game already started");
  }

  if (!room.players || room.players.size === 0) {
    throw new Error("No players joined");
  }

  room.state = "category-selection";
  room.currentCategoryPickerIndex = 0;
  room.selectedCategory = null;
  room.currentItem = null;
  broadcastRoomState(room);
}

export function pickItem(
  room: Room,
  category: Category,
  itemOverride?: Item,
): { category: Category; item: Item } | null {
  let item: Item | undefined = itemOverride;

  if (!item) {
    const items = category.items;
    if (items.length === 0) return null;
    item = items[Math.floor(Math.random() * items.length)];
  }

  room.selectedCategory = category;
  // @ts-ignore
  room.currentItem = item;
  room.state = "guessing";
  room.playerIdToGuess.clear();
  // @ts-ignore
  broadcast(room, { type: "question", payload: { category, item } });
  broadcastRoomState(room);
  // @ts-ignore
  return { category, item };
}

export function submitGuess(room: Room, playerId: string, guess: number) {
  const player = room.players.get(playerId);
  if (!player || !room.currentItem || room.state !== "guessing") return;
  room.playerIdToGuess.set(playerId, guess);
  player.lastGuess = guess;
  player.voted = true;
  broadcast(room, {
    type: "guess",
    payload: { playerId, name: player.name, guess },
  });
  broadcastRoomState(room);
}

export function closeRound(room: Room) {
  if (!room.currentItem || !room.selectedCategory) return;
  const item = room.currentItem;

  const diffs: Array<{
    playerId: string;
    name: string;
    diff: number;
    guess?: number;
  }> = [];

  for (const p of room.players.values()) {
    const g = room.playerIdToGuess.get(p.id);
    if (typeof g === "number" && !Number.isNaN(g)) {
      const d = Math.abs(g - item.price);
      diffs.push({ playerId: p.id, name: p.name, diff: d, guess: g });
    } else {
      diffs.push({
        playerId: p.id,
        name: p.name,
        diff: Number.POSITIVE_INFINITY,
      });
    }
  }

  diffs.sort((a, b) => a.diff - b.diff);

  const minDiff = Math.min(...diffs.map((p) => p.diff));
  const maxDiff = Math.max(...diffs.map((p) => p.diff));

  const winners = diffs
    .filter((p) => p.diff === minDiff)
    .map((p) => p.playerId);

  winners.forEach((id) => {
    const player = room.players.get(id);
    if (player) player.score++;
  });

  const losers =
    minDiff === maxDiff
      ? []
      : diffs
        .filter((p) => p.diff === maxDiff)
        .map((p) => p.playerId);

  losers.forEach((id) => {
    const player = room.players.get(id);
    if (player) player.score--;
  });

  // reset voted flags
  room.players.forEach((p) => (p.voted = false));

  // remove item from category
  const category = room.categories.find((category) => category.name == room.selectedCategory?.name)!;
  category.items = category.items.filter((i) => i.name !== item.name);

  // remove category if empty
  if (category.items.length === 0) {
    room.categories = room.categories.filter((c) => c !== category);
  }

  room.playerIdToGuess.clear();
  room.state = "results";

  broadcast(room, {
    type: "result",
    payload: {
      item,
      winners,
      losers,
      diffs,
    },
  });

  broadcast(room, {
    type: "state",
    payload: roomToPublic(room),
  });
}

export function endGame(room: Room) {
  room.state = "game-over";
  room.selectedCategory = null;
  room.currentItem = null;
  room.playerIdToGuess.clear();
  broadcastRoomState(room);
}

export function nextStep(room: Room) {
  if (room.categories.length === 0) {
    endGame(room);
    return;
  }

  room.state = "category-selection";
  room.selectedCategory = null;
  room.currentItem = null;
  room.playerIdToGuess.clear();
  broadcastRoomState(room);
}
