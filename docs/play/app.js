// AI Quest: Sudoku Edition — a gamified, animated tour of the same five
// algorithms from the AI Lab page. Reuses Board (board.js) for grid logic;
// each mission has its own lightweight, animation-friendly implementation
// of its algorithm so it can pause and narrate itself step by step.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MISSIONS = [
  { id: "play", emoji: "🎮", title: "Try It Yourself", sub: "Free play — feel the puzzle" },
  { id: "backtracking", emoji: "🔍", title: "Backtracking", sub: "Exact search, step by step" },
  { id: "neural_net", emoji: "🧠", title: "Neural Net", sub: "Gradient descent, live" },
  { id: "q_learning", emoji: "🎯", title: "Q-Learning", sub: "Trial, error, reward" },
  { id: "genetic", emoji: "🧬", title: "Genetic Algorithm", sub: "Survival of the fittest grid" },
  { id: "annealing", emoji: "🔥", title: "Simulated Annealing", sub: "Cooling down to a solution" },
];

const STAGE_INTRO = {
  play: {
    title: "🎮 Try It Yourself",
    tagline: "Before any AI touches this puzzle — can you beat it?",
    body: `<p>Click a cell to cycle through digits 1–9 (blue cells are locked clues). Fill the whole board with no repeats in any row, column or 3×3 box to win.</p>
           <p>This is the same problem every algorithm to the left is about to attack in a completely different way. Notice how <em>you</em> solve it — do you guess and erase? That's basically backtracking with a brain.</p>`,
    button: "New Puzzle",
  },
  backtracking: {
    title: "🔍 Backtracking",
    tagline: "Try a digit. If it breaks a rule, undo and try the next one.",
    body: `<p>Watch the orange cell try digits one at a time. If every option leads to a dead end somewhere down the line, it backs up and tries something different earlier — exactly like working a real Sudoku in pencil.</p>
           <p><strong>No learning involved</strong> — every move is checked against the rules directly, so this always finds the answer.</p>`,
    button: "Run Backtracking",
  },
  neural_net: {
    title: "🧠 Neural Net (Gradient Descent)",
    tagline: "A tiny brain trains itself, live, in your browser.",
    body: `<p>First, watch the loss go down — that's <strong>gradient descent</strong>: the network adjusting its internal numbers a little bit at a time to get less wrong.</p>
           <p>Then watch it guess digits — green means confident, and if a guess turns out wrong later, it backs up just like backtracking does.</p>`,
    button: "Train & Solve",
  },
  q_learning: {
    title: "🎯 Reinforcement Learning",
    tagline: "No answer key — just rewards and punishments.",
    body: `<p>This agent plays the puzzle hundreds of times against itself, getting <span style="color:var(--good)">+reward</span> for legal placements and <span style="color:var(--bad)">−penalty</span> for conflicts. Nobody ever tells it the rules directly.</p>
           <p>Watch the conflict count drop across training episodes, then see its final attempt.</p>`,
    button: "Train & Attempt",
  },
  genetic: {
    title: "🧬 Genetic Algorithm",
    tagline: "150 candidate grids. Survival of the fittest.",
    body: `<p>A whole population of random grids competes. The best ones breed (mixing rows together) and mutate slightly. Over generations, the population gets fitter — fewer rule conflicts.</p>
           <p>Watch the best grid in the population evolve in real time.</p>`,
    button: "Evolve Population",
  },
  annealing: {
    title: "🔥 Simulated Annealing",
    tagline: "One grid, taking a random walk that cools down over time.",
    body: `<p>Early on (hot 🔥), the search accepts moves that make things <em>worse</em> on purpose, to avoid getting stuck. As it "cools," it gets pickier, until it's only accepting improvements.</p>
           <p>Watch the temperature gauge fall as conflicts shrink.</p>`,
    button: "Start Annealing",
  },
};

