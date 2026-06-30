const EXPLANATIONS = {
  backtracking: "Exact depth-first search with constraint propagation. " +
    "Used as the ground-truth baseline (not a learning method).",
  neural_net: "A feedforward neural network (243-64-9) trained from scratch in " +
    "your browser with mini-batch gradient descent and manual backpropagation " +
    "to predict the most likely digit per cell, used to guide a search.",
  q_learning: "A tabular Q-Learning agent learns, purely through trial-and-error " +
    "rewards (no labelled answers), which digit to place in each cell " +
    "to minimise constraint violations.",
  genetic: "Evolves a population of candidate grids using selection, " +
    "row-crossover and mutation, guided by a conflict-count fitness function.",
  annealing: "A single solution takes a temperature-controlled random walk, " +
    "occasionally accepting worse moves to escape local optima, " +
    "cooling over time into a greedy search.",
};

const METHODS = [
  { id: "backtracking", label: "Backtracking (baseline)" },
  { id: "neural_net", label: "Neural Net (Gradient Descent + Backprop)" },
  { id: "q_learning", label: "Reinforcement Learning (Q-Learning)" },
  { id: "genetic", label: "Genetic Algorithm" },
  { id: "annealing", label: "Simulated Annealing" },
];

// Longer write-ups shown in the info modal — mirrors the docstrings in
// docs/static/solver_*.js and sudoku_ai/solvers/*.py, condensed for reading
// on the page rather than in source.
const DETAILS = {
  backtracking: {
    title: "Backtracking (baseline)",
    body: `
      <p><strong>Not a learning method</strong> — included as the ground-truth baseline so the
      learning-based approaches below have something exact and fast to be compared against.</p>
      <h4>Algorithm</h4>
      <ol>
        <li>Find the empty cell with the fewest legal candidates (the <em>MRV heuristic</em> — most-constrained-variable first, which prunes the search tree hard).</li>
        <li>Compute its candidates: {1..9} minus values already used in its row, column and 3×3 box.</li>
        <li>Try each candidate, recurse into the rest of the board.</li>
        <li>If a branch leads to a dead end, undo ("backtrack") and try the next candidate.</li>
      </ol>
      <p>Because every move is checked against the rules of Sudoku before it's made, this always finds a valid solution (if one exists), in milliseconds.</p>
      <h4>Where you'll see this in the real world</h4>
      <p>Compilers' type checkers, SAT/SMT solvers used in chip verification, route planners, and the constraint solvers behind scheduling and resource-allocation software all lean on the same idea: prune the search space using the rules of the problem, only backtrack when forced to.</p>
      <h4>Key takeaway</h4>
      <p>Not every problem needs "AI" in the learning sense — if you can encode the rules exactly, exact search beats anything that has to learn them. This baseline exists precisely to make that point honest.</p>`,
  },
  neural_net: {
    title: "Neural Net — Gradient Descent + Backpropagation",
    body: `
      <p>A small feedforward network (243 → 32 → 9) is trained <strong>from scratch, in your browser</strong> — no ML library, so every matrix multiply and gradient is hand-written and inspectable in <code>solver_neural_net.js</code>.</p>
      <h4>What it predicts</h4>
      <p>Not a full solution in one shot — Sudoku isn't a smooth function. Instead, given a cell's 27-cell neighbourhood (its row, column and box, one-hot encoded), the net predicts a probability distribution over digits 1–9 for that cell. The solver repeatedly fills in whichever empty cell the net is most confident about, similar to how a policy network can guide a search algorithm (e.g. AlphaZero's policy net proposing moves).</p>
      <h4>Training — gradient descent &amp; backprop, by hand</h4>
      <pre>forward:  z1 = X·W1 + b1 ;  a1 = ReLU(z1)
          z2 = a1·W2 + b2 ;  p = softmax(z2)
loss:     L = -mean(log p[correct class])
backward: dz2 = p - one_hot(y)
          dW2 = a1ᵗ·dz2 ,  db2 = mean(dz2)
          da1 = dz2·W2ᵗ ,  dz1 = da1 · (z1 &gt; 0)
          dW1 = Xᵗ·dz1 ,  db1 = mean(dz1)
update:   W -= learning_rate × dW   (descend the loss surface)</pre>
      <p>Each "Solve" click trains a fresh network on freshly generated puzzles, then uses it to guide a backtracking-style fill — if a top guess leads to a dead end, the next-most-confident digit is tried.</p>
      <h4>Where you'll see this in the real world</h4>
      <p>This exact loop — forward pass, compute loss, backpropagate, gradient-descend the weights — is how every modern neural net is trained, from a digit-recognising CNN to GPT-scale language models. The math doesn't change at scale; only the size of the matrices and the cleverness of the architecture do.</p>
      <h4>Key takeaway</h4>
      <p>A neural net learns a <em>statistical pattern</em> ("digits like this tend to go here"), not a logical rule. That's why it needs a search algorithm bolted on to guarantee correctness — a recurring theme in real systems that pair a learned model with a verifier or planner.</p>`,
  },
  q_learning: {
    title: "Reinforcement Learning — Tabular Q-Learning",
    body: `
      <p>No labelled answers are ever given to this agent — it learns purely from trial-and-error reward signals, which is the core idea that separates reinforcement learning from the supervised neural net above.</p>
      <h4>Why Q-Learning instead of PPO</h4>
      <p>PPO needs a policy network, advantage estimation and a clipped surrogate objective — a lot of moving parts. Q-Learning is the simplest algorithm that still demonstrates the essential RL loop, which makes the contrast with supervised gradient descent clearer.</p>
      <h4>MDP formulation</h4>
      <ul>
        <li><strong>State</strong>: a summary of which digits are already used in the focal cell's row, column and box.</li>
        <li><strong>Action</strong>: choose a digit 1–9 to place in that cell.</li>
        <li><strong>Reward</strong>: +1 if the placement creates zero conflicts; otherwise −(number of conflicts created); +10 bonus if the whole board ends up solved.</li>
      </ul>
      <h4>The learning rule</h4>
      <pre>Q(s, a) ← Q(s, a) + α · [ r + γ·max_a′ Q(s′, a′) − Q(s, a) ]</pre>
      <p>This is off-policy temporal-difference learning: after acting, the agent nudges its value estimate toward the observed reward plus its best guess at future value. Over many episodes with decaying epsilon-greedy exploration, the Q-table converges toward values that avoid conflicts — without ever being told the rules of Sudoku directly.</p>
      <p><strong>Limitation, by design:</strong> a per-cell tabular policy doesn't scale to the full board's combinatorics, so this often leaves some conflicts on harder puzzles — a real, honest limitation of vanilla RL on large discrete spaces.</p>
      <h4>Where you'll see this in the real world</h4>
      <p>The same reward-driven trial-and-error loop trains game-playing agents (Atari, AlphaGo's self-play), robot control policies, recommendation systems that learn from clicks, and LLM fine-tuning via RLHF — anywhere there's no labelled "correct answer" but you can score how good an outcome was.</p>
      <h4>Key takeaway</h4>
      <p>RL doesn't need anyone to tell it the right move — only whether a move was good or bad. That's powerful (it generalises to problems with no training data) and also why it's notoriously sample-inefficient: this agent needs hundreds of episodes to learn rules that backtracking enforces from line one.</p>`,
  },
  genetic: {
    title: "Genetic Algorithm",
    body: `
      <p>Inspired by biological evolution: a <em>population</em> of candidate grids evolves over generations through selection, crossover and mutation, guided only by a fitness function — no gradients, no derivatives.</p>
      <h4>Representation</h4>
      <p>Each chromosome is a full 9×9 grid. Given clues are frozen; each empty 3×3 box is filled with a random permutation of the missing digits, which automatically satisfies the box constraint and leaves row/column conflicts as the only thing left to evolve away.</p>
      <h4>Fitness</h4>
      <p><code>fitness = -conflicts_count(grid)</code> — maximising fitness means minimising rule violations; 0 conflicts = solved.</p>
      <h4>Operators</h4>
      <ul>
        <li><strong>Selection</strong>: tournament selection — sample k random individuals, keep the fittest.</li>
        <li><strong>Crossover</strong>: each child takes each of its 9 rows from one of two parents (rows are already internally box-consistent, so swapping whole rows preserves useful structure).</li>
        <li><strong>Mutation</strong>: with small probability, swap two free cells within the same box, keeping the box constraint intact while exploring new states.</li>
      </ul>
      <h4>Where you'll see this in the real world</h4>
      <p>Evolutionary algorithms are used for neural architecture search, antenna and aerodynamic shape design, scheduling/timetabling, and any optimisation problem where the objective is computable but not differentiable, so gradient descent doesn't apply.</p>
      <h4>Key takeaway</h4>
      <p>No gradient, no problem — a GA only needs to be able to <em>score</em> a candidate, not differentiate it. The tradeoff is that it can plateau near (but not quite at) the optimum, which is exactly what you'll often see it do here.</p>`,
  },
  annealing: {
    title: "Simulated Annealing",
    body: `
      <p>Where the Genetic Algorithm explores with a population, Simulated Annealing explores with a <em>single</em> solution taking a random walk — a useful contrast for understanding metaheuristics in general.</p>
      <h4>Algorithm</h4>
      <ol>
        <li>Start from a random assignment of the free cells (box-consistent, same trick as the GA).</li>
        <li>Propose a neighbour by swapping two free cells inside the same box.</li>
        <li>Let <code>delta = conflicts(neighbour) - conflicts(current)</code>. If delta ≤ 0, accept. Otherwise accept anyway with probability <code>exp(-delta / T)</code> — this lets the search escape local optima early on.</li>
        <li>Slowly cool: <code>T *= cooling_rate</code> each step, so the search becomes greedier over time.</li>
      </ol>
      <p>Stop when conflicts reach 0 (solved) or the step/time budget runs out. The temperature schedule is what makes this different from plain hill-climbing: high T early means broad exploration; low T late means fine-tuned convergence.</p>
      <h4>Where you'll see this in the real world</h4>
      <p>Chip placement and routing, the travelling salesman problem and logistics routing, protein folding energy minimisation, and early neural-network training schedules (simulated annealing predates and inspired some learning-rate schedules) all use this same accept-worse-moves-while-hot, cool-down-over-time idea.</p>
      <h4>Key takeaway</h4>
      <p>The single most important idea in local search: pure greedy hill-climbing gets stuck in the first local optimum it finds. Annealing's willingness to occasionally accept a worse state is precisely what lets it escape — the same exploration/exploitation tradeoff that shows up in RL's epsilon-greedy strategy above.</p>`,
  },
};

