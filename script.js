const gameRoot = document.getElementById("game");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");

(function bootstrap(threeRef) {
  if (!threeRef) {
    statusEl.textContent = "3D engine failed to load. Check your internet connection.";
    statusEl.classList.add("game-over");
    return;
  }

  const THREE = threeRef;
  const tileCount = 20;
  const initialSpeedMs = 130;
  const minSpeedMs = 65;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111825);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  camera.position.set(0, 22, 20);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  gameRoot.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(8, 18, 6);
  scene.add(keyLight);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(tileCount + 2, tileCount + 2),
    new THREE.MeshStandardMaterial({ color: 0x182132, roughness: 0.95, metalness: 0.05 })
  );
  board.rotation.x = -Math.PI / 2;
  board.position.y = -0.5;
  scene.add(board);

  const grid = new THREE.GridHelper(tileCount, tileCount, 0x2e3b52, 0x2e3b52);
  grid.position.y = -0.49;
  scene.add(grid);

  const snakeGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const foodGeometry = new THREE.BoxGeometry(0.75, 0.75, 0.75);
  const snakeBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x42d392 });
  const snakeHeadMaterial = new THREE.MeshStandardMaterial({ color: 0x2ab57a });
  const foodMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b });

  const foodMesh = new THREE.Mesh(foodGeometry, foodMaterial);
  scene.add(foodMesh);

  const snakeMeshes = [];
  let snake;
  let direction;
  let nextDirection;
  let food;
  let score;
  let bestScore = Number(localStorage.getItem("snake-best-score") || 0);
  let gameLoop = null;
  let isRunning = false;
  let isGameOver = false;
  let speedMs = initialSpeedMs;
  let audioCtx = null;

  bestScoreEl.textContent = String(bestScore);

  function resizeRenderer() {
    const width = gameRoot.clientWidth;
    const height = gameRoot.clientHeight;
    if (!width || !height) {
      return;
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }

  function gridToWorld(position) {
    const offset = (tileCount - 1) / 2;
    return {
      x: position.x - offset,
      z: position.y - offset,
    };
  }

  function syncSnakeMeshes() {
    while (snakeMeshes.length < snake.length) {
      const mesh = new THREE.Mesh(snakeGeometry, snakeBodyMaterial);
      scene.add(mesh);
      snakeMeshes.push(mesh);
    }

    while (snakeMeshes.length > snake.length) {
      const mesh = snakeMeshes.pop();
      scene.remove(mesh);
    }

    for (let i = 0; i < snakeMeshes.length; i += 1) {
      const mesh = snakeMeshes[i];
      const position = gridToWorld(snake[i]);
      mesh.position.set(position.x, 0, position.z);
      mesh.material = i === 0 ? snakeHeadMaterial : snakeBodyMaterial;
    }
  }

  function syncFoodMesh() {
    const position = gridToWorld(food);
    foodMesh.position.set(position.x, 0, position.z);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function playEatSound() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.06);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  function resetGame() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    food = randomFoodPosition();
    score = 0;
    speedMs = initialSpeedMs;
    isGameOver = false;
    isRunning = false;
    scoreEl.textContent = "0";
    statusEl.textContent = "Press SPACE or any direction key to start";
    statusEl.classList.remove("game-over");
    stopLoop();
    syncSnakeMeshes();
    syncFoodMesh();
    render();
  }

  function startLoop() {
    if (gameLoop) {
      return;
    }
    gameLoop = setInterval(tick, speedMs);
  }

  function restartLoop() {
    stopLoop();
    gameLoop = setInterval(tick, speedMs);
  }

  function stopLoop() {
    if (!gameLoop) {
      return;
    }
    clearInterval(gameLoop);
    gameLoop = null;
  }

  function randomFoodPosition() {
    let position;
    do {
      position = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
      };
    } while (snake && snake.some((segment) => segment.x === position.x && segment.y === position.y));
    return position;
  }

  function hitsSelf(head) {
    return snake.some((segment) => segment.x === head.x && segment.y === head.y);
  }

  function gameOver() {
    isGameOver = true;
    isRunning = false;
    stopLoop();
    statusEl.textContent = `Game over. Final score: ${score}. Press SPACE or Restart to play again.`;
    statusEl.classList.add("game-over");
    render();
  }

  function tick() {
    if (isGameOver) {
      return;
    }

    direction = nextDirection;
    const head = {
      x: (snake[0].x + direction.x + tileCount) % tileCount,
      y: (snake[0].y + direction.y + tileCount) % tileCount,
    };

    if (hitsSelf(head)) {
      gameOver();
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 1;
      scoreEl.textContent = String(score);
      food = randomFoodPosition();
      playEatSound();

      if (speedMs > minSpeedMs) {
        speedMs -= 3;
        restartLoop();
      }

      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("snake-best-score", String(bestScore));
        bestScoreEl.textContent = String(bestScore);
      }
    } else {
      snake.pop();
    }

    syncSnakeMeshes();
    syncFoodMesh();
    render();
  }

  function canChangeDirection(candidate) {
    return !(candidate.x === -direction.x && candidate.y === -direction.y);
  }

  function handleDirectionInput(inputDirection) {
    if (!canChangeDirection(inputDirection) || isGameOver) {
      return;
    }
    nextDirection = inputDirection;
    if (!isRunning) {
      isRunning = true;
      statusEl.textContent = "";
      startLoop();
    }
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key.startsWith("arrow") || event.code === "Space") {
      event.preventDefault();
    }

    if (event.code === "Space") {
      if (isGameOver) {
        resetGame();
      }
      if (!isRunning) {
        isRunning = true;
        statusEl.textContent = "";
        startLoop();
      }
      return;
    }

    switch (key) {
      case "arrowup":
      case "w":
        handleDirectionInput({ x: 0, y: -1 });
        break;
      case "arrowdown":
      case "s":
        handleDirectionInput({ x: 0, y: 1 });
        break;
      case "arrowleft":
      case "a":
        handleDirectionInput({ x: -1, y: 0 });
        break;
      case "arrowright":
      case "d":
        handleDirectionInput({ x: 1, y: 0 });
        break;
      default:
        break;
    }
  });

  restartBtn.addEventListener("click", resetGame);
  window.addEventListener("resize", resizeRenderer);

  resizeRenderer();
  resetGame();
})(window.THREE);
