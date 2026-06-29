// Neural network solver trained in-browser with Gradient Descent +
// Backpropagation, implemented by hand (no ML library) so the forward
// and backward pass are fully visible. See README for the full write-up
// of the math (forward pass, cross-entropy loss, backprop gradients).
const SolverNeuralNet = (() => {
  const INPUT_DIM = 27 * 9;
  const HIDDEN_DIM = 32;
  const OUTPUT_DIM = 9;

  function encodeCell(grid, r, c) {
    const [br, bc] = Board.boxOrigin(r, c);
    const cells = [];
    for (let j = 0; j < Board.SIZE; j++) cells.push([r, j]);
    for (let i = 0; i < Board.SIZE; i++) cells.push([i, c]);
    for (let i = br; i < br + Board.BOX; i++)
      for (let j = bc; j < bc + Board.BOX; j++) cells.push([i, j]);
    const vec = new Float32Array(INPUT_DIM);
    cells.forEach(([i, j], k) => {
      const v = grid[i][j];
      if (v !== 0) vec[k * 9 + (v - 1)] = 1.0;
    });
    return vec;
  }

  function randn(rng) {
    // Box-Muller transform for a standard normal sample.
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeMatrix(rows, cols, fillFn) {
    const m = new Array(rows);
    for (let i = 0; i < rows; i++) {
      m[i] = new Float32Array(cols);
      for (let j = 0; j < cols; j++) m[i][j] = fillFn ? fillFn() : 0;
    }
    return m;
  }

  class SudokuNet {
    constructor(seed = 42) {
      const rng = mulberry32(seed);
      const s1 = Math.sqrt(2.0 / INPUT_DIM), s2 = Math.sqrt(2.0 / HIDDEN_DIM);
      this.W1 = makeMatrix(INPUT_DIM, HIDDEN_DIM, () => randn(rng) * s1);
      this.b1 = new Float32Array(HIDDEN_DIM);
      this.W2 = makeMatrix(HIDDEN_DIM, OUTPUT_DIM, () => randn(rng) * s2);
      this.b2 = new Float32Array(OUTPUT_DIM);
    }

    forwardOne(x) {
      const z1 = new Float32Array(HIDDEN_DIM);
      for (let h = 0; h < HIDDEN_DIM; h++) {
        let s = this.b1[h];
        for (let i = 0; i < INPUT_DIM; i++) if (x[i] !== 0) s += x[i] * this.W1[i][h];
        z1[h] = s;
      }
      const a1 = z1.map((v) => Math.max(0, v));
      const z2 = new Float32Array(OUTPUT_DIM);
      for (let o = 0; o < OUTPUT_DIM; o++) {
        let s = this.b2[o];
        for (let h = 0; h < HIDDEN_DIM; h++) s += a1[h] * this.W2[h][o];
        z2[o] = s;
      }
      const maxZ = Math.max(...z2);
      const exp = z2.map((v) => Math.exp(v - maxZ));
      const sum = exp.reduce((a, b) => a + b, 0);
      const p = exp.map((v) => v / sum);
      return { z1, a1, p };
    }

    predictProba(x) { return this.forwardOne(x).p; }

    // One mini-batch step of gradient descent using manually derived
    // backpropagation gradients (softmax + cross-entropy, ReLU).
    trainBatch(X, y, lr) {
      const N = X.length;
      const dW1 = makeMatrix(INPUT_DIM, HIDDEN_DIM);
      const db1 = new Float32Array(HIDDEN_DIM);
      const dW2 = makeMatrix(HIDDEN_DIM, OUTPUT_DIM);
      const db2 = new Float32Array(OUTPUT_DIM);
      let lossSum = 0;

      for (let n = 0; n < N; n++) {
        const x = X[n];
        const { z1, a1, p } = this.forwardOne(x);
        const target = y[n];
        lossSum += -Math.log(Math.max(p[target], 1e-9));

        const dz2 = p.map((v, i) => (v - (i === target ? 1 : 0)) / N);
        for (let h = 0; h < HIDDEN_DIM; h++)
          for (let o = 0; o < OUTPUT_DIM; o++) dW2[h][o] += a1[h] * dz2[o];
        for (let o = 0; o < OUTPUT_DIM; o++) db2[o] += dz2[o];

        const da1 = new Float32Array(HIDDEN_DIM);
        for (let h = 0; h < HIDDEN_DIM; h++) {
          let s = 0;
          for (let o = 0; o < OUTPUT_DIM; o++) s += dz2[o] * this.W2[h][o];
          da1[h] = s;
        }
        const dz1 = da1.map((v, h) => (z1[h] > 0 ? v : 0));
        for (let i = 0; i < INPUT_DIM; i++) {
          if (x[i] === 0) continue;
          for (let h = 0; h < HIDDEN_DIM; h++) dW1[i][h] += x[i] * dz1[h];
        }
        for (let h = 0; h < HIDDEN_DIM; h++) db1[h] += dz1[h];
      }

      // Gradient DESCENT update: step opposite the gradient.
      for (let i = 0; i < INPUT_DIM; i++)
        for (let h = 0; h < HIDDEN_DIM; h++) this.W1[i][h] -= lr * dW1[i][h];
      for (let h = 0; h < HIDDEN_DIM; h++) this.b1[h] -= lr * db1[h];
      for (let h = 0; h < HIDDEN_DIM; h++)
        for (let o = 0; o < OUTPUT_DIM; o++) this.W2[h][o] -= lr * dW2[h][o];
      for (let o = 0; o < OUTPUT_DIM; o++) this.b2[o] -= lr * db2[o];

      return lossSum / N;
    }
  }

  function generateTrainingData(numPuzzles, cluesRange) {
    const X = [], y = [];
    for (let p = 0; p < numPuzzles; p++) {
      const clues = cluesRange[0] + Math.floor(Math.random() * (cluesRange[1] - cluesRange[0]));
      const { puzzle, solution } = Board.generatePuzzle(clues);
      for (let r = 0; r < Board.SIZE; r++) {
        for (let c = 0; c < Board.SIZE; c++) {
          if (puzzle[r][c] === 0) {
            X.push(encodeCell(puzzle, r, c));
            y.push(solution[r][c] - 1);
          }
        }
      }
    }
    return { X, y };
  }

  async function train(opts = {}, progressCb) {
    const { numPuzzles = 40, epochs = 4, batchSize = 64, lr = 0.05, cluesRange = [28, 45] } = opts;
    const net = new SudokuNet();
    const { X, y } = generateTrainingData(numPuzzles, cluesRange);
    const n = X.length;
    const history = [];
    for (let epoch = 0; epoch < epochs; epoch++) {
      const order = Board.shuffle([...Array(n).keys()]);
      let epochLoss = 0, batches = 0;
      for (let start = 0; start < n; start += batchSize) {
        const idxs = order.slice(start, start + batchSize);
        const xb = idxs.map((i) => X[i]);
        const yb = idxs.map((i) => y[i]);
        epochLoss += net.trainBatch(xb, yb, lr);
        batches++;
        if (batches % 4 === 0) await new Promise((r) => setTimeout(r, 0)); // keep UI responsive
      }
      history.push(epochLoss / Math.max(batches, 1));
      if (progressCb) progressCb(epoch, history[history.length - 1]);
    }
    return { net, history };
  }

  let cachedNet = null;

  async function getOrTrainDefaultNet(progressCb) {
    if (!cachedNet) {
      const { net } = await train({ numPuzzles: 15, epochs: 3 }, progressCb);
      cachedNet = net;
    }
    return cachedNet;
  }

  async function solve(puzzle, opts = {}) {
    const { timeBudgetMs = 10000, progressCb } = opts;
    const net = opts.net || (await getOrTrainDefaultNet(progressCb));
    const start = performance.now(); // search budget starts after training completes
    const grid = Board.deepCopy(puzzle);
    const fillOrder = [];

    function attempt() {
      const empties = [];
      for (let r = 0; r < Board.SIZE; r++)
        for (let c = 0; c < Board.SIZE; c++) if (grid[r][c] === 0) empties.push([r, c]);
      if (empties.length === 0) return true;
      if (performance.now() - start > timeBudgetMs) return false;

      let best = null, bestRanked = null, bestConf = -1;
      for (const [r, c] of empties) {
        const cands = Board.candidates(grid, r, c);
        if (cands.size === 0) return false;
        const probs = net.predictProba(encodeCell(grid, r, c));
        const ranked = [...cands].map((d) => [probs[d - 1], d]).sort((a, b) => b[0] - a[0]);
        const conf = ranked[0][0];
        if (conf > bestConf) { best = [r, c]; bestRanked = ranked; bestConf = conf; }
      }

      const [r, c] = best;
      for (const [conf, digit] of bestRanked) {
        grid[r][c] = digit;
        fillOrder.push([r, c, digit, conf]);
        if (attempt()) return true;
        fillOrder.pop();
      }
      grid[r][c] = 0;
      return false;
    }

    const solved = attempt();
    return {
      grid,
      solved: solved && Board.isComplete(grid),
      fill_order: fillOrder,
      time_seconds: (performance.now() - start) / 1000,
      method: "neural_net_gradient_descent",
    };
  }

  return { solve, train, SudokuNet, encodeCell };
})();
