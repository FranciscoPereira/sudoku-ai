"""Genetic Algorithm solver.

WHY/HOW (explanation)
----------------------
A Genetic Algorithm is inspired by biological evolution: a *population* of
candidate solutions ("chromosomes") evolves over generations through
selection, crossover and mutation, guided only by a *fitness function* -
there is no gradient, no derivative, just "is this candidate better than
that one?". This makes it a good fit for combinatorial problems like
Sudoku where the search space is discrete and the objective (number of
rule violations) is not differentiable.

Representation
  Each chromosome is a full 9x9 grid. The given clues are frozen; only the
  empty cells are free genes. Each 3x3 box is initialised as a permutation
  of 1-9 placed into its free cells, which automatically satisfies the
  "box" constraint and leaves row/column conflicts as the only fitness
  penalty to evolve away.

Fitness
  fitness = -conflicts_count(grid)  (we want to *maximise* fitness, i.e.
  minimise rule violations; 0 conflicts = solved).

Operators
  * Selection: tournament selection (pick k random individuals, keep the
    fittest) - simple and keeps selection pressure tunable via k.
  * Crossover: row-wise crossover - each child takes each of the 9 rows
    from one of its two parents (since rows/boxes are already internally
    consistent, swapping whole rows preserves a lot of useful structure).
  * Mutation: with small probability, swap two free cells within the same
    box (keeps the box constraint intact while exploring new states).
"""
import random
import time
from copy import deepcopy

from sudoku_ai.board import SIZE, BOX, conflicts_count, is_complete


def _free_cells_by_box(puzzle):
    boxes = {}
    for r in range(SIZE):
        for c in range(SIZE):
            if puzzle[r][c] == 0:
                key = (r // BOX, c // BOX)
                boxes.setdefault(key, []).append((r, c))
    return boxes


def _random_individual(puzzle, free_by_box):
    grid = deepcopy(puzzle)
    for (br, bc), cells in free_by_box.items():
        used = {grid[r][c] for r in range(br * BOX, br * BOX + BOX)
                 for c in range(bc * BOX, bc * BOX + BOX) if grid[r][c] != 0}
        missing = [v for v in range(1, 10) if v not in used]
        random.shuffle(missing)
        for (r, c), v in zip(cells, missing):
            grid[r][c] = v
    return grid


def _fitness(grid):
    return -conflicts_count(grid)


def _crossover(p1, p2):
    child = []
    for r in range(SIZE):
        child.append(deepcopy(p1[r] if random.random() < 0.5 else p2[r]))
    return child


def _mutate(grid, free_by_box, rate):
    for cells in free_by_box.values():
        if len(cells) >= 2 and random.random() < rate:
            (r1, c1), (r2, c2) = random.sample(cells, 2)
            grid[r1][c1], grid[r2][c2] = grid[r2][c2], grid[r1][c1]


def _tournament(pop, fits, k=4):
    idxs = random.sample(range(len(pop)), k)
    best = max(idxs, key=lambda i: fits[i])
    return pop[best]


def solve(puzzle, population_size=150, generations=2000, mutation_rate=0.15,
          time_budget=20.0):
    start = time.time()
    free_by_box = _free_cells_by_box(puzzle)
    population = [_random_individual(puzzle, free_by_box) for _ in range(population_size)]
    best_grid, best_fit = None, float("-inf")
    history = []

    for gen in range(generations):
        fits = [_fitness(ind) for ind in population]
        gen_best_idx = max(range(len(population)), key=lambda i: fits[i])
        if fits[gen_best_idx] > best_fit:
            best_fit = fits[gen_best_idx]
            best_grid = deepcopy(population[gen_best_idx])
        history.append(-best_fit)  # conflicts over time

        if best_fit == 0 or time.time() - start > time_budget:
            break

        new_population = [deepcopy(best_grid)]  # elitism
        while len(new_population) < population_size:
            parent1 = _tournament(population, fits)
            parent2 = _tournament(population, fits)
            child = _crossover(parent1, parent2)
            _mutate(child, free_by_box, mutation_rate)
            new_population.append(child)
        population = new_population

    return {
        "grid": best_grid,
        "solved": best_fit == 0 and is_complete(best_grid),
        "generations": gen + 1,
        "conflicts": -best_fit,
        "time_seconds": time.time() - start,
        "history": history,
        "method": "genetic_algorithm",
    }