// Used to build the comparison table — one row per method, summarising the
// paradigm each belongs to so learners can see the spectrum at a glance.
const COMPARISON = [
  { id: "backtracking", paradigm: "Exact search (CSP)", learnsFrom: "Nothing — hand-coded rules", guarantee: "Always correct if solvable", speed: "Milliseconds", realWorld: "Compilers, SAT solvers, route planners" },
  { id: "neural_net", paradigm: "Supervised learning", learnsFrom: "Labelled (puzzle → solution) examples", guarantee: "No — needs a search to verify", speed: "Seconds (trains, then guides search)", realWorld: "Image/speech recognition, LLMs" },
  { id: "q_learning", paradigm: "Reinforcement learning", learnsFrom: "Trial-and-error reward signal", guarantee: "No — best-effort policy", speed: "Seconds (many episodes)", realWorld: "Game-playing agents, robotics, RLHF" },
  { id: "genetic", paradigm: "Evolutionary computation", learnsFrom: "A fitness score, no gradient needed", guarantee: "No — best found in time budget", speed: "Seconds (many generations)", realWorld: "Architecture search, design optimisation" },
  { id: "annealing", paradigm: "Local search / metaheuristic", learnsFrom: "A cost score, no gradient needed", guarantee: "No — best found in time budget", speed: "Milliseconds–seconds", realWorld: "Chip routing, logistics, TSP" },
];

