"""Core Sudoku board representation, validation, and puzzle generation.

All solvers operate on a 9x9 numpy-like list-of-lists grid where 0 means
"empty". This module is the shared substrate every AI approach builds on.
"""
import random
from copy import deepcopy

SIZE = 9
BOX = 3


def empty_grid():
    return [[0] * SIZE for _ in range(SIZE)]


def in_bounds_box(r, c):
    br, bc = (r // BOX) * BOX, (c // BOX) * BOX
    return br, bc


def candidates(grid, r, c):
    if grid[r][c] != 0:
        return set()
    used = set(grid[r]) | {grid[i][c] for i in range(SIZE)}
    br, bc = in_bounds_box(r, c)
    for i in range(br, br + BOX):
        for j in range(bc, bc + BOX):
            used.add(grid[i][j])
    return set(range(1, 10)) - used


def is_valid_placement(grid, r, c, val):
    if val == 0:
        return True
    for i in range(SIZE):
        if i != c and grid[r][i] == val:
            return False
        if i != r and grid[i][c] == val:
            return False
    br, bc = in_bounds_box(r, c)
    for i in range(br, br + BOX):
        for j in range(bc, bc + BOX):
            if (i, j) != (r, c) and grid[i][j] == val:
                return False
    return True


def is_complete(grid):
    return all(grid[r][c] != 0 for r in range(SIZE) for c in range(SIZE))


def is_solved(grid):
    if not is_complete(grid):
        return False
    for r in range(SIZE):
        for c in range(SIZE):
            v = grid[r][c]
            grid[r][c] = 0
            ok = is_valid_placement(grid, r, c, v)
            grid[r][c] = v
            if not ok:
                return False
    return True


def conflicts_count(grid):
    """Total number of rule violations. 0 means fully consistent (used as
    the fitness/cost signal shared by the genetic, annealing and RL solvers).
    """
    count = 0
    for i in range(SIZE):
        row = [v for v in grid[i] if v != 0]
        col = [grid[r][i] for r in range(SIZE) if grid[r][i] != 0]
        count += len(row) - len(set(row))
        count += len(col) - len(set(col))
    for br in range(0, SIZE, BOX):
        for bc in range(0, SIZE, BOX):
            vals = [grid[r][c] for r in range(br, br + BOX) for c in range(bc, bc + BOX) if grid[r][c] != 0]
            count += len(vals) - len(set(vals))
    return count


def _solve_backtracking(grid):
    """Classic exact solver, used only to manufacture solvable puzzles
    and to verify/ground-truth other solvers. See solvers/backtracking.py
    for the documented, user-facing version of this algorithm.
    """
    for r in range(SIZE):
        for c in range(SIZE):
            if grid[r][c] == 0:
                for val in candidates(grid, r, c):
                    grid[r][c] = val
                    if _solve_backtracking(grid):
                        return True
                    grid[r][c] = 0
                return False
    return True


def generate_full_solution():
    grid = empty_grid()
    nums = list(range(1, 10))
    for box in range(0, SIZE, BOX):
        random.shuffle(nums)
        idx = 0
        for i in range(BOX):
            for j in range(BOX):
                grid[box + i][box + j] = nums[idx]
                idx += 1
    _solve_backtracking(grid)
    return grid


def generate_puzzle(num_clues=32):
    """Generate a random solvable puzzle with roughly `num_clues` filled cells."""
    solution = generate_full_solution()
    puzzle = deepcopy(solution)
    cells = [(r, c) for r in range(SIZE) for c in range(SIZE)]
    random.shuffle(cells)
    to_remove = SIZE * SIZE - num_clues
    for r, c in cells[:to_remove]:
        puzzle[r][c] = 0
    return puzzle, solution


def grid_to_str(grid):
    return "\n".join(" ".join(str(v) for v in row) for row in grid)


def parse_grid(text):
    """Parse a grid from a string of 81 digits (0 or . for blank), row-major."""
    digits = [ch for ch in text if ch.isdigit() or ch == "."]
    if len(digits) != 81:
        raise ValueError(f"Expected 81 cells, got {len(digits)}")
    grid = empty_grid()
    for idx, ch in enumerate(digits):
        r, c = divmod(idx, SIZE)
        grid[r][c] = 0 if ch == "." else int(ch)
    return grid
