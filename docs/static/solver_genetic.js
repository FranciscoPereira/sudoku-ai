// Genetic Algorithm solver — see README for the full explanation of
// representation, fitness, selection, crossover and mutation.
const SolverGenetic = (() => {
  function freeCellsByBox(puzzle) {
    const boxes = new Map();
    for (let r = 0; r < Board.SIZE; r++) {
      for (let c = 0; c < Board.SIZE; c++) {
        if (puzzle[r][c] === 0) {
          const key = `${Math.floor(r / Board.BOX)},${Math.floor(c / Board.BOX)}`;
          if (!boxes.has(key)) boxes.set(key, []);
          boxes.get(key).push([r, c]);
        }
      }
    }
    return boxes;
  }

  function randomIndividual(puzzle, freeByBox) {
    const grid = Board.deepCopy(puzzle);
    for (const [key, cells] of freeByBox) {
      const [bi, bj] = key.split(",").map(Number);
      const br = bi * Board.BOX, bc = bj * Board.BOX;
      const used = new Set();
      for (let i = br; i < br + Board.BOX; i++)
        for (let j = bc; j < bc + Board.BOX; j++) if (grid[i][j] !== 0) used.add(grid[i][j]);
      const missing = Board.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !used.has(v)));
      cells.forEach(([r, c], idx) => { grid[r][c] = missing[idx]; });
    }
    return grid;
  }

  function fitness(grid) { return -Board.conflictsCount(grid); }

  function crossover(p1, p2) {
    const child = [];
    for (let r = 0; r < Board.SIZE; r++) child.push((Math.random() < 0.5 ? p1[r] : p2[r]).slice());
    return child;
  }

  function mutate(grid, freeByBox, rate) {
    for (const cells of freeByBox.values()) {
      if (cells.length >= 2 && Math.random() < rate) {
        const [i1, i2] = Board.shuffle([...cells.keys()]).slice(0, 2);
        const [r1, c1] = cells[i1], [r2, c2] = cells[i2];
        [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
      }
    }
  }

  function tournament(pop, fits, k = 4) {
    let bestIdx = -1, bestFit = -Infinity;
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(Math.random() * pop.length);
      if (fits[idx] > bestFit) { bestFit = fits[idx]; bestIdx = idx; }
    }
    return pop[bestIdx];
  }

  function solve(puzzle, opts = {}) {
    const { populationSize = 150, generations = 2000, mutationRate = 0.15, timeBudgetMs = 15000 } = opts;
    const start = performance.now();
    const freeByBox = freeCellsByBox(puzzle);
    let population = Array.from({ length: populationSize }, () => randomIndividual(puzzle, freeByBox));
    let bestGrid = null, bestFit = -Infinity;
    const history = [];
    let gen = 0;

    for (gen = 0; gen < generations; gen++) {
      const fits = population.map(fitness);
      let genBestIdx = 0;
      for (let i = 1; i < fits.length; i++) if (fits[i] > fits[genBestIdx]) genBestIdx = i;
      if (fits[genBestIdx] > bestFit) { bestFit = fits[genBestIdx]; bestGrid = Board.deepCopy(population[genBestIdx]); }
      history.push(-bestFit);

      if (bestFit === 0 || performance.now() - start > timeBudgetMs) break;

      const next = [Board.deepCopy(bestGrid)];
      while (next.length < populationSize) {
        const p1 = tournament(population, fits);
        const p2 = tournament(population, fits);
        const child = crossover(p1, p2);
        mutate(child, freeByBox, mutationRate);
        next.push(child);
      }
      population = next;
    }

    return {
      grid: bestGrid,
      solved: bestFit === 0 && Board.isComplete(bestGrid),
      generations: gen + 1,
      conflicts: -bestFit,
      time_seconds: (performance.now() - start) / 1000,
      history,
      method: "genetic_algorithm",
    };
  }

  return { solve, freeCellsByBox, randomIndividual };
})();