const GLOSSARY = [
  { term: "Gradient Descent", def: "An optimisation method that repeatedly nudges parameters in the direction that most reduces a loss function — like walking downhill on a landscape shaped by how wrong your predictions are." },
  { term: "Backpropagation", def: "The algorithm that computes how much each weight in a neural network contributed to the error, by applying the chain rule backward from the output layer to the input layer." },
  { term: "Loss function", def: "A single number measuring how wrong a model's predictions are. Training is the process of changing parameters to make this number smaller." },
  { term: "Supervised learning", def: "Learning from labelled examples (input → correct output pairs). The neural net here is supervised: trained on (puzzle, solution) pairs." },
  { term: "Reinforcement learning (RL)", def: "Learning by interacting with an environment and receiving reward signals, with no labelled correct answers — only feedback on how good an action turned out to be." },
  { term: "Q-Learning", def: "A reinforcement learning algorithm that learns the expected long-term value, Q(state, action), of taking a given action in a given state, then acts greedily with respect to it." },
  { term: "Policy", def: "The strategy an RL agent follows to decide actions — a mapping from states to actions (or a probability distribution over actions)." },
  { term: "Exploration vs. exploitation", def: "The core RL tradeoff between trying new, possibly-better actions (exploration) and sticking with the best-known action so far (exploitation). Epsilon-greedy and annealing's temperature both manage this tradeoff." },
  { term: "Genetic Algorithm (GA)", def: "An optimisation technique modelled on natural selection: a population of candidate solutions evolves via selection, crossover and mutation, guided by a fitness function." },
  { term: "Fitness function", def: "The score a genetic algorithm uses to judge how good a candidate solution is — the GA equivalent of a (negated) loss function, but it doesn't need to be differentiable." },
  { term: "Simulated Annealing", def: "An optimisation technique that takes a random walk through candidate solutions, initially accepting worse moves freely (high 'temperature') and becoming progressively greedier as it 'cools'." },
  { term: "Local optimum", def: "A solution that's better than all its immediate neighbours but not the best possible solution overall — the trap that pure greedy search and hill-climbing fall into." },
  { term: "Constraint satisfaction problem (CSP)", def: "A problem defined by variables, their possible values, and constraints between them. Sudoku is a classic CSP: 81 variables, domain {1..9}, row/column/box constraints." },
  { term: "Backtracking", def: "A search strategy that builds a solution incrementally and abandons ('backtracks from') a partial solution as soon as it's determined that it cannot be completed validly." },
  { term: "Overfitting", def: "When a model learns patterns specific to its training data rather than general rules, and so performs worse on new, unseen data." },
  { term: "Hyperparameter", def: "A configuration value set before training begins (like learning rate, population size, or temperature) rather than learned from data." },
];

let currentGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
let fixedMask = Array.from({ length: 9 }, () => Array(9).fill(false));

function buildGrid() {
  const gridEl = document.getElementById("grid");
  gridEl.innerHTML = "";
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const input = document.createElement("input");
      input.className = "cell";
      input.maxLength = 1;
      input.inputMode = "numeric";
      input.dataset.r = r;
      input.dataset.c = c;
      input.addEventListener("input", (e) => {
        if (fixedMask[r][c]) { e.target.value = currentGrid[r][c] || ""; return; }
        const v = e.target.value.replace(/[^1-9]/g, "");
        e.target.value = v;
        currentGrid[r][c] = v ? parseInt(v, 10) : 0;
        highlightConflicts();
        checkWin();
      });
      input.addEventListener("keydown", (e) => handleCellKeydown(e, r, c));
      gridEl.appendChild(input);
    }
  }
}

function handleCellKeydown(e, r, c) {
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (moves[e.key]) {
    e.preventDefault();
    const [dr, dc] = moves[e.key];
    const nr = Math.min(8, Math.max(0, r + dr));
    const nc = Math.min(8, Math.max(0, c + dc));
    const next = document.querySelector(`.cell[data-r="${nr}"][data-c="${nc}"]`);
    if (next) next.focus();
  } else if ((e.key === "Backspace" || e.key === "Delete") && !fixedMask[r][c]) {
    currentGrid[r][c] = 0;
    e.target.value = "";
    highlightConflicts();
  }
}