let state = { xp: 0, completed: [] };
let currentMission = null;
let running = false;
let grid = Board.emptyGrid();
let fixed = Board.emptyGrid().map((row) => row.map(() => false));
let gridBuilt = false;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("sudoku-ai-quest-v1") || "{}");
    state.xp = saved.xp || 0;
    state.completed = saved.completed || [];
  } catch (e) { /* ignore corrupt storage */ }
}

function saveState() {
  localStorage.setItem("sudoku-ai-quest-v1", JSON.stringify(state));
}

function renderHeader() {
  document.getElementById("xpValue").textContent = state.xp;
  const row = document.getElementById("badgeRow");
  row.innerHTML = MISSIONS.filter((m) => m.id !== "play").map((m) => {
    const earned = state.completed.includes(m.id);
    return `<div class="badge-icon ${earned ? "earned" : ""}" title="${m.title}">${m.emoji}</div>`;
  }).join("");
}

function awardMission(id, fullAmount = 50, repeatAmount = 5) {
  if (!state.completed.includes(id)) {
    state.completed.push(id);
    state.xp += fullAmount;
    celebrate();
  } else {
    state.xp += repeatAmount;
  }
  saveState();
  renderHeader();
  buildMissionMap();
}

function celebrate() {
  const layer = document.getElementById("confettiLayer");
  const emojis = ["🎉", "✨", "🎊", "⭐", "🟣"];
  for (let i = 0; i < 26; i++) {
    const span = document.createElement("span");
    span.className = "confetti-piece";
    span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    span.style.left = `${Math.random() * 100}vw`;
    span.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    span.style.fontSize = `${14 + Math.random() * 14}px`;
    layer.appendChild(span);
    setTimeout(() => span.remove(), 3200);
  }
}

function buildMissionMap() {
  const map = document.getElementById("missionMap");
  map.innerHTML = "";
  MISSIONS.forEach((m) => {
    const card = document.createElement("div");
    card.className = `mission-card${currentMission === m.id ? " active" : ""}`;
    const done = state.completed.includes(m.id);
    card.innerHTML = `
      <div class="m-emoji">${m.emoji}</div>
      ${done ? '<span class="m-done">✓</span>' : ""}
      <div class="m-title">${m.title}</div>
      <div class="m-sub">${m.sub}</div>
    `;
    card.addEventListener("click", () => selectMission(m.id));
    map.appendChild(card);
  });
}

function selectMission(id) {
  if (running) return;
  currentMission = id;
  buildMissionMap();
  const intro = STAGE_INTRO[id];
  document.getElementById("stageTitle").textContent = intro.title;
  document.getElementById("stageTagline").textContent = intro.tagline;
  document.getElementById("stageBody").innerHTML = intro.body;
  document.getElementById("stageLog").innerHTML = "";
  document.getElementById("stageStat1").textContent = "";
  document.getElementById("stageStat2").textContent = "";
  const runBtn = document.getElementById("runBtn");
  runBtn.textContent = intro.button;
  runBtn.disabled = false;
  document.getElementById("speedWrap").style.display = id === "play" ? "none" : "flex";

  if (id === "play") {
    newFreePlayPuzzle();
  } else {
    const clueCounts = { backtracking: 50, neural_net: 53, q_learning: 42, genetic: 42, annealing: 42 };
    const { puzzle } = Board.generatePuzzle(clueCounts[id] || 42);
    grid = puzzle.map((row) => row.slice());
    fixed = puzzle.map((row) => row.map((v) => v !== 0));
    renderMiniGrid();
  }
}

function buildMiniGrid() {
  const el = document.getElementById("miniGrid");
  el.innerHTML = "";
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement("div");
      cell.className = "mg-cell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener("click", () => {
        if (currentMission !== "play" || fixed[r][c]) return;
        grid[r][c] = grid[r][c] >= 9 ? 0 : grid[r][c] + 1;
        renderMiniGrid();
        checkFreePlayWin();
      });
      el.appendChild(cell);
    }
  }
  gridBuilt = true;
}

