"""Simulated Annealing solver - the "different but important" algorithm.

WHY THIS ONE
-------------
The genetic algorithm explores the search space with a *population*.
Simulated Annealing explores it with a *single* solution that takes random
walks, which makes it a useful contrast for AI/ML learning purposes:
- GA: population-based, exploration via crossover of many candidates.
- SA: single-trajectory, exploration via a temperature-controlled random
  walk that is allowed to *worsen* the solution sometimes, to escape local
  optima - the same core idea behind sampling methods used in some
  training algorithms (e.g. early RL/MCMC methods) and behind classic
  local-search heuristics for NP-hard CSPs.

ALGORITHM
---------
1. Start from a random assignment of the free cells (consistent within
   each 3x3 box, same trick as the GA).
2. Repeat:
     a. Propose a neighbour by swapping two free cells inside the same box
        (a "move").
     b. delta = conflicts(neighbour) - conflicts(current)
     c. If delta <= 0, accept the move (it's at least as good).
        Else accept it anyway with probability exp(-delta / T) - this is
        the "annealing" trick: early on (T high) we accept worse moves
        often, enabling broad exploration; as T cools, we become greedier.
     d. Slowly decrease T (geometric cooling: T *= cooling_rate).
3. Stop when conflicts == 0 (solved) or the time/step budget is hit.
"""
import math
import random
import time
from copy import deepcopy

from sudoku_ai.board import SIZE, BOX, conflicts_count, is_complete
from sudoku_ai.solvers.genetic import _free_cells_by_box, _random_individual


def solve(puzzle, initial_temp=2.0, cooling_rate=0.9995, min_temp=0.001,
          max_steps=200000, time_budget=20.0):
    start = time.time()
    free_by_box = _free_cells_by_box(puzzle)
    current = _random_individual(puzzle, free_by_box)
    current_cost = conflicts_count(current)
    best_grid, best_cost = deepcopy(current), current_cost
    temp = initial_temp
    history = [current_cost]

    boxes_with_swaps = [cells for cells in free_by_box.values() if len(cells) >= 2]

    step = 0
    while step < max_steps and temp > min_temp and best_cost > 0:
        if time.time() - start > time_budget:
            break
        if not boxes_with_swaps:
            break
        cells = random.choice(boxes_with_swaps)
        (r1, c1), (r2, c2) = random.sample(cells, 2)

        current[r1][c1], current[r2][c2] = current[r2][c2], current[r1][c1]
        new_cost = conflicts_count(current)
        delta = new_cost - current_cost

        accept = delta <= 0 or random.random() < math.exp(-delta / max(temp, 1e-9))
        if accept:
            current_cost = new_cost
            if current_cost < best_cost:
                best_cost = current_cost
                best_grid = deepcopy(current)
        else:
            # reject: undo the swap
            current[r1][c1], current[r2][c2] = current[r2][c2], current[r1][c1]

        temp *= cooling_rate
        step += 1
        if step % 200 == 0:
            history.append(best_cost)

    return {
        "grid": best_grid,
        "solved": best_cost == 0 and is_complete(best_grid),
        "steps": step,
        "conflicts": best_cost,
        "final_temperature": temp,
        "time_seconds": time.time() - start,
        "history": history,
        "method": "simulated_annealing",
    }
