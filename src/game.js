(function () {
  "use strict";

  var WIDTH = 860;
  var HEIGHT = 484;
  var FLOOR_Y = HEIGHT - 70;
  var SHELF_Y = HEIGHT * 0.66;
  var TABLE_Y = HEIGHT * 0.86;
  var PERSPECTIVE_NEAR_Y = HEIGHT * 0.86;
  var PERSPECTIVE_FAR_Y = SHELF_Y - 16;
  var BOTTLE_WIDTH = 30;
  var BOTTLE_HEIGHT = 74;
  var STACK_GAP = 18;
  var WANDER_SPEED = 28;
  var WANDER_JITTER = 22;

  var levelEl = document.getElementById("level");
  var cashEl = document.getElementById("cash");
  var scoreEl = document.getElementById("score");
  var shotsEl = document.getElementById("shots");
  var accuracyEl = document.getElementById("accuracy");
  var bottlesEl = document.getElementById("bottles");
  var nextLevelBtn = document.getElementById("next-level");
  var shotgunBtn = document.getElementById("toggle-shotgun");

  var upgradeButtons = {
    fireRate: document.getElementById("upgrade-fireRate"),
    bulletSpeed: document.getElementById("upgrade-bulletSpeed"),
    stability: document.getElementById("upgrade-stability"),
  };

  var config = {
    type: Phaser.AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent: "game",
    backgroundColor: "#120c0a",
    scene: {
      preload: preload,
      create: create,
      update: update,
    },
  };

  var game = new Phaser.Game(config);

  var bottles = [];
  var bullets = [];
  var crosshair;
  var gun;
  var gameOverText;
  var noticeText;

  var score = 0;
  var shots = 0;
  var hits = 0;
  var cash = 0;
  var level = 1;
  var levelComplete = false;
  var lastShotAt = 0;
  var timeElapsed = 0;
  var weaponMode = "rifle";
  var shotgunPurchased = false;
  var shotgunCost = 200;
  var mouseX = WIDTH / 2;
  var mouseY = HEIGHT / 2;

  var upgrades = {
    fireRate: 0,
    bulletSpeed: 0,
    stability: 0,
  };

  var levels = [
    { rows: 4, cols: 4, sway: 0, swaySpeed: 0, layout: "pyramid" },
    { rows: 5, cols: 4, sway: 0, swaySpeed: 0, layout: "diagonal" },
    { rows: 5, cols: 5, sway: 0, swaySpeed: 0, layout: "pyramid" },
    { rows: 6, cols: 5, sway: 0, swaySpeed: 0, layout: "grid" },
    { rows: 6, cols: 6, sway: 0, swaySpeed: 0, layout: "pyramid" },
  ];

  function preload() {
    // No external assets needed.
  }

  function create() {
    var scene = this;

    createBackground(scene);

    gun = scene.add.rectangle(WIDTH / 2, HEIGHT - 30, 140, 30, 0x2b1b14).setOrigin(0.5);
    scene.add.rectangle(WIDTH / 2 + 70, HEIGHT - 40, 80, 12, 0x4c2b1c).setOrigin(0.5);
    scene.add.rectangle(WIDTH / 2, HEIGHT - 44, 40, 22, 0x3a2418).setOrigin(0.5);

    crosshair = scene.add.graphics();

    gameOverText = scene.add
      .text(WIDTH / 2, HEIGHT / 2 - 40, "", {
        fontFamily: '"Bebas Neue", "Space Grotesk", sans-serif',
        fontSize: "40px",
        color: "#f4b266",
        align: "center",
      })
      .setOrigin(0.5);
    noticeText = scene.add
      .text(WIDTH / 2, HEIGHT / 2 + 30, "", {
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: "16px",
        color: "#f7efe6",
        align: "center",
      })
      .setOrigin(0.5);

    resetGame(scene);
    drawCrosshair(WIDTH / 2, HEIGHT / 2);

    scene.input.on("pointermove", function (pointer) {
      mouseX = pointer.worldX;
      mouseY = pointer.worldY;
      drawCrosshair(pointer.worldX, pointer.worldY);
    });

    scene.input.on("pointerdown", function (pointer) {
      mouseX = pointer.worldX;
      mouseY = pointer.worldY;
      shoot(scene, pointer.worldX, pointer.worldY);
    });

    scene.input.keyboard.on("keydown", function (event) {
      var key = event.key.toLowerCase();
      if (key === " ") {
        var pointer = scene.input.activePointer;
        mouseX = pointer.worldX;
        mouseY = pointer.worldY;
        shoot(scene, pointer.worldX, pointer.worldY);
      } else if (key === "r") {
        resetGame(scene);
      } else if (key === "n") {
        advanceLevel(scene);
      }
    });

    if (nextLevelBtn) {
      nextLevelBtn.addEventListener("click", function () {
        advanceLevel(scene);
      });
    }

    Object.keys(upgradeButtons).forEach(function (key) {
      var btn = upgradeButtons[key];
      if (btn) {
        btn.addEventListener("click", function () {
          buyUpgrade(key);
        });
      }
    });

    if (shotgunBtn) {
      shotgunBtn.addEventListener("click", function () {
        toggleWeapon();
      });
    }
  }

  function update(time, delta) {
    var speed = delta / 1000;
    timeElapsed += speed;

    for (var i = bullets.length - 1; i >= 0; i -= 1) {
      var bullet = bullets[i];
      bullet.x += bullet.vx * speed;
      bullet.y += bullet.vy * speed;
      bullet.vy += 480 * speed;
      bullet.shape.setScale(perspectiveScale(bullet.y));
      bullet.shape.x = bullet.x;
      bullet.shape.y = bullet.y;
      bullet.life -= speed;

      if (bullet.life <= 0 || bullet.x > WIDTH + 40 || bullet.y < -40) {
        bullet.shape.destroy();
        bullets.splice(i, 1);
        continue;
      }

      for (var b = bottles.length - 1; b >= 0; b -= 1) {
        var bottle = bottles[b];
        if (!bottle.alive || bottle.falling || bottle.dropping) {
          continue;
        }
        if (hitTest(bullet, bottle)) {
          handleHit(bottle, bullet);
          break;
        }
      }
    }

    for (var j = bottles.length - 1; j >= 0; j -= 1) {
      var bottleItem = bottles[j];
      if (bottleItem.falling) {
        bottleItem.worldX += bottleItem.vx * speed;
        bottleItem.worldY += bottleItem.vy * speed;
        bottleItem.vy += 420 * speed;
        bottleItem.rotation += bottleItem.vr * speed;
        bottleItem.sprite.rotation = bottleItem.rotation;
        applyPerspective(bottleItem);
        if (bottleItem.worldY > HEIGHT + 120) {
          bottleItem.sprite.destroy();
          bottles.splice(j, 1);
        }
        continue;
      }

      if (bottleItem.alive) {
        var targetY = slotY(bottleItem.row);
        if (bottleItem.dropping) {
          bottleItem.vy += 520 * speed;
          bottleItem.worldY += bottleItem.vy * speed;
          bottleItem.worldX += bottleItem.wiggle * speed;
          bottleItem.wiggle += Phaser.Math.Between(-120, 120) * speed;
          bottleItem.wiggle = Phaser.Math.Clamp(bottleItem.wiggle, -120, 120);
          applyWiggleImpact(bottleItem);
          if (bottleItem.worldY >= bottleItem.dropTargetY) {
            bottleItem.worldY = bottleItem.dropTargetY;
            shatterBottle(bottleItem, false);
          }
        } else {
          applyWander(bottleItem, targetY, speed);
        }
        applyPerspective(bottleItem);
      }
    }

    if (gameOverText) {
      if (levelComplete) {
        gameOverText.setText("Level Cleared!\nUpgrade then press N");
      } else {
        gameOverText.setText("");
      }
    }
  }

  function createBackground(scene) {
    scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x160f0b);

    var backWall = scene.add.rectangle(WIDTH / 2, HEIGHT / 2 - 40, WIDTH, HEIGHT - 120, 0x1e140f);
    backWall.setAlpha(0.9);

    var table = scene.add.graphics();
    table.fillStyle(0x2a1c15, 0.98);
    table.fillPoints(
      [
        { x: WIDTH * 0.08, y: TABLE_Y + 70 },
        { x: WIDTH * 0.92, y: TABLE_Y + 70 },
        { x: WIDTH * 0.76, y: TABLE_Y - 10 },
        { x: WIDTH * 0.24, y: TABLE_Y - 10 },
      ],
      true
    );

    var shelf = scene.add.rectangle(WIDTH / 2, SHELF_Y, WIDTH * 0.8, 8, 0x3c281f);
    shelf.setAlpha(0.95);

    scene.add.rectangle(60, TABLE_Y + 25, 40, 80, 0x1a120e).setAlpha(0.8);
    scene.add.rectangle(WIDTH - 60, TABLE_Y + 25, 40, 80, 0x1a120e).setAlpha(0.8);
  }

  function resetGame(scene) {
    score = 0;
    shots = 0;
    hits = 0;
    cash = 120;
    level = 1;
    levelComplete = false;
    weaponMode = "rifle";
    shotgunPurchased = false;
    upgrades.fireRate = 0;
    upgrades.bulletSpeed = 0;
    upgrades.stability = 0;
    bullets.forEach(function (bullet) {
      bullet.shape.destroy();
    });
    bullets = [];
    resetStack(scene);
    syncHud();
    refreshShop();
  }

  function resetStack(scene) {
    bottles.forEach(function (bottle) {
      bottle.sprite.destroy();
    });
    bottles = [];

    var config = levelConfig();

    if (config.layout === "pyramid") {
      for (var row = 0; row < config.rows; row += 1) {
        var count = Math.max(1, config.cols - row);
        var startCol = Math.floor((config.cols - count) / 2);
        for (var c = 0; c < count; c += 1) {
          bottles.push(createBottle(scene, startCol + c, row, 0));
        }
      }
    } else if (config.layout === "diagonal") {
      for (var dRow = 0; dRow < config.rows; dRow += 1) {
        var offset = (dRow - (config.rows - 1) / 2) * (BOTTLE_WIDTH * 0.45);
        for (var dCol = 0; dCol < config.cols; dCol += 1) {
          bottles.push(createBottle(scene, dCol, dRow, offset));
        }
      }
    } else {
      for (var col = 0; col < config.cols; col += 1) {
        for (var r = 0; r < config.rows; r += 1) {
          bottles.push(createBottle(scene, col, r, 0));
        }
      }
    }

    levelComplete = false;
  }

  function createBottle(scene, col, row, xOffset) {
    var bottle = scene.add.graphics();
    bottle.fillStyle(0x5fa777, 1);
    bottle.fillRoundedRect(-12, -48, 24, 52, 8);
    bottle.fillStyle(0x76c892, 1);
    bottle.fillRoundedRect(-10, -64, 20, 16, 6);
    bottle.fillStyle(0x3c7a52, 1);
    bottle.fillRect(-6, -72, 12, 10);
    bottle.lineStyle(2, 0xb5f1c3, 0.6);
    bottle.strokeRoundedRect(-12, -48, 24, 52, 8);

    var baseX = slotX(col) + (xOffset || 0);
    var baseY = slotY(row);
    bottle.x = baseX;
    bottle.y = baseY;

    return {
      sprite: bottle,
      baseX: baseX,
      worldX: baseX,
      worldY: baseY,
      screenX: baseX,
      screenY: baseY,
      scale: 1,
      row: row,
      col: col,
      swayOffset: Phaser.Math.FloatBetween(0, Math.PI * 2),
      alive: true,
      falling: false,
      dropping: false,
      dropTargetY: 0,
      wiggle: 0,
      wanderVX: Phaser.Math.FloatBetween(-WANDER_SPEED, WANDER_SPEED),
      wanderVY: Phaser.Math.FloatBetween(-WANDER_SPEED, WANDER_SPEED),
      vx: 0,
      vy: 0,
      vr: 0,
      rotation: 0,
    };
  }

  function drawCrosshair(x, y) {
    crosshair.clear();
    crosshair.lineStyle(2, 0xf4b266, 0.9);
    crosshair.strokeCircle(x, y, 14);
    crosshair.lineBetween(x - 18, y, x - 6, y);
    crosshair.lineBetween(x + 6, y, x + 18, y);
    crosshair.lineBetween(x, y - 18, x, y - 6);
    crosshair.lineBetween(x, y + 6, x, y + 18);
  }

  function shoot(scene, targetX, targetY) {
    if (levelComplete) {
      return;
    }

    var now = scene.time.now;
    var cooldown = (weaponMode === "shotgun" ? 360 : 280) - upgrades.fireRate * 40;
    if (now - lastShotAt < Math.max(120, cooldown)) {
      return;
    }
    lastShotAt = now;

    shots += 1;
    syncHud();

    var originX = WIDTH / 2;
    var originY = HEIGHT - 50;
    var baseAngle = Math.atan2(targetY - originY, targetX - originX);
    var speed = (weaponMode === "shotgun" ? 840 : 900) + upgrades.bulletSpeed * 120;
    if (weaponMode === "shotgun") {
      for (var p = 0; p < 5; p += 1) {
        var pelletAngle = baseAngle + Phaser.Math.FloatBetween(-0.24, 0.24) - upgrades.stability * 0.01;
        spawnBullet(scene, originX, originY, pelletAngle, speed * 0.9, 1.35);
      }
    } else {
      var rifleAngle = baseAngle + Phaser.Math.FloatBetween(-0.04, 0.04) - upgrades.stability * 0.005;
      spawnBullet(scene, originX, originY, rifleAngle, speed, 1);
    }

    gun.scaleY = 0.8;
    scene.tweens.add({
      targets: gun,
      scaleY: 1,
      duration: 120,
      ease: "Quad.Out",
    });

    scene.cameras.main.shake(60, 0.004);
  }

  function hitTest(bullet, bottle) {
    var dx = bullet.x - bottle.screenX;
    var dy = bullet.y - bottle.screenY + 20;
    var shrink = Math.max(0.7, 1 - (level - 1) * 0.05);
    var scale = bullet.hitScale || 1;
    return Math.abs(dx) < 16 * shrink * scale * bottle.scale && Math.abs(dy) < 36 * shrink * scale * bottle.scale;
  }

  function handleHit(bottle, bullet) {
    hits += 1;
    score += 100 + level * 15;
    cash += 25 + level * 5;

    bullet.life = 0;
    bullet.shape.destroy();

    shatterBottle(bottle, true);

    syncHud();
  }

  function spawnShards(x, y) {
    var scene = game.scene.scenes[0];
    for (var i = 0; i < 12; i += 1) {
      var shard = scene.add.rectangle(x, y, 6, 2, 0xb5f1c3);
      (function (piece) {
        scene.tweens.add({
          targets: piece,
          x: x + Phaser.Math.Between(-60, 60),
          y: y + Phaser.Math.Between(-40, 60),
          angle: Phaser.Math.Between(-180, 180),
          alpha: 0,
          duration: 600,
          onComplete: function () {
            piece.destroy();
          },
        });
      })(shard);
    }
  }

  function remainingBottles() {
    return bottles.filter(function (bottle) {
      return bottle.alive;
    }).length;
  }

  function slotX(col) {
    var config = levelConfig();
    var totalWidth = config.cols * BOTTLE_WIDTH + (config.cols - 1) * STACK_GAP;
    var startX = WIDTH / 2 - totalWidth / 2 + BOTTLE_WIDTH / 2;
    return startX + col * (BOTTLE_WIDTH + STACK_GAP);
  }

  function slotY(row) {
    var bottom = SHELF_Y - 6;
    return bottom - row * (BOTTLE_HEIGHT - 10);
  }

  function perspectiveT(y) {
    var t = (y - PERSPECTIVE_FAR_Y) / (PERSPECTIVE_NEAR_Y - PERSPECTIVE_FAR_Y);
    return Phaser.Math.Clamp(t, 0, 1);
  }

  function perspectiveScale(y) {
    return Phaser.Math.Linear(0.78, 1.2, perspectiveT(y));
  }

  function applyPerspective(bottle) {
    var t = perspectiveT(bottle.worldY);
    var centerX = WIDTH / 2;
    var xCompression = Phaser.Math.Linear(0.78, 1.0, t);
    bottle.screenX = centerX + (bottle.worldX - centerX) * xCompression;
    bottle.screenY = bottle.worldY;
    bottle.scale = perspectiveScale(bottle.worldY);
    bottle.sprite.setScale(bottle.scale);
    bottle.sprite.x = bottle.screenX;
    bottle.sprite.y = bottle.screenY;
  }

  function collapseColumn(col) {
    var alive = bottles
      .filter(function (bottle) {
        return bottle.alive && bottle.col === col;
      })
      .sort(function (a, b) {
        return a.row - b.row;
      });

    for (var i = 0; i < alive.length; i += 1) {
      if (alive[i].row !== i) {
        alive[i].row = i;
        alive[i].dropping = true;
        alive[i].dropTargetY = slotY(i);
        alive[i].vy = Phaser.Math.Between(-40, 20);
        alive[i].wiggle = Phaser.Math.Between(-60, 60);
      }
    }
  }

  function shatterBottle(bottle, launched) {
    bottle.alive = false;
    bottle.dropping = false;
    bottle.falling = true;
    bottle.vx = launched ? Phaser.Math.Between(-120, 120) : Phaser.Math.Between(-40, 40);
    bottle.vy = launched ? Phaser.Math.Between(-280, -160) : Phaser.Math.Between(-180, -120);
    bottle.vr = Phaser.Math.FloatBetween(-4, 4);

    bottle.sprite.clear();
    bottle.sprite.fillStyle(0x8ad4a6, 1);
    bottle.sprite.fillRoundedRect(-12, -48, 24, 52, 8);
    bottle.sprite.lineStyle(2, 0xf9f3d1, 0.6);
    bottle.sprite.strokeRoundedRect(-12, -48, 24, 52, 8);

    spawnShards(bottle.screenX, bottle.screenY - 40);

    if (!levelComplete && remainingBottles() === 0) {
      levelComplete = true;
      score += 250;
      cash += 50;
      syncHud();
      refreshShop();
    }
  }

  function applyWiggleImpact(activeBottle) {
    for (var i = 0; i < bottles.length; i += 1) {
      var other = bottles[i];
      if (!other.alive || other === activeBottle || other.falling || other.dropping) {
        continue;
      }
      var dx = activeBottle.worldX - other.worldX;
      var dy = activeBottle.worldY - other.worldY;
      if (Math.abs(dx) < BOTTLE_WIDTH * 0.9 && Math.abs(dy) < BOTTLE_HEIGHT * 0.6) {
        var push = dx >= 0 ? 60 : -60;
        other.wiggle = Phaser.Math.Clamp(other.wiggle + push, -140, 140);
        other.worldX += push * 0.02;
        if (Math.abs(activeBottle.vy) > 90 || Math.abs(activeBottle.wiggle) > 70) {
          other.dropping = true;
          other.dropTargetY = TABLE_Y - 20;
          other.vy = Phaser.Math.Between(-60, 40);
          other.wiggle = Phaser.Math.Between(-80, 80);
        }
      }
    }
  }

  function applyWander(bottleItem, baseY, speed) {
    var bounds = wanderBounds();
    bottleItem.worldX += bottleItem.wanderVX * speed;
    bottleItem.worldY += bottleItem.wanderVY * speed;

    bottleItem.wanderVX += Phaser.Math.FloatBetween(-WANDER_JITTER, WANDER_JITTER) * speed;
    bottleItem.wanderVY += Phaser.Math.FloatBetween(-WANDER_JITTER, WANDER_JITTER) * speed;
    bottleItem.wanderVX = Phaser.Math.Clamp(bottleItem.wanderVX, -WANDER_SPEED, WANDER_SPEED);
    bottleItem.wanderVY = Phaser.Math.Clamp(bottleItem.wanderVY, -WANDER_SPEED, WANDER_SPEED);

    if (bottleItem.worldX < bounds.minX || bottleItem.worldX > bounds.maxX) {
      bottleItem.wanderVX *= -1;
      bottleItem.worldX = Phaser.Math.Clamp(bottleItem.worldX, bounds.minX, bounds.maxX);
    }
    if (bottleItem.worldY < bounds.minY || bottleItem.worldY > bounds.maxY) {
      bottleItem.wanderVY *= -1;
      bottleItem.worldY = Phaser.Math.Clamp(bottleItem.worldY, bounds.minY, bounds.maxY);
    }

    bottleItem.worldY = Phaser.Math.Clamp(bottleItem.worldY, baseY - 20, baseY + 20);
  }

  function wanderBounds() {
    return {
      minX: WIDTH * 0.2,
      maxX: WIDTH * 0.8,
      minY: SHELF_Y - 90,
      maxY: SHELF_Y + 30,
    };
  }

  function levelConfig() {
    return levels[Math.min(level - 1, levels.length - 1)];
  }

  function advanceLevel(scene) {
    if (!levelComplete) {
      notify("Clear the stack first.");
      return;
    }
    level += 1;
    resetStack(scene);
    refreshShop();
    syncHud();
  }

  function refreshShop() {
    Object.keys(upgrades).forEach(function (key) {
      var btn = upgradeButtons[key];
      if (!btn) {
        return;
      }
      var levelText = upgrades[key] + 1;
      if (upgrades[key] >= 3) {
        btn.textContent = btn.textContent.split(" (")[0] + " (MAX)";
        return;
      }
      var cost = upgradeCost(key);
      btn.textContent = btn.textContent.split(" (")[0] + " (Lv " + levelText + ", $" + cost + ")";
    });
    refreshWeaponButton();
  }

  function upgradeCost(key) {
    var base = { fireRate: 120, bulletSpeed: 140, stability: 160 }[key] || 100;
    var current = upgrades[key] || 0;
    return base + current * 80;
  }

  function buyUpgrade(key) {
    if (!upgrades.hasOwnProperty(key)) {
      return;
    }
    var cost = upgradeCost(key);
    if (cash < cost || upgrades[key] >= 3) {
      if (upgrades[key] >= 3) {
        notify("Upgrade maxed.");
      } else {
        notify("Need $" + cost + ".");
      }
      return;
    }
    cash -= cost;
    upgrades[key] += 1;
    refreshShop();
    syncHud();
  }

  function syncHud() {
    var accuracy = shots > 0 ? Math.round((hits / shots) * 100) : 0;

    if (levelEl) {
      levelEl.textContent = "Level: " + level;
    }
    if (cashEl) {
      cashEl.textContent = "Cash: $" + cash;
    }
    if (scoreEl) {
      scoreEl.textContent = "Score: " + score;
    }
    if (shotsEl) {
      shotsEl.textContent = "Shots: " + shots;
    }
    if (accuracyEl) {
      accuracyEl.textContent = "Accuracy: " + accuracy + "%";
    }
    if (bottlesEl) {
      bottlesEl.textContent = "Bottles: " + remainingBottles();
    }
  }

  function spawnBullet(scene, originX, originY, angle, speed, hitScale) {
    var bulletShape = scene.add.circle(originX, originY, 4, 0xffe3b4);
    bullets.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.1,
      hitScale: hitScale,
      shape: bulletShape,
    });
  }

  function toggleWeapon() {
    if (shotgunPurchased) {
      return;
    }
    if (cash < shotgunCost) {
      notify("Need $" + shotgunCost + " for Shotgun.");
      return;
    }
    cash -= shotgunCost;
    shotgunPurchased = true;
    weaponMode = "shotgun";
    refreshWeaponButton();
    syncHud();
  }

  function refreshWeaponButton() {
    if (!shotgunBtn) {
      return;
    }
    if (shotgunPurchased) {
      shotgunBtn.textContent = "Weapon: Shotgun";
      shotgunBtn.disabled = true;
    } else {
      shotgunBtn.textContent = "Upgrade: Shotgun ($" + shotgunCost + ")";
      shotgunBtn.disabled = false;
    }
  }


  function notify(message) {
    if (!noticeText) {
      return;
    }
    noticeText.setText(message);
    noticeText.setAlpha(1);
    game.scene.scenes[0].tweens.add({
      targets: noticeText,
      alpha: 0,
      duration: 900,
      delay: 700,
    });
  }
})();