function renderMiniGrid(highlight) {
  if (!gridBuilt) buildMiniGrid();
  const conflictSet = currentMission === "play" ? computeConflictSet(grid) : null;
  document.querySelectorAll(".mg-cell").forEach((cell) => {
    const r = parseInt(cell.dataset.r, 10), c = parseInt(cell.dataset.c, 10);
    const v = grid[r][c];
    cell.textContent = v === 0 ? "" : v;
    cell.classList.remove("clue", "filled", "trying", "conflict", "success-flash");
    if (fixed[r][c]) cell.classList.add("clue");
    else if (v !== 0) cell.classList.add("filled");
    if (conflictSet && conflictSet.has(`${r},${c}`)) cell.classList.add("conflict");
  });
  if (highlight && highlight.current) {
    const [r, c] = highlight.current;
    const cell = document.querySelector(`.mg-cell[data-r="${r}"][data-c="${c}"]`);
    if (cell && highlight.state) cell.classList.add(highlight.state);
  }
  if (highlight && highlight.flashAll) {
    document.querySelectorAll(".mg-cell").forEach((cell) => cell.classList.add("success-flash"));
  }
}

function computeConflictSet(g) {
  const conflictCells = new Set();
  function markDuplicates(cellList) {
    const seen = new Map();
    for (const [r, c] of cellList) {
      const v = g[r][c];
      if (v === 0) continue;
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v).push([r, c]);
    }
    for (const coords of seen.values()) if (coords.length > 1) coords.forEach(([r, c]) => conflictCells.add(`${r},${c}`));
  }
  for (let i = 0; i < 9; i++) {
    markDuplicates([...Array(9).keys()].map((c) => [i, c]));
    markDuplicates([...Array(9).keys()].map((r) => [r, i]));
  }
  for (let br = 0; br < 9; br += 3) for (let bc = 0; bc < 9; bc += 3) {
    const cells = [];
    for (let i = br; i < br + 3; i++) for (let j = bc; j < bc + 3; j++) cells.push([i, j]);
    markDuplicates(cells);
  }
  return conflictCells;
}

function newFreePlayPuzzle() {
  const { puzzle } = Board.generatePuzzle(36);
  grid = puzzle.map((row) => row.slice());
  fixed = puzzle.map((row) => row.map((v) => v !== 0));
  renderMiniGrid();
  log("New puzzle loaded. Good luck!");
}

function checkFreePlayWin() {
  if (Board.isComplete(grid) && Board.conflictsCount(grid) === 0) {
    log("You solved it yourself! 🎉", "win");
    renderMiniGrid({ flashAll: true });
    awardMission("play");
  }
}

