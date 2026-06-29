// Classical exact solver: DFS + constraint propagation (MRV heuristic).
// Baseline only — not a learning method. See README for the explanation
// of why it's included as ground truth for the learning-based solvers.
const SolverBacktracking = (() => {
  function solve(puzzle, timeBudgetMs = 5000) {
    const grid = Board.deepCopy(puzzle);
    const start = performance.now();
    let steps = 0;

    function backtrack() {
      if (performance.now() - start > timeBudgetMs) return false;
      if (Board.isComplete(grid)) return true;
      let best = null, bestCands = null;
      for (let r = 0; r < Board.SIZE; r++) {
        for (let c = 0; c < Board.SIZE; c++) {
          if (grid[r][c] === 0) {
            const cands = Board.candidates(grid, r, c);
            if (!best || cands.size < bestCands.size) { best = [r, c]; bestCands = cands; }
            if (cands.size === 0) return false;
          }
        }
      }
      const [r, c] = best;
      for (const val of bestCands) {
        steps++;
        grid[r][c] = val;
        if (backtrack()) return true;
        grid[r][c] = 0;
      }
      return false;
    }

    const solved = backtrack();
    return {
      grid, solved, steps,
      time_seconds: (performance.now() - start) / 1000,
      method: "backtracking",
    };
  }
  return { solve };
})();
