"""Reinforcement Learning solver using tabular Q-Learning.

WHY Q-LEARNING (vs PPO)
-------------------------
PPO is a policy-gradient method built for continuous/large action spaces
and needs a neural network policy + value function, advantage estimation,
and a clipped surrogate objective - a lot of moving parts. Q-Learning is
the simplest RL algorithm that still demonstrates the core RL idea (an
agent learns a value function purely from trial-and-error reward signals,
with no labelled "correct answer" ever given) which is the clearest way to
contrast against the *supervised* gradient-descent net above. A note on
PPO is included in the README for further reading/extension.

MDP FORMULATION
-----------------
* State:  the digit currently placed at a focal empty cell, PLUS a simple
          hashed summary of how many conflicts that cell currently has.
          (Full board state is intractable for a table; we instead let the
          agent learn a per-cell policy and run it cell-by-cell, similar to
          how the GA/SA explore via local moves.)
* Action: choose a digit 1-9 to place in the focal cell.
* Reward: +1 if the placement creates zero conflicts in that cell's row,
          column and box; otherwise a negative reward equal to minus the
          number of conflicts created. +10 bonus if the whole board
          becomes solved.
* Episode: one pass attempting to fill all empty cells of a puzzle in a
           shuffled order, cell by cell, with the agent's current policy.

LEARNING RULE (the "Q-Learning" update)
-----------------------------------------
  Q(s, a) <- Q(s, a) + alpha * [ r + gamma * max_a' Q(s', a') - Q(s, a) ]

This is off-policy temporal-difference learning: after taking action a in
state s and observing reward r and next state s', we nudge our estimate of
Q(s, a) towards the observed reward plus our best estimate of future value.
Over many episodes (with epsilon-greedy exploration that decays over time)
the Q-table converges towards values that let a greedy policy avoid
conflicts - effectively learning local Sudoku constraint-satisfaction
through pure trial and error, no hand-coded rules about *which* digit is
correct.
"""
import random
import time
from collections import defaultdict
from copy import deepcopy

from sudoku_ai.board import SIZE, conflicts_count, is_complete


def _cell_conflicts(grid, r, c):
    val = grid[r][c]
    if val == 0:
        return 0
    count = 0
    for i in range(SIZE):
        if i != c and grid[r][i] == val:
            count += 1
        if i != r and grid[i][c] == val:
            count += 1
    br, bc = (r // 3) * 3, (c // 3) * 3
    for i in range(br, br + 3):
        for j in range(bc, bc + 3):
            if (i, j) != (r, c) and grid[i][j] == val:
                count += 1
    return count


def _state_key(grid, r, c):
    """Cheap state summary: conflict counts of the row/col/box neighbourhood,
    bucketed, so the table stays small enough to learn from a handful of
    episodes while still reflecting how "crowded" the cell's constraints are.
    """
    row_used = tuple(sorted(v for v in grid[r] if v != 0))
    col_used = tuple(sorted(grid[i][c] for i in range(SIZE) if grid[i][c] != 0))
    br, bc = (r // 3) * 3, (c // 3) * 3
    box_used = tuple(sorted(grid[i][j] for i in range(br, br + 3) for j in range(bc, bc + 3) if grid[i][j] != 0))
    return (row_used, col_used, box_used)


def train_agent(puzzle, episodes=300, alpha=0.4, gamma=0.9,
                 epsilon_start=1.0, epsilon_end=0.05):
    Q = defaultdict(lambda: [0.0] * 9)  # Q[state][digit-1] -> value
    empty_cells = [(r, c) for r in range(SIZE) for c in range(SIZE) if puzzle[r][c] == 0]
    history = []

    for ep in range(episodes):
        epsilon = epsilon_start + (epsilon_end - epsilon_start) * (ep / max(episodes - 1, 1))
        grid = deepcopy(puzzle)
        order = empty_cells[:]
        random.shuffle(order)

        for (r, c) in order:
            state = _state_key(grid, r, c)
            if random.random() < epsilon:
                action_digit = random.randint(1, 9)
            else:
                action_digit = max(range(9), key=lambda i: Q[state][i]) + 1

            grid[r][c] = action_digit
            conflicts = _cell_conflicts(grid, r, c)
            reward = 1.0 if conflicts == 0 else -float(conflicts)
            if is_complete(grid) and conflicts_count(grid) == 0:
                reward += 10.0

            next_state = _state_key(grid, r, c)
            best_next = max(Q[next_state])
            td_target = reward + gamma * best_next
            Q[state][action_digit - 1] += alpha * (td_target - Q[state][action_digit - 1])

        history.append(conflicts_count(grid))

    return Q, history


def solve(puzzle, episodes=300, time_budget=20.0):
    start = time.time()
    Q, history = train_agent(puzzle, episodes=episodes)

    # Greedy rollout using the learned policy.
    grid = deepcopy(puzzle)
    empty_cells = [(r, c) for r in range(SIZE) for c in range(SIZE) if puzzle[r][c] == 0]
    random.shuffle(empty_cells)
    for (r, c) in empty_cells:
        if time.time() - start > time_budget:
            break
        state = _state_key(grid, r, c)
        action_digit = max(range(9), key=lambda i: Q[state][i]) + 1
        grid[r][c] = action_digit

    conflicts = conflicts_count(grid)
    return {
        "grid": grid,
        "solved": conflicts == 0 and is_complete(grid),
        "conflicts": conflicts,
        "episodes": episodes,
        "time_seconds": time.time() - start,
        "history": history,
        "method": "q_learning",
    }
