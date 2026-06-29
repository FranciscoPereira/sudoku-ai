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
      <p>Because every move is checked against the rules of Sudoku before it's made, this always finds a valid solution (if one exists), in milliseconds.</p>`,
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
      <p>Each "Solve" click trains a fresh network on freshly generated puzzles, then uses it to guide a backtracking-style fill — if a top guess leads to a dead end, the next-most-confident digit is tried.</p>`,
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
      <p><strong>Limitation, by design:</strong> a per-cell tabular policy doesn't scale to the full board's combinatorics, so this often leaves some conflicts on harder puzzles — a real, honest limitation of vanilla RL on large discrete spaces.</p>`,
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
      </ul>`,
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
      <p>Stop when conflicts reach 0 (solved) or the step/time budget runs out. The temperature schedule is what makes this different from plain hill-climbing: high T early means broad exploration; low T late means fine-tuned convergence.</p>`,
  },
};

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
      input.dataset.r = r;
      input.dataset.c = c;
      input.addEventListener("input", (e) => {
        const v = e.target.value.replace(/[^1-9]/g, "");
        e.target.value = v;
        currentGrid[r][c] = v ? parseInt(v, 10) : 0;
      });
      gridEl.appendChild(input);
    }
  }
}

function renderGrid(grid, fixed) {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    const r = parseInt(cell.dataset.r, 10), c = parseInt(cell.dataset.c, 10);
    const v = grid[r][c];
    cell.value = v === 0 ? "" : v;
    cell.classList.remove("fixed", "filled");
    if (fixed && fixed[r][c]) cell.classList.add("fixed");
  });
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
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeInfoModal();
});

buildGrid();
buildMethodCards();
generatePuzzle();
