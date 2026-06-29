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
      <h3>${m.label}</h3>
      <p>${EXPLANATIONS[m.id]}</p>
      <button data-method="${m.id}">Solve</button>
    `;
    card.querySelector("button").addEventListener("click", () => solveWith(m.id));
    container.appendChild(card);
  });
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

buildGrid();
buildMethodCards();
generatePuzzle();
