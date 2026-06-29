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
        currentGrid[r][c] = v ? parseInt(v) : 0;
      });
      gridEl.appendChild(input);
    }
  }
}

function renderGrid(grid, fixed) {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
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
      <p>${window.EXPLANATIONS[m.id]}</p>
      <button data-method="${m.id}">Solve</button>
    `;
    card.querySelector("button").addEventListener("click", () => solveWith(m.id));
    container.appendChild(card);
  });
}

async function generatePuzzle() {
  const clues = parseInt(document.getElementById("clues").value) || 32;
  setStatus("Generating puzzle...");
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clues }),
  });
  const data = await res.json();
  currentGrid = data.puzzle.map((row) => row.slice());
  fixedMask = data.puzzle.map((row) => row.map((v) => v !== 0));
  renderGrid(currentGrid, fixedMask);
  setStatus("Puzzle generated with " + clues + " clues.");
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

async function solveWith(method) {
  setStatus(`Solving with ${method}...`);
  const res = await fetch(`/api/solve/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grid: currentGrid }),
  });
  const data = await res.json();
  const panel = document.getElementById("resultPanel");
  if (data.error) {
    setStatus("Error.");
    panel.innerHTML = `<div class="result-box">Error: ${data.error}</div>`;
    return;
  }
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

document.getElementById("generateBtn").addEventListener("click", generatePuzzle);
document.getElementById("clearBtn").addEventListener("click", clearGrid);

buildGrid();
buildMethodCards();
generatePuzzle();