function renderGrid(grid, fixed) {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    const r = parseInt(cell.dataset.r, 10), c = parseInt(cell.dataset.c, 10);
    const v = grid[r][c];
    cell.value = v === 0 ? "" : v;
    cell.classList.remove("fixed", "filled", "conflict");
    cell.readOnly = false;
    if (fixed && fixed[r][c]) {
      cell.classList.add("fixed");
      cell.readOnly = true;
    } else if (v !== 0) {
      cell.classList.add("filled");
    }
  });
  highlightConflicts();
}

// Live validation: any cell whose value collides with another cell in its
// row, column or box gets the .conflict style, updated on every keystroke.
function highlightConflicts() {
  const conflictCells = new Set();
  for (let i = 0; i < 9; i++) {
    markDuplicates(conflictCells, [...Array(9).keys()].map((c) => [i, c]));
    markDuplicates(conflictCells, [...Array(9).keys()].map((r) => [r, i]));
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const cells = [];
      for (let i = br; i < br + 3; i++) for (let j = bc; j < bc + 3; j++) cells.push([i, j]);
      markDuplicates(conflictCells, cells);
    }
  }
  document.querySelectorAll(".cell").forEach((cell) => {
    const r = parseInt(cell.dataset.r, 10), c = parseInt(cell.dataset.c, 10);
    cell.classList.toggle("conflict", conflictCells.has(`${r},${c}`));
  });
}

function markDuplicates(conflictCells, cellList) {
  const seen = new Map();
  for (const [r, c] of cellList) {
    const v = currentGrid[r][c];
    if (v === 0) continue;
    if (!seen.has(v)) seen.set(v, []);
    seen.get(v).push([r, c]);
  }
  for (const coords of seen.values()) {
    if (coords.length > 1) coords.forEach(([r, c]) => conflictCells.add(`${r},${c}`));
  }
}

function checkWin() {
  if (Board.isComplete(currentGrid) && Board.conflictsCount(currentGrid) === 0) {
    setStatus("🎉 Solved it yourself — nicely done!");
  }
}

function buildMethodCards() {
  const container = document.getElementById("methodGrid");
  container.innerHTML = "";
  METHODS.forEach((m) => {
    const card = document.createElement("div");
    card.className = "method-card";
    card.innerHTML = `
      <div class="method-card-header">
        <h3>${m.label}</h3>
        <button class="info-btn" data-info="${m.id}" aria-label="About ${m.label}" title="About this algorithm">i</button>
      </div>
      <p>${EXPLANATIONS[m.id]}</p>
      <button data-method="${m.id}">Solve</button>
    `;
    card.querySelector("button[data-method]").addEventListener("click", () => solveWith(m.id));
    card.querySelector(".info-btn").addEventListener("click", () => openInfoModal(m.id));
    container.appendChild(card);
  });
}

