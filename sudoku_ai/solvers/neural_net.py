"""Neural network solver trained with Gradient Descent + Backpropagation.

Implemented from scratch with numpy (no PyTorch/TensorFlow) so that the
forward/backward pass is fully visible - this is the point of the demo:
showing *how* gradient descent and backprop actually update weights.

PROBLEM FRAMING
----------------
A single forward pass cannot reliably "solve" Sudoku end-to-end (it's a
hard combinatorial constraint problem, not a smooth function), so instead
we train a network to do what's tractable for a feedforward net: given a
cell and its row/column/box context, predict a probability distribution
over the 9 possible digits for that cell. We then use the network as a
*guide* inside a backtracking-style fill: always fill the empty cell the
network is most confident about, re-predict, and repeat - if a prediction
ever leads to a dead end, fall back to plain constraint propagation for
that cell. This mirrors how real "neural-guided search" systems are
built (e.g. AlphaZero's policy network proposing moves for a search
algorithm to verify) and keeps the gradient-descent part genuine and
inspectable.

NETWORK
--------
Input  (243,): one-hot encoding of the 9 cells in the same row, 9 in the
               same column, 9 in the same box (27 cells x 9 possible
               digit one-hot = 243), 0 if a cell is empty.
Hidden (128,): ReLU
Output (9,):  softmax over digits 1-9

TRAINING (gradient descent + backpropagation, by hand)
--------------------------------------------------------
For every (puzzle, solution) pair we generate, and for every empty cell of
the puzzle, the *target* is the digit that appears there in the solution.
We minimise cross-entropy loss with mini-batch gradient descent:

  forward:   z1 = X W1 + b1 ; a1 = ReLU(z1) ; z2 = a1 W2 + b2 ; p = softmax(z2)
  loss:      L  = -mean(log p[correct class])
  backward:  dz2 = p - one_hot(y)                  (softmax+CE gradient)
             dW2 = a1^T dz2 / N      db2 = mean(dz2)
             da1 = dz2 W2^T
             dz1 = da1 * (z1 > 0)                    (ReLU derivative)
             dW1 = X^T dz1 / N       db1 = mean(dz1)
  update:    W -= learning_rate * dW   (gradient DESCENT: step opposite
             the gradient, i.e. downhill on the loss surface)
"""
import time
from copy import deepcopy

import numpy as np

from sudoku_ai.board import SIZE, BOX, generate_puzzle, candidates, is_complete

INPUT_DIM = 27 * 9
HIDDEN_DIM = 128
OUTPUT_DIM = 9


