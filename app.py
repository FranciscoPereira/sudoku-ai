"""Flask website for the Sudoku AI demo.

Routes:
  GET  /                  -> main page
  POST /api/generate      -> generate a new puzzle
  POST /api/solve/<method> -> solve the posted grid with the given method
                              method in {backtracking, genetic, annealing,
                                         neural_net, q_learning}
"""
from flask import Flask, jsonify, render_template, request

from sudoku_ai.board import generate_puzzle, parse_grid
from sudoku_ai.solvers import backtracking, genetic, simulated_annealing, neural_net, q_learning

app = Flask(__name__)

METHODS = {
    "backtracking": lambda grid: backtracking.solve(grid),
    "genetic": lambda grid: genetic.solve(grid, population_size=120, generations=600, time_budget=15.0),
    "annealing": lambda grid: simulated_annealing.solve(grid, time_budget=15.0),
    "neural_net": lambda grid: neural_net.solve(grid, time_budget=10.0),
    "q_learning": lambda grid: q_learning.solve(grid, episodes=250, time_budget=15.0),
}

EXPLANATIONS = {
    "backtracking": "Exact depth-first search with constraint propagation. "
                     "Used as the ground-truth baseline (not a learning method).",
    "genetic": "Evolves a population of candidate grids using selection, "
               "row-crossover and mutation, guided by a conflict-count fitness function.",
    "annealing": "A single solution takes a temperature-controlled random walk, "
                 "occasionally accepting worse moves to escape local optima, "
                 "cooling over time into a greedy search.",
    "neural_net": "A feedforward neural network (243-128-9) trained from scratch "
                   "with mini-batch gradient descent and manual backpropagation "
                   "to predict the most likely digit per cell, used to guide a search.",
    "q_learning": "A tabular Q-Learning agent learns, purely through trial-and-error "
                  "rewards (no labelled answers), which digit to place in each cell "
                  "to minimise constraint violations.",
}


@app.route("/")
def index():
    return render_template("index.html", explanations=EXPLANATIONS)


@app.route("/api/generate", methods=["POST"])
def api_generate():
    data = request.get_json(silent=True) or {}
    clues = int(data.get("clues", 32))
    clues = max(20, min(60, clues))
    puzzle, solution = generate_puzzle(num_clues=clues)
    return jsonify({"puzzle": puzzle, "solution": solution})


@app.route("/api/solve/<method>", methods=["POST"])
def api_solve(method):
    if method not in METHODS:
        return jsonify({"error": f"unknown method '{method}'"}), 400
    data = request.get_json(silent=True) or {}
    grid = data.get("grid")
    if grid is None:
        text = data.get("text", "")
        try:
            grid = parse_grid(text)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
    try:
        result = METHODS[method](grid)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5050)
