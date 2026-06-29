// Reinforcement Learning solver using tabular Q-Learning. See README for
// the MDP formulation (state/action/reward) and the TD update rule.
const SolverQLearning = (() => {
  function cellConflicts(grid, r, c) {
    const val = grid[r][c];
    if (val === 0) return 0;
    let count = 0;
    for (let i = 0; i < Board.SIZE; i++) {
      if (i !== c && grid[r][i] === val) count++;
      if (i !== r && grid[i][c] === val) count++;
    }
    const [br, bc] = Board.boxOrigin(r, c);
    for (let i = br; i < br + Board.BOX; i++)
      for (let j = bc; j < bc + Board.BOX; j++)
        if ((i !== r || j !== c) && grid[i][j] === val) count++;
    return count;
  }

  function stateKey(grid, r, c) {
    const rowUsed = grid[r].filter((v) => v !== 0).slice().sort().join(",");
    const colUsed = [];
    for (let i = 0; i < Board.SIZE; i++) if (grid[i][c] !== 0) colUsed.push(grid[i][c]);
    const [br, bc] = Board.boxOrigin(r, c);
    const boxUsed = [];
    for (let i = br; i < br + Board.BOX; i++)
      for (let j = bc; j < bc + Board.BOX; j++) if (grid[i][j] !== 0) boxUsed.push(grid[i][j]);
    return `${rowUsed}|${colUsed.sort().join(",")}|${boxUsed.sort().join(",")}`;
  }

  function trainAgent(puzzle, opts = {}) {
    const { episodes = 250, alpha = 0.4, gamma = 0.9, epsilonStart = 1.0, epsilonEnd = 0.05 } = opts;
    const Q = new Map(); // stateKey -> Float64Array(9)
    const getQ = (key) => {
      if (!Q.has(key)) Q.set(key, new Float64Array(9));
      return Q.get(key);
    };

    const emptyCells = [];
    for (let r = 0; r < Board.SIZE; r++)
      for (let c = 0; c < Board.SIZE; c++) if (puzzle[r][c] === 0) emptyCells.push([r, c]);

    const history = [];
    for (let ep = 0; ep < episodes; ep++) {
      const epsilon = epsilonStart + (epsilonEnd - epsilonStart) * (ep / Math.max(episodes - 1, 1));
      const grid = Board.deepCopy(puzzle);
      const order = Board.shuffle(emptyCells.slice());

      for (const [r, c] of order) {
        const state = stateKey(grid, r, c);
        const qVals = getQ(state);
        let actionDigit;
        if (Math.random() < epsilon) {
          actionDigit = 1 + Math.floor(Math.random() * 9);
        } else {
          let bestI = 0;
          for (let i = 1; i < 9; i++) if (qVals[i] > qVals[bestI]) bestI = i;
          actionDigit = bestI + 1;
        }

        grid[r][c] = actionDigit;
        const conflicts = cellConflicts(grid, r, c);
        let reward = conflicts === 0 ? 1.0 : -conflicts;
        if (Board.isComplete(grid) && Board.conflictsCount(grid) === 0) reward += 10.0;

        const nextState = stateKey(grid, r, c);
        const nextQ = getQ(nextState);
        const bestNext = Math.max(...nextQ);
        const tdTarget = reward + gamma * bestNext;
        qVals[actionDigit - 1] += alpha * (tdTarget - qVals[actionDigit - 1]);
      }
      history.push(Board.conflictsCount(grid));
    }
    return { Q, history, getQ };
  }

  function solve(puzzle, opts = {}) {
    const { episodes = 250, timeBudgetMs = 15000 } = opts;
    const start = performance.now();
    const { getQ, history } = trainAgent(puzzle, { episodes });

    const grid = Board.deepCopy(puzzle);
    const emptyCells = [];
    for (let r = 0; r < Board.SIZE; r++)
      for (let c = 0; c < Board.SIZE; c++) if (puzzle[r][c] === 0) emptyCells.push([r, c]);
    Board.shuffle(emptyCells);

    for (const [r, c] of emptyCells) {
      if (performance.now() - start > timeBudgetMs) break;
      const qVals = getQ(stateKey(grid, r, c));
      let bestI = 0;
      for (let i = 1; i < 9; i++) if (qVals[i] > qVals[bestI]) bestI = i;
      grid[r][c] = bestI + 1;
    }

    const conflicts = Board.conflictsCount(grid);
    return {
      grid,
      solved: conflicts === 0 && Board.isComplete(grid),
      conflicts,
      episodes,
      time_seconds: (performance.now() - start) / 1000,
      history,
      method: "q_learning",
    };
  }

  return { solve, trainAgent };
})();