function log(text, cls) {
  const logEl = document.getElementById("stageLog");
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStats(s1, s2) {
  document.getElementById("stageStat1").innerHTML = s1 || "";
  document.getElementById("stageStat2").innerHTML = s2 || "";
}

function getSpeed() {
  return parseInt(document.getElementById("speedSlider").value, 10);
}

function setRunning(isRunning, label) {
  running = isRunning;
  const btn = document.getElementById("runBtn");
  btn.disabled = isRunning;
  if (isRunning) btn.textContent = label || "Running...";
  else btn.textContent = STAGE_INTRO[currentMission].button;
}

// ---- Mission: Backtracking ------------------------------------------------
async function runBacktracking() {
  setRunning(true, "Searching...");
  log("Starting backtracking search...");
  let steps = 0;
  const HARD_CAP = 6000;

  async function bt() {
    if (steps > HARD_CAP) return false;
    let target = null;
    for (let r = 0; r < 9 && !target; r++)
      for (let c = 0; c < 9; c++) if (grid[r][c] === 0) { target = [r, c]; break; }
    if (!target) return true;
    const [r, c] = target;
    const cands = [...Board.candidates(grid, r, c)];
    for (const val of cands) {
      steps++;
      grid[r][c] = val;
      renderMiniGrid({ current: [r, c], state: "trying" });
      setStats(`Steps: <strong>${steps}</strong>`, `Trying <strong>${val}</strong> at row ${r + 1}, col ${c + 1}`);
      await sleep(getSpeed());
      if (await bt()) return true;
      grid[r][c] = 0;
      renderMiniGrid({ current: [r, c], state: "conflict" });
      if (steps % 4 === 0) log(`Dead end near row ${r + 1}, col ${c + 1} — backtracking`);
      await sleep(getSpeed() / 2);
    }
    return false;
  }

  const solved = await bt();
  if (solved) {
    renderMiniGrid({ flashAll: true });
    log(`Solved in ${steps} tries! 🎉`, "win");
    awardMission("backtracking");
  } else {
    log("Hit the safety cap — try again for a different puzzle.");
  }
  setRunning(false);
}

// ---- Mission: Neural Net ---------------------------------------------------
async function runNeuralNet() {
  setRunning(true, "Training...");
  log("Training a tiny neural net (243 → 32 → 9) from scratch...");
  const { net } = await SolverNeuralNet.train({ numPuzzles: 25, epochs: 5 }, (epoch, loss) => {
    setStats(`Epoch <strong>${epoch + 1}/5</strong>`, `Loss: <strong>${loss.toFixed(3)}</strong>`);
    log(`Epoch ${epoch + 1}: loss ${loss.toFixed(3)} (lower = more confident)`);
  });
  log("Training done. Now guiding a search with its predictions...");
  await sleep(300);

  let solved = false;
  let attempts = 0;
  const ATTEMPT_CAP = 1500;
  async function attempt() {
    if (++attempts > ATTEMPT_CAP) return false;
    const empties = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] === 0) empties.push([r, c]);
    if (empties.length === 0) return true;

    let best = null, bestRanked = null, bestConf = -1;
    for (const [r, c] of empties) {
      const cands = Board.candidates(grid, r, c);
      if (cands.size === 0) return false;
      const probs = net.predictProba(SolverNeuralNet.encodeCell(grid, r, c));
      const ranked = [...cands].map((d) => [probs[d - 1], d]).sort((a, b) => b[0] - a[0]);
      if (ranked[0][0] > bestConf) { best = [r, c]; bestRanked = ranked; bestConf = ranked[0][0]; }
    }
    const [r, c] = best;
    for (const [conf, digit] of bestRanked) {
      grid[r][c] = digit;
      renderMiniGrid({ current: [r, c], state: "trying" });
      setStats(`Confidence: <strong>${(conf * 100).toFixed(0)}%</strong>`, `Guessing <strong>${digit}</strong> at row ${r + 1}, col ${c + 1}`);
      await sleep(getSpeed());
      if (await attempt()) return true;
    }
    grid[r][c] = 0;
    renderMiniGrid({ current: [r, c], state: "conflict" });
    return false;
  }

  solved = await attempt();
  if (solved) {
    renderMiniGrid({ flashAll: true });
    log("Solved with neural-net-guided search! 🎉", "win");
    awardMission("neural_net");
  } else {
    log("This net got unlucky and hit a wall — hit Train & Solve again for a fresh net.");
  }
  setRunning(false);
}

// ---- Mission: Q-Learning ----------------------------------------------------
async function runQLearning() {
  setRunning(true, "Training agent...");
  log("Letting an agent play this puzzle 250 times, learning from rewards only...");
  await sleep(100);
  const { Q, getQ, history } = SolverQLearning.trainAgent(grid, { episodes: 250 });
  const before = history[0], after = history[history.length - 1];
  setStats(`Conflicts before learning: <strong>${before}</strong>`, `After 250 episodes: <strong>${after}</strong>`);
  log(`Training curve: started at ${before} conflicts/episode, ended near ${after}.`);
  await sleep(400);

  log("Now watching its best (greedy) attempt, cell by cell...");
  const emptyCells = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] === 0) emptyCells.push([r, c]);
  Board.shuffle(emptyCells);

  for (const [r, c] of emptyCells) {
    const qVals = getQ(stateKeyForDisplay(grid, r, c));
    let bestI = 0;
    for (let i = 1; i < 9; i++) if (qVals[i] > qVals[bestI]) bestI = i;
    grid[r][c] = bestI + 1;
    const conflictHere = computeConflictSet(grid).has(`${r},${c}`);
    renderMiniGrid({ current: [r, c], state: conflictHere ? "conflict" : "trying" });
    log(`Placed ${bestI + 1} at row ${r + 1}, col ${c + 1} ${conflictHere ? "(conflict)" : "(reward +1)"}`);
    await sleep(getSpeed());
  }

  const finalConflicts = Board.conflictsCount(grid);
  setStats(`Final conflicts: <strong>${finalConflicts}</strong>`, "");
  if (finalConflicts === 0 && Board.isComplete(grid)) {
    renderMiniGrid({ flashAll: true });
    log("Solved with zero conflicts! 🎉", "win");
    awardMission("q_learning");
  } else {
    log(`Finished with ${finalConflicts} conflicts — a real, honest limitation of tabular RL on a big puzzle.`);
    awardMission("q_learning", 30, 5);
  }
  setRunning(false);
}

