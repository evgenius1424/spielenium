"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Badge } from "@repo/ui/components/badge";
import { Trophy, Star, Sparkles } from "lucide-react";

// Mock data for the game
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

type GameState = "category-selection" | "guessing" | "results" | "game-over";
type Player = {
  id: number;
  name: string;
  score: number;
  guess: string;
};

export default function GuessThePrizeGame() {
  const [gameState, setGameState] = useState<GameState>("category-selection");
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: "Player 1", score: 0, guess: "" },
    { id: 2, name: "Player 2", score: 0, guess: "" },
    { id: 3, name: "Player 3", score: 0, guess: "" },
  ]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [currentItem, setCurrentItem] = useState<{
    name: string;
    price: number;
  } | null>(null);
  const [usedItems, setUsedItems] = useState<Set<string>>(new Set());
  const [availableCategories, setAvailableCategories] = useState<string[]>(
    Object.keys(gameData.categories),
  );
  const [roundWinner, setRoundWinner] = useState<Player | null>(null);
  const [gameWinner, setGameWinner] = useState<Player | null>(null);

  const selectCategory = (category: string) => {
    setSelectedCategory(category);
    const categoryItems =
      gameData.categories[category as keyof typeof gameData.categories];
    const availableItems = categoryItems.filter(
      (item) => !usedItems.has(item.name),
    );

    if (availableItems.length > 0) {
      const randomItem =
        availableItems[Math.floor(Math.random() * availableItems.length)];
      setCurrentItem(randomItem!);
      setGameState("guessing");
      // Reset player guesses
      setPlayers((prev) => prev.map((p) => ({ ...p, guess: "" })));
    }
  };

  const updatePlayerGuess = (playerId: number, guess: string) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, guess } : p)),
    );
  };

  const submitGuesses = () => {
    if (!currentItem) return;

    // Calculate closest guess
    let closestPlayer: Player | null = null;
    let smallestDifference = Number.POSITIVE_INFINITY;

    players.forEach((player) => {
      const guess = Number.parseFloat(player.guess);
      if (!isNaN(guess)) {
        const difference = Math.abs(guess - currentItem.price);
        if (difference < smallestDifference) {
          smallestDifference = difference;
          closestPlayer = player;
        }
      }
    });

    if (closestPlayer) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === closestPlayer!.id ? { ...p, score: p.score + 1 } : p,
        ),
      );
      setRoundWinner(closestPlayer);
    }

    // Mark item as used
    setUsedItems((prev) => new Set([...prev, currentItem.name]));

    // Check if category is complete
    const categoryItems =
      gameData.categories[selectedCategory as keyof typeof gameData.categories];
    const usedInCategory = categoryItems.filter(
      (item) => usedItems.has(item.name) || item.name === currentItem.name,
    );

    if (usedInCategory.length === categoryItems.length) {
      setAvailableCategories((prev) =>
        prev.filter((cat) => cat !== selectedCategory),
      );
    }

    setGameState("results");
  };

  const nextRound = () => {
    if (
      availableCategories.length === 0 ||
      (availableCategories.length === 1 &&
        selectedCategory &&
        !availableCategories.includes(selectedCategory))
    ) {
      // Game over - find winner
      const winner = players.reduce((prev, current) =>
        prev.score > current.score ? prev : current,
      );
      setGameWinner(winner);
      setGameState("game-over");
    } else {
      setGameState("category-selection");
      setRoundWinner(null);
    }
  };

  const resetGame = () => {
    setGameState("category-selection");
    setPlayers([
      { id: 1, name: "Player 1", score: 0, guess: "" },
      { id: 2, name: "Player 2", score: 0, guess: "" },
      { id: 3, name: "Player 3", score: 0, guess: "" },
    ]);
    setSelectedCategory("");
    setCurrentItem(null);
    setUsedItems(new Set());
    setAvailableCategories(Object.keys(gameData.categories));
    setRoundWinner(null);
    setGameWinner(null);
  };

  const allPlayersGuessed = players.every((p) => p.guess.trim() !== "");

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2 font-sans">
            🎯 Guess the Price! 🎯
          </h1>
          <p className="text-muted-foreground font-mono">
            Three players compete to guess the closest price and win points!
          </p>
        </div>

        {/* Player Scoreboard */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {players.map((player) => (
            <Card key={player.id} className="text-center">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-sans">
                  {player.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-2">
                  <Star className="w-5 h-5 text-primary" />
                  <span className="text-2xl font-bold text-primary">
                    {player.score}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Category Selection */}
        {gameState === "category-selection" && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-center text-2xl font-sans">
                Choose a Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {availableCategories.map((category) => (
                  <Button
                    key={category}
                    onClick={() => selectCategory(category)}
                    className="h-20 text-lg font-sans"
                    variant="outline"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Guessing Phase */}
        {gameState === "guessing" && currentItem && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-center text-2xl font-sans">
                <Badge variant="secondary" className="mb-4">
                  {selectedCategory}
                </Badge>
                <br />
                What's the price of:{" "}
                <span className="text-primary">{currentItem.name}</span>?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {players.map((player) => (
                  <div key={player.id} className="space-y-2">
                    <label className="font-semibold font-sans">
                      {player.name}
                    </label>
                    <div className="flex gap-2">
                      <span className="text-2xl">$</span>
                      <Input
                        type="number"
                        placeholder="Enter guess"
                        value={player.guess}
                        onChange={(e) =>
                          updatePlayerGuess(player.id, e.target.value)
                        }
                        className="text-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center mt-6">
                <Button
                  onClick={submitGuesses}
                  disabled={!allPlayersGuessed}
                  className="text-lg px-8 py-3 font-sans"
                >
                  Submit All Guesses
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Phase */}
        {gameState === "results" && currentItem && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-center text-2xl font-sans">
                Round Results
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="mb-6">
                <p className="text-lg mb-2 font-mono">
                  The actual price of <strong>{currentItem.name}</strong> is:
                </p>
                <p className="text-4xl font-bold text-primary">
                  ${currentItem.price}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {players.map((player) => (
                  <div key={player.id} className="text-center">
                    <p className="font-semibold font-sans">{player.name}</p>
                    <p className="text-xl">${player.guess}</p>
                    <p className="text-sm text-muted-foreground">
                      Difference: $
                      {Math.abs(
                        Number.parseFloat(player.guess) - currentItem.price,
                      ).toFixed(0)}
                    </p>
                  </div>
                ))}
              </div>

              {roundWinner && (
                <div className="mb-6">
                  <div className="flex items-center justify-center gap-2 text-accent">
                    <Sparkles className="w-6 h-6" />
                    <span className="text-xl font-bold font-sans">
                      {roundWinner.name} wins this round!
                    </span>
                    <Sparkles className="w-6 h-6" />
                  </div>
                </div>
              )}

              <Button
                onClick={nextRound}
                className="text-lg px-8 py-3 font-sans"
              >
                {availableCategories.length === 0 ||
                (availableCategories.length === 1 &&
                  selectedCategory &&
                  !availableCategories.includes(selectedCategory))
                  ? "See Final Results"
                  : "Next Round"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Game Over */}
        {gameState === "game-over" && gameWinner && (
          <Card className="mb-8 border-primary">
            <CardHeader>
              <CardTitle className="text-center text-3xl font-sans text-primary">
                🎉 Game Over! 🎉
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="mb-6">
                <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
                <p className="text-2xl font-bold font-sans mb-2">
                  🏆 {gameWinner.name} Wins! 🏆
                </p>
                <p className="text-lg text-muted-foreground font-mono">
                  Final Score: {gameWinner.score} points
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 font-sans">
                  Final Scores:
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {players
                    .sort((a, b) => b.score - a.score)
                    .map((player, index) => (
                      <div key={player.id} className="text-center">
                        <p className="font-semibold font-sans">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}{" "}
                          {player.name}
                        </p>
                        <p className="text-xl font-bold text-primary">
                          {player.score}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              <Button
                onClick={resetGame}
                className="text-lg px-8 py-3 font-sans"
              >
                Play Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
