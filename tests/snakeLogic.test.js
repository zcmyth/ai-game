const assert = require("assert");
const Logic = require("../src/snakeLogic.js");

function createFixedRng(values) {
  let idx = 0;
  return function () {
    const v = values[idx % values.length];
    idx += 1;
    return v;
  };
}

(function testMovement() {
  const rng = createFixedRng([0.5]);
  const state = Logic.createGameState({ gridWidth: 10, gridHeight: 10, rng });
  const head = { ...state.snake[0] };
  Logic.step(state, rng);
  assert.strictEqual(state.snake[0].x, head.x + 1);
  assert.strictEqual(state.snake[0].y, head.y);
})();

(function testDirectionBlocksReverse() {
  const rng = createFixedRng([0.5]);
  const state = Logic.createGameState({ gridWidth: 10, gridHeight: 10, rng });
  Logic.setDirection(state, "left");
  Logic.step(state, rng);
  assert.strictEqual(state.direction, Logic.DIRS.right);
})();

(function testGrowthAndScore() {
  const rng = createFixedRng([0]);
  const state = Logic.createGameState({ gridWidth: 5, gridHeight: 5, rng });
  state.food = { x: state.snake[0].x + 1, y: state.snake[0].y };
  Logic.step(state, rng);
  assert.strictEqual(state.score, 1);
  assert.strictEqual(state.snake.length, 4);
})();

(function testWallCollision() {
  const rng = createFixedRng([0.5]);
  const state = Logic.createGameState({ gridWidth: 3, gridHeight: 3, rng });
  state.snake = [{ x: 2, y: 1 }];
  Logic.setDirection(state, "right");
  Logic.step(state, rng);
  assert.strictEqual(state.gameOver, true);
})();

(function testFoodPlacementAvoidsSnake() {
  const rng = createFixedRng([0.0, 0.0, 0.9, 0.9]);
  const state = Logic.createGameState({ gridWidth: 4, gridHeight: 4, rng });
  state.snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];
  const food = Logic.placeFood(state, rng);
  const overlap = state.snake.some((p) => p.x === food.x && p.y === food.y);
  assert.strictEqual(overlap, false);
})();

console.log("All snake logic tests passed.");