function stateKeyForDisplay(g, r, c) {
  // Mirrors SolverQLearning's internal state key so getQ() finds the same entries.
  const rowUsed = g[r].filter((v) => v !== 0).slice().sort().join(",");
  const colUsed = [];
  for (let i = 0; i < 9; i++) if (g[i][c] !== 0) colUsed.push(g[i][c]);
  const [br, bc] = Board.boxOrigin(r, c);
  const boxUsed = [];
  for (let i = br; i < br + 3; i++) for (let j = bc; j < bc + 3; j++) if (g[i][j] !== 0) boxUsed.push(g[i][j]);
  return `${rowUsed}|${colUsed.sort().join(",")}|${boxUsed.sort().join(",")}`;
}

// ---- Mission: Genetic Algorithm ---------------------------------------------
async function runGenetic() {
  setRunning(true, "Evolving...");
  log("Spawning a population of 120 random grids...");
  const freeByBox = SolverGenetic.freeCellsByBox(grid);
  let population = Array.from({ length: 120 }, () => SolverGenetic.randomIndividual(grid, freeByBox));
  const fitness = (g) => -Board.conflictsCount(g);
  const crossover = (p1, p2) => {
    const child = [];
    for (let r = 0; r < 9; r++) child.push((Math.random() < 0.5 ? p1[r] : p2[r]).slice());
    return child;
  };
  const mutate = (g, rate) => {
    for (const cells of freeByBox.values()) {
      if (cells.length >= 2 && Math.random() < rate) {
        const [i1, i2] = Board.shuffle([...cells.keys()]).slice(0, 2);
        const [r1, c1] = cells[i1], [r2, c2] = cells[i2];
        [g[r1][c1], g[r2][c2]] = [g[r2][c2], g[r1][c1]];
      }
    }
  };
  const tournament = (pop, fits, k = 4) => {
    let bestIdx = -1, bestFit = -Infinity;
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(Math.random() * pop.length);
      if (fits[idx] > bestFit) { bestFit = fits[idx]; bestIdx = idx; }
    }
    return pop[bestIdx];
  };

  let bestGrid = null, bestFit = -Infinity, gen = 0;
  const maxGen = 600;
  for (gen = 0; gen < maxGen; gen++) {
    const fits = population.map(fitness);
    let genBest = 0;
    for (let i = 1; i < fits.length; i++) if (fits[i] > fits[genBest]) genBest = i;
    if (fits[genBest] > bestFit) { bestFit = fits[genBest]; bestGrid = population[genBest].map((r) => r.slice()); }

    if (gen % 6 === 0 || bestFit === 0) {
      grid = bestGrid.map((r) => r.slice());
      renderMiniGrid();
      setStats(`Generation: <strong>${gen + 1}</strong>`, `Best conflicts: <strong>${-bestFit}</strong>`);
      if (gen % 30 === 0) log(`Generation ${gen + 1}: best grid has ${-bestFit} conflicts`);
      await sleep(Math.max(getSpeed() / 4, 5));
    }
    if (bestFit === 0) break;

    const next = [bestGrid.map((r) => r.slice())];
    while (next.length < population.length) {
      const child = crossover(tournament(population, fits), tournament(population, fits));
      mutate(child, 0.15);
      next.push(child);
    }
    population = next;
  }

  grid = bestGrid;
  if (bestFit === 0) {
    renderMiniGrid({ flashAll: true });
    log(`Solved after ${gen + 1} generations! 🎉`, "win");
    awardMission("genetic");
  } else {
    renderMiniGrid();
    log(`Stopped after ${maxGen} generations with ${-bestFit} conflicts — genetic algorithms often plateau just short of perfect.`);
    awardMission("genetic", 30, 5);
  }
  setRunning(false);
}

