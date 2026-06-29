"""Classical exact solver: depth-first search + constraint propagation.

WHY THIS IS HERE
-----------------
This is not "AI" in the learning sense (no parameters are trained), but it
is the right baseline for the demo: it always finds the exact solution (if
one exists) and runs in milliseconds, so the website can show how the
learning-based methods (NN, GA, SA, RL) trade certainty/speed for the
ability to *generalize* or *learn from experience* instead of being
hand-coded with the rules of Sudoku.

ALGORITHM
---------
1. Find the next empty cell.
2. Compute its candidates = {1..9} minus values already used in its row,
   column and 3x3 box (constraint propagation - this pruning is what makes
   backtracking fast instead of exponential).
3. Try each candidate, recurse. If recursion fails, undo ("backtrack") and
   try the next candidate.
4. If no candidates work, this branch is a dead end -> backtrack further.
"""
import time
from copy import deepcopy

from sudoku_ai.board import SIZE, candidates, is_complete


def solve(grid, time_budget=5.0):
    grid = deepcopy(grid)
    start = time.time()
    steps = {"count": 0}

    def backtrack():
        if time.time() - start > time_budget:
            return False
        if is_complete(grid):
            return True
        # pick the empty cell with fewest candidates (MRV heuristic)
        best = None
        best_cands = None
        for r in range(SIZE):
            for c in range(SIZE):
                if grid[r][c] == 0:
                    cands = candidates(grid, r, c)
                    if best is None or len(cands) < len(best_cands):
                        best, best_cands = (r, c), cands
                    if len(cands) == 0:
                        return False
        r, c = best
        for val in best_cands:
            steps["count"] += 1
            grid[r][c] = val
            if backtrack():
                return True
            grid[r][c] = 0
        return False

    solved = backtrack()
    return {
        "grid": grid,
        "solved": solved,
        "steps": steps["count"],
        "time_seconds": time.time() - start,
        "method": "backtracking",
    }
