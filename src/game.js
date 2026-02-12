(function () {
  "use strict";

  var LOGIC = window.SnakeLogic;
  var GRID_SIZE = 20;
  var CELL_SIZE = 24;
  var BOARD_PX = GRID_SIZE * CELL_SIZE;
  var TICK_MS = 120;

  var state;
  var rng = LOGIC.createRng(42);
  var paused = false;

  var scoreEl = document.getElementById("score");

  var config = {
    type: Phaser.AUTO,
    width: BOARD_PX,
    height: BOARD_PX,
    parent: "game",
    backgroundColor: "#101716",
    scene: {
      create: create,
      update: update,
    },
  };

  var game = new Phaser.Game(config);
  var graphics;
  var timerEvent;
  var gameOverText;

  function create() {
    graphics = this.add.graphics();
    gameOverText = this.add
      .text(BOARD_PX / 2, BOARD_PX / 2, "", {
        fontFamily: "Georgia",
        fontSize: "28px",
        color: "#ffb17a",
        align: "center",
      })
      .setOrigin(0.5);

    resetGame();

    this.input.keyboard.on("keydown", handleKey);

    timerEvent = this.time.addEvent({
      delay: TICK_MS,
      loop: true,
      callback: function () {
        if (!paused) {
          LOGIC.step(state, rng);
          syncScore();
        }
      },
    });

    hookTouchControls();
  }

  function resetGame() {
    state = LOGIC.createGameState({
      gridWidth: GRID_SIZE,
      gridHeight: GRID_SIZE,
      rng: rng,
    });
    paused = false;
    syncScore();
    gameOverText.setText("");
  }

  function update() {
    renderBoard();
    if (state.gameOver) {
      gameOverText.setText("Game Over\nPress R to restart");
    }
  }

  function renderBoard() {
    graphics.clear();

    graphics.lineStyle(1, 0x1f2a27, 0.6);
    for (var x = 0; x <= GRID_SIZE; x += 1) {
      graphics.lineBetween(x * CELL_SIZE, 0, x * CELL_SIZE, BOARD_PX);
    }
    for (var y = 0; y <= GRID_SIZE; y += 1) {
      graphics.lineBetween(0, y * CELL_SIZE, BOARD_PX, y * CELL_SIZE);
    }

    graphics.fillStyle(0x86c59a, 1);
    for (var i = 0; i < state.snake.length; i += 1) {
      var part = state.snake[i];
      graphics.fillRect(
        part.x * CELL_SIZE + 2,
        part.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      );
    }

    graphics.fillStyle(0xffb17a, 1);
    graphics.fillRect(
      state.food.x * CELL_SIZE + 3,
      state.food.y * CELL_SIZE + 3,
      CELL_SIZE - 6,
      CELL_SIZE - 6
    );
  }

  function handleKey(event) {
    var key = event.key.toLowerCase();
    if (key === "arrowup" || key === "w") {
      LOGIC.setDirection(state, "up");
    } else if (key === "arrowdown" || key === "s") {
      LOGIC.setDirection(state, "down");
    } else if (key === "arrowleft" || key === "a") {
      LOGIC.setDirection(state, "left");
    } else if (key === "arrowright" || key === "d") {
      LOGIC.setDirection(state, "right");
    } else if (key === "r") {
      resetGame();
    } else if (key === " ") {
      paused = !paused;
    }
  }

  function hookTouchControls() {
    var buttons = document.querySelectorAll(".btn[data-dir]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        LOGIC.setDirection(state, btn.getAttribute("data-dir"));
      });
    });

    var restart = document.getElementById("restart");
    if (restart) {
      restart.addEventListener("click", function () {
        resetGame();
      });
    }
  }

  function syncScore() {
    if (scoreEl) {
      scoreEl.textContent = "Score: " + state.score;
    }
  }
})();
