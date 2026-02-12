(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SnakeLogic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  function samePos(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function isOpposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  function clonePos(pos) {
    return { x: pos.x, y: pos.y };
  }

  function createRng(seed) {
    var s = seed || 123456789;
    return function () {
      // xorshift32
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }

  function createGameState(options) {
    var opts = options || {};
    var gridWidth = opts.gridWidth || 20;
    var gridHeight = opts.gridHeight || 20;
    var rng = opts.rng || Math.random;
    var startX = Math.floor(gridWidth / 2);
    var startY = Math.floor(gridHeight / 2);

    var snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];

    var state = {
      gridWidth: gridWidth,
      gridHeight: gridHeight,
      snake: snake,
      direction: DIRS.right,
      pendingDirection: DIRS.right,
      food: { x: 0, y: 0 },
      score: 0,
      gameOver: false,
    };

    state.food = placeFood(state, rng);
    return state;
  }

  function placeFood(state, rng) {
    var attempts = state.gridWidth * state.gridHeight;
    while (attempts > 0) {
      var x = Math.floor(rng() * state.gridWidth);
      var y = Math.floor(rng() * state.gridHeight);
      var candidate = { x: x, y: y };
      var collision = false;
      for (var i = 0; i < state.snake.length; i += 1) {
        if (samePos(candidate, state.snake[i])) {
          collision = true;
          break;
        }
      }
      if (!collision) {
        return candidate;
      }
      attempts -= 1;
    }
    return { x: 0, y: 0 };
  }

  function setDirection(state, dirKey) {
    var next = DIRS[dirKey];
    if (!next || isOpposite(state.direction, next)) {
      return state;
    }
    state.pendingDirection = next;
    return state;
  }

  function step(state, rng) {
    if (state.gameOver) {
      return state;
    }

    state.direction = state.pendingDirection;
    var head = state.snake[0];
    var nextHead = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y,
    };

    if (
      nextHead.x < 0 ||
      nextHead.x >= state.gridWidth ||
      nextHead.y < 0 ||
      nextHead.y >= state.gridHeight
    ) {
      state.gameOver = true;
      return state;
    }

    for (var i = 0; i < state.snake.length; i += 1) {
      if (samePos(nextHead, state.snake[i])) {
        state.gameOver = true;
        return state;
      }
    }

    var ateFood = samePos(nextHead, state.food);
    state.snake.unshift(nextHead);

    if (!ateFood) {
      state.snake.pop();
    } else {
      state.score += 1;
      state.food = placeFood(state, rng || Math.random);
    }

    return state;
  }

  function snapshot(state) {
    return {
      gridWidth: state.gridWidth,
      gridHeight: state.gridHeight,
      snake: state.snake.map(clonePos),
      direction: clonePos(state.direction),
      pendingDirection: clonePos(state.pendingDirection),
      food: clonePos(state.food),
      score: state.score,
      gameOver: state.gameOver,
    };
  }

  return {
    DIRS: DIRS,
    createRng: createRng,
    createGameState: createGameState,
    placeFood: placeFood,
    setDirection: setDirection,
    step: step,
    snapshot: snapshot,
  };
});