function openInfoModal(id) {
  const details = DETAILS[id];
  if (!details) return;
  document.getElementById("infoModalTitle").innerHTML = details.title;
  document.getElementById("infoModalBody").innerHTML = details.body;
  const overlay = document.getElementById("infoModalOverlay");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

function closeInfoModal() {
  const overlay = document.getElementById("infoModalOverlay");
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
}

function buildCompareTable() {
  const table = document.getElementById("compareTable");
  const labelById = Object.fromEntries(METHODS.map((m) => [m.id, m.label]));
  const headRow = `<tr><th>Method</th><th>Paradigm</th><th>Learns from</th><th>Guarantees a solution?</th><th>Typical speed</th><th>Real-world examples</th></tr>`;
  const bodyRows = COMPARISON.map((row) => `
    <tr>
      <td><strong>${labelById[row.id]}</strong></td>
      <td>${row.paradigm}</td>
      <td>${row.learnsFrom}</td>
      <td>${row.guarantee}</td>
      <td>${row.speed}</td>
      <td>${row.realWorld}</td>
    </tr>`).join("");
  table.innerHTML = `<thead>${headRow}</thead><tbody>${bodyRows}</tbody>`;
}

function openGlossaryModal() {
  const body = document.getElementById("glossaryModalBody");
  body.innerHTML = `<dl class="glossary-list">${GLOSSARY.map(
    (g) => `<dt>${g.term}</dt><dd>${g.def}</dd>`
  ).join("")}</dl>`;
  const overlay = document.getElementById("glossaryModalOverlay");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

function closeGlossaryModal() {
  const overlay = document.getElementById("glossaryModalOverlay");
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
}

function generatePuzzle() {
  const clues = parseInt(document.getElementById("clues").value, 10) || 32;
  setStatus("Generating puzzle...");
  const { puzzle } = Board.generatePuzzle(clues);
  currentGrid = puzzle.map((row) => row.slice());
  fixedMask = puzzle.map((row) => row.map((v) => v !== 0));
  renderGrid(currentGrid, fixedMask);
  setStatus(`Puzzle generated with ${clues} clues.`);
  document.getElementById("resultPanel").innerHTML = "";
}

function clearGrid() {
  currentGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
  fixedMask = Array.from({ length: 9 }, () => Array(9).fill(false));
  renderGrid(currentGrid, fixedMask);
  setStatus("Cleared.");
  document.getElementById("resultPanel").innerHTML = "";
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function renderResult(data) {
  const panel = document.getElementById("resultPanel");
  currentGrid = data.grid.map((row) => row.slice());
  renderGrid(data.grid, fixedMask);
  const badge = data.solved
    ? '<span class="badge ok">SOLVED</span>'
    : '<span class="badge fail">NOT SOLVED</span>';
  const extras = Object.entries(data)
    .filter(([k]) => !["grid", "method", "fill_order", "history"].includes(k))
    .map(([k, v]) => `<div><strong>${k}</strong>: ${JSON.stringify(v)}</div>`)
    .join("");
  panel.innerHTML = `<div class="result-box"><h3>${data.method} ${badge}</h3>${extras}</div>`;
  setStatus("Done.");
}

async function solveWith(method) {
  setStatus(`Solving with ${method}...`);
  // Run async so the UI stays responsive (the neural net trains on the fly).
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    let data;
    switch (method) {
      case "backtracking":
        data = SolverBacktracking.solve(currentGrid);
        break;
      case "genetic":
        data = SolverGenetic.solve(currentGrid, { populationSize: 150, generations: 4000, timeBudgetMs: 12000 });
        break;
      case "annealing":
        data = SolverAnnealing.solve(currentGrid, { timeBudgetMs: 12000 });
        break;
      case "neural_net":
        setStatus("Training neural net in your browser (gradient descent)...");
        data = await SolverNeuralNet.solve(currentGrid, {
          timeBudgetMs: 10000,
          progressCb: (epoch, loss) => setStatus(`Training neural net... epoch ${epoch + 1}, loss ${loss.toFixed(3)}`),
        });
        break;
      case "q_learning":
        data = SolverQLearning.solve(currentGrid, { episodes: 250, timeBudgetMs: 12000 });
        break;
      default:
        throw new Error(`unknown method '${method}'`);
    }
    renderResult(data);
  } catch (err) {
    setStatus("Error.");
    document.getElementById("resultPanel").innerHTML = `<div class="result-box">Error: ${err.message}</div>`;
  }
}

document.getElementById("generateBtn").addEventListener("click", generatePuzzle);
document.getElementById("clearBtn").addEventListener("click", clearGrid);
document.getElementById("infoModalClose").addEventListener("click", closeInfoModal);
document.getElementById("infoModalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "infoModalOverlay") closeInfoModal();
});
document.getElementById("glossaryBtn").addEventListener("click", openGlossaryModal);
document.getElementById("glossaryModalClose").addEventListener("click", closeGlossaryModal);
document.getElementById("glossaryModalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "glossaryModalOverlay") closeGlossaryModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeInfoModal(); closeGlossaryModal(); }
});

buildGrid();
buildMethodCards();
buildCompareTable();
generatePuzzle();
