// Core Sudoku board representation, validation, and puzzle generation.
// Port of sudoku_ai/board.py to run entirely client-side (GitHub Pages
// only serves static files, so all solving happens in the browser).
const Board = (() => {
  const SIZE = 9;
  const BOX = 3;

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function deepCopy(grid) {
    return grid.map((row) => row.slice());
  }

  function boxOrigin(r, c) {
    return [Math.floor(r / BOX) * BOX, Math.floor(c / BOX) * BOX];
  }

  function candidates(grid, r, c) {
    if (grid[r][c] !== 0) return new Set();
    const used = new Set(grid[r]);
    for (let i = 0; i < SIZE; i++) used.add(grid[i][c]);
    const [br, bc] = boxOrigin(r, c);
    for (let i = br; i < br + BOX; i++)
      for (let j = bc; j < bc + BOX; j++) used.add(grid[i][j]);
    const out = new Set();
    for (let v = 1; v <= 9; v++) if (!used.has(v)) out.add(v);
    return out;
  }

  function isValidPlacement(grid, r, c, val) {
    if (val === 0) return true;
    for (let i = 0; i < SIZE; i++) {
      if (i !== c && grid[r][i] === val) return false;
      if (i !== r && grid[i][c] === val) return false;
    }
    const [br, bc] = boxOrigin(r, c);
    for (let i = br; i < br + BOX; i++)
      for (let j = bc; j < bc + BOX; j++)
        if ((i !== r || j !== c) && grid[i][j] === val) return false;
    return true;
  }

  function isComplete(grid) {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) return false;
    return true;
  }

  function conflictsCount(grid) {
    let count = 0;
    for (let i = 0; i < SIZE; i++) {
      const row = grid[i].filter((v) => v !== 0);
      count += row.length - new Set(row).size;
      const col = [];
      for (let r = 0; r < SIZE; r++) if (grid[r][i] !== 0) col.push(grid[r][i]);
      count += col.length - new Set(col).size;
    }
    for (let br = 0; br < SIZE; br += BOX) {
      for (let bc = 0; bc < SIZE; bc += BOX) {
        const vals = [];
        for (let i = br; i < br + BOX; i++)
          for (let j = bc; j < bc + BOX; j++) if (grid[i][j] !== 0) vals.push(grid[i][j]);
        count += vals.length - new Set(vals).size;
      }
    }
    return count;
  }

  function solveBacktrackingInPlace(grid) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) {
          const cands = Array.from(candidates(grid, r, c));
          for (const val of cands) {
            grid[r][c] = val;
            if (solveBacktrackingInPlace(grid)) return true;
            grid[r][c] = 0;
          }
          return false;
        }
      }
    }
    return true;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function generateFullSolution() {
    const grid = emptyGrid();
    for (let box = 0; box < SIZE; box += BOX) {
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      let idx = 0;
      for (let i = 0; i < BOX; i++)
        for (let j = 0; j < BOX; j++) grid[box + i][box + j] = nums[idx++];
    }
    solveBacktrackingInPlace(grid);
    return grid;
  }

  function generatePuzzle(numClues = 32) {
    const solution = generateFullSolution();
    const puzzle = deepCopy(solution);
    const cells = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cells.push([r, c]);
    shuffle(cells);
    const toRemove = SIZE * SIZE - numClues;
    for (let i = 0; i < toRemove; i++) {
      const [r, c] = cells[i];
      puzzle[r][c] = 0;
    }
    return { puzzle, solution };
  }

  function parseGrid(text) {
    const digits = text.split("").filter((ch) => /[0-9.]/.test(ch));
    if (digits.length !== 81) throw new Error(`Expected 81 cells, got ${digits.length}`);
    const grid = emptyGrid();
    digits.forEach((ch, idx) => {
      const r = Math.floor(idx / SIZE), c = idx % SIZE;
      grid[r][c] = ch === "." ? 0 : parseInt(ch, 10);
    });
    return grid;
  }

  return {
    SIZE, BOX, emptyGrid, deepCopy, boxOrigin, candidates, isValidPlacement,
    isComplete, conflictsCount, generateFullSolution, generatePuzzle, parseGrid, shuffle,
  };
})();