// ---- Mission: Simulated Annealing -------------------------------------------
async function runAnnealing() {
  setRunning(true, "Cooling...");
  log("Starting hot — accepting bad moves freely to explore...");
  const freeByBox = SolverGenetic.freeCellsByBox(grid);
  let current = SolverGenetic.randomIndividual(grid, freeByBox);
  let currentCost = Board.conflictsCount(current);
  let bestGrid = current.map((r) => r.slice()), bestCost = currentCost;
  let temp = 2.0;
  const coolingRate = 0.999;
  const boxesWithSwaps = [...freeByBox.values()].filter((cells) => cells.length >= 2);

  let step = 0;
  const maxSteps = 40000;
  while (step < maxSteps && temp > 0.001 && bestCost > 0) {
    const cells = boxesWithSwaps[Math.floor(Math.random() * boxesWithSwaps.length)];
    const [i1, i2] = Board.shuffle([...cells.keys()]).slice(0, 2);
    const [r1, c1] = cells[i1], [r2, c2] = cells[i2];
    [current[r1][c1], current[r2][c2]] = [current[r2][c2], current[r1][c1]];
    const newCost = Board.conflictsCount(current);
    const delta = newCost - currentCost;
    const accept = delta <= 0 || Math.random() < Math.exp(-delta / Math.max(temp, 1e-9));
    if (accept) {
      currentCost = newCost;
      if (currentCost < bestCost) { bestCost = currentCost; bestGrid = current.map((r) => r.slice()); }
    } else {
      [current[r1][c1], current[r2][c2]] = [current[r2][c2], current[r1][c1]];
    }
    temp *= coolingRate;
    step++;

    if (step % 30 === 0) {
      grid = current.map((r) => r.slice());
      renderMiniGrid();
      const heat = temp > 1 ? "🔥🔥🔥" : temp > 0.3 ? "🔥🔥" : temp > 0.05 ? "🔥" : "❄️";
      setStats(`Temperature: <strong>${temp.toFixed(3)}</strong> ${heat}`, `Conflicts: <strong>${currentCost}</strong> (best ${bestCost})`);
      if (step % 1500 === 0) log(`Step ${step}: temp ${temp.toFixed(3)}, ${currentCost} conflicts`);
      await sleep(Math.max(getSpeed() / 6, 3));
    }
  }

  grid = bestGrid;
  if (bestCost === 0) {
    renderMiniGrid({ flashAll: true });
    log(`Cooled to a perfect solution in ${step} steps! 🎉`, "win");
    awardMission("annealing");
  } else {
    renderMiniGrid();
    log(`Ran out of steps with ${bestCost} conflicts remaining — try again, randomness varies.`);
    awardMission("annealing", 30, 5);
  }
  setRunning(false);
}

const RUNNERS = {
  backtracking: runBacktracking,
  neural_net: runNeuralNet,
  q_learning: runQLearning,
  genetic: runGenetic,
  annealing: runAnnealing,
};

document.getElementById("runBtn").addEventListener("click", () => {
  if (!currentMission || running) return;
  if (currentMission === "play") { newFreePlayPuzzle(); return; }
  RUNNERS[currentMission]();
});

loadState();
renderHeader();
buildMissionMap();
buildMiniGrid();
selectMission("play");
