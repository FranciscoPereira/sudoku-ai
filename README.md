# Sudoku AI Lab

A Sudoku solver implemented five different ways, with two front ends:
a Python/Flask app, and a static client-side site (light/dark mode)
published on GitHub Pages.

**Live demo:** https://franciscopereira.github.io/sudoku-ai/

## Run it

### Static site (no install, runs entirely in the browser)

```bash
cd sudoku-ai/docs
python3 -m http.server 5051
# open http://127.0.0.1:5051
```

All five solvers are ported to plain JavaScript in `docs/static/` —
the neural net trains itself on the fly with gradient descent run in
your browser.

### Flask app (Python solvers, server-side)

```bash
cd sudoku-ai
pip install -r requirements.txt
python3 app.py
# open http://127.0.0.1:5050
```

## The five approaches

| Method | File | Type | Notes |
|---|---|---|---|
| Backtracking | `sudoku_ai/solvers/backtracking.py` | Classical CSP search | Ground-truth baseline, not a learning method |
| Neural Net | `sudoku_ai/solvers/neural_net.py` | Supervised learning | From-scratch numpy net trained with **gradient descent + manual backpropagation** |
| Q-Learning | `sudoku_ai/solvers/q_learning.py` | Reinforcement learning | Tabular RL, learns purely from trial-and-error rewards |
| Genetic Algorithm | `sudoku_ai/solvers/genetic.py` | Evolutionary search | Population + selection + crossover + mutation |
| Simulated Annealing | `sudoku_ai/solvers/simulated_annealing.py` | Local search | Single-trajectory temperature-controlled random walk |

Each solver module has a detailed docstring explaining *why* the
algorithm works the way it does — read those for the full explanation of
gradient descent/backprop, the Q-learning update rule, GA operators, and
the annealing acceptance criterion.

### Why these five, and why not PPO

Q-Learning was chosen over PPO as the RL example because it's the
simplest algorithm that still demonstrates genuine reward-driven learning
without needing a policy network, advantage estimation, or a clipped
surrogate objective — that contrast (supervised gradient descent net vs.
trial-and-error RL) is the pedagogically useful one. PPO would be a
natural extension: replace the Q-table with a small policy network that
outputs a digit distribution per cell, and train it with PPO's clipped
objective using the same reward function defined in `q_learning.py`.

Simulated Annealing was added alongside the Genetic Algorithm because
both solve the same underlying optimization view of Sudoku (minimize
`conflicts_count`, see `sudoku_ai/board.py`) but via fundamentally
different search strategies — population-based vs. single-trajectory —
which is a useful pairing for understanding metaheuristics in general.

## Project layout

```
sudoku-ai/
  app.py                  Flask app + API routes (server-side Python solvers)
  sudoku_ai/
    board.py              grid representation, validation, puzzle generation
    solvers/
      backtracking.py
      neural_net.py
      q_learning.py
      genetic.py
      simulated_annealing.py
  templates/index.html
  static/style.css, script.js

  docs/                   static site published via GitHub Pages
    index.html            light/dark theme toggle, persisted in localStorage
    static/
      board.js            JS port of sudoku_ai/board.py
      solver_*.js          JS port of each solver, same algorithms/comments
      theme.js             light/dark mode logic
      script.js            UI glue
      style.css            CSS variables for both themes
```

## Known limitations (by design, useful for learning)

- The neural net alone can't guarantee a full solve on hard puzzles; it's
  used to *guide* a backtracking search, similar to how policy networks
  guide search in systems like AlphaZero.
- Q-Learning's tabular state representation doesn't scale to the full
  board, so it's run as a per-cell local policy — it will often leave a
  few conflicts on harder puzzles, illustrating a real limitation of
  vanilla RL on large combinatorial spaces.
- The Genetic Algorithm and Simulated Annealing solvers are not
  guaranteed to fully converge within the time budget; the website shows
  the best (lowest-conflict) state found, not necessarily a full solve.