def _context_cells(grid, r, c):
    row = [(r, j) for j in range(SIZE) if j != c]
    col = [(i, c) for i in range(SIZE) if i != r]
    br, bc = (r // BOX) * BOX, (c // BOX) * BOX
    box = [(i, j) for i in range(br, br + BOX) for j in range(bc, bc + BOX) if (i, j) != (r, c)]
    return row + col + box  # 8 + 8 + 8 = 24... pad to 27 with row/col/box anchors


def encode_cell(grid, r, c):
    """One-hot encode the 27-cell neighbourhood (row, column, box) of (r, c)."""
    br, bc = (r // BOX) * BOX, (c // BOX) * BOX
    cells = (
        [(r, j) for j in range(SIZE)]
        + [(i, c) for i in range(SIZE)]
        + [(i, j) for i in range(br, br + BOX) for j in range(bc, bc + BOX)]
    )
    vec = np.zeros(INPUT_DIM, dtype=np.float32)
    for k, (i, j) in enumerate(cells):
        v = grid[i][j]
        if v != 0:
            vec[k * 9 + (v - 1)] = 1.0
    return vec


class SudokuNet:
    def __init__(self, seed=42):
        rng = np.random.default_rng(seed)
        self.W1 = rng.normal(0, np.sqrt(2.0 / INPUT_DIM), (INPUT_DIM, HIDDEN_DIM)).astype(np.float32)
        self.b1 = np.zeros(HIDDEN_DIM, dtype=np.float32)
        self.W2 = rng.normal(0, np.sqrt(2.0 / HIDDEN_DIM), (HIDDEN_DIM, OUTPUT_DIM)).astype(np.float32)
        self.b2 = np.zeros(OUTPUT_DIM, dtype=np.float32)

    def forward(self, X):
        z1 = X @ self.W1 + self.b1
        a1 = np.maximum(0, z1)  # ReLU
        z2 = a1 @ self.W2 + self.b2
        z2 = z2 - z2.max(axis=1, keepdims=True)  # numerical stability
        exp = np.exp(z2)
        p = exp / exp.sum(axis=1, keepdims=True)  # softmax
        return z1, a1, p

    def predict_proba(self, X):
        return self.forward(X)[2]

    def train_step(self, X, y, lr):
        N = X.shape[0]
        z1, a1, p = self.forward(X)

        y_onehot = np.zeros_like(p)
        y_onehot[np.arange(N), y] = 1.0

        dz2 = (p - y_onehot) / N
        dW2 = a1.T @ dz2
        db2 = dz2.sum(axis=0)

        da1 = dz2 @ self.W2.T
        dz1 = da1 * (z1 > 0)
        dW1 = X.T @ dz1
        db1 = dz1.sum(axis=0)

        self.W1 -= lr * dW1
        self.b1 -= lr * db1
        self.W2 -= lr * dW2
        self.b2 -= lr * db2

        loss = -np.log(np.clip(p[np.arange(N), y], 1e-9, 1.0)).mean()
        return loss


def generate_training_data(num_puzzles=400, clues_range=(28, 45)):
    import random
    X_list, y_list = [], []
    for _ in range(num_puzzles):
        clues = random.randint(*clues_range)
        puzzle, solution = generate_puzzle(num_clues=clues)
        for r in range(SIZE):
            for c in range(SIZE):
                if puzzle[r][c] == 0:
                    X_list.append(encode_cell(puzzle, r, c))
                    y_list.append(solution[r][c] - 1)
    return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.int64)


def train(net=None, num_puzzles=300, epochs=8, batch_size=256, lr=0.05, progress_cb=None):
    if net is None:
        net = SudokuNet()
    X, y = generate_training_data(num_puzzles=num_puzzles)
    n = X.shape[0]
    history = []
    for epoch in range(epochs):
        perm = np.random.permutation(n)
        X, y = X[perm], y[perm]
        epoch_loss = 0.0
        batches = 0
        for start in range(0, n, batch_size):
            xb, yb = X[start:start + batch_size], y[start:start + batch_size]
            loss = net.train_step(xb, yb, lr)
            epoch_loss += loss
            batches += 1
        avg_loss = epoch_loss / max(batches, 1)
        history.append(avg_loss)
        if progress_cb:
            progress_cb(epoch, avg_loss)
    return net, history


_GLOBAL_NET = None


def get_or_train_default_net():
    global _GLOBAL_NET
    if _GLOBAL_NET is None:
        _GLOBAL_NET, _ = train(num_puzzles=120, epochs=5)
    return _GLOBAL_NET


def solve(puzzle, net=None, time_budget=10.0):
    start = time.time()
    net = net or get_or_train_default_net()
    grid = deepcopy(puzzle)
    fill_order = []

    def empties():
        return [(r, c) for r in range(SIZE) for c in range(SIZE) if grid[r][c] == 0]

    def attempt():
        empty = empties()
        if not empty:
            return True
        if time.time() - start > time_budget:
            return False

        best = None
        best_ranked, best_conf = None, -1.0
        for (r, c) in empty:
            cands = candidates(grid, r, c)
            if not cands:
                return False
            X = encode_cell(grid, r, c)[None, :]
            probs = net.predict_proba(X)[0]
            ranked = sorted(((probs[d - 1], d) for d in cands), reverse=True)
            conf = ranked[0][0]
            if conf > best_conf:
                best, best_ranked, best_conf = (r, c), ranked, conf

        r, c = best
        for conf, digit in best_ranked:
            grid[r][c] = digit
            fill_order.append((r, c, digit, float(conf)))
            if attempt():
                return True
            fill_order.pop()
        grid[r][c] = 0
        return False

    solved = attempt()
    return {
        "grid": grid,
        "solved": solved and is_complete(grid),
        "fill_order": fill_order,
        "time_seconds": time.time() - start,
        "method": "neural_net_gradient_descent",
    }
