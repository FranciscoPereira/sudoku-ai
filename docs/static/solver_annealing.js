// Simulated Annealing — single-trajectory, temperature-controlled random
// walk. Contrast with the population-based Genetic Algorithm. See README.
const SolverAnnealing = (() => {
  function solve(puzzle, opts = {}) {
    const {
      initialTemp = 2.0, coolingRate = 0.9995, minTemp = 0.001,
      maxSteps = 200000, timeBudgetMs = 15000,
    } = opts;
    const start = performance.now();
    const freeByBox = SolverGenetic.freeCellsByBox(puzzle);
    let current = SolverGenetic.randomIndividual(puzzle, freeByBox);
    let currentCost = Board.conflictsCount(current);
    let bestGrid = Board.deepCopy(current), bestCost = currentCost;
    let temp = initialTemp;
    const history = [currentCost];

    const boxesWithSwaps = [...freeByBox.values()].filter((cells) => cells.length >= 2);

    let step = 0;
    while (step < maxSteps && temp > minTemp && bestCost > 0) {
      if (performance.now() - start > timeBudgetMs) break;
      if (boxesWithSwaps.length === 0) break;
      const cells = boxesWithSwaps[Math.floor(Math.random() * boxesWithSwaps.length)];
      const [i1, i2] = Board.shuffle([...cells.keys()]).slice(0, 2);
      const [r1, c1] = cells[i1], [r2, c2] = cells[i2];

      [current[r1][c1], current[r2][c2]] = [current[r2][c2], current[r1][c1]];
      const newCost = Board.conflictsCount(current);
      const delta = newCost - currentCost;

      const accept = delta <= 0 || Math.random() < Math.exp(-delta / Math.max(temp, 1e-9));
      if (accept) {
        currentCost = newCost;
        if (currentCost < bestCost) { bestCost = currentCost; bestGrid = Board.deepCopy(current); }
      } else {
        [current[r1][c1], current[r2][c2]] = [current[r2][c2], current[r1][c1]];
      }

      temp *= coolingRate;
      step++;
      if (step % 200 === 0) history.push(bestCost);
    }

    return {
      grid: bestGrid,
      solved: bestCost === 0 && Board.isComplete(bestGrid),
      steps: step,
      conflicts: bestCost,
      final_temperature: temp,
      time_seconds: (performance.now() - start) / 1000,
      history,
      method: "simulated_annealing",
    };
  }
  return { solve };
})();
