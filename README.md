# Can you engineer luck?

**Serendipity Lab · Kuei Maesaka · Sakana AI Project**

An interactive simulation exploring **outbound luck (exploration)**, **inbound luck (attraction)**, and **recognition (preparedness)**.

[Open the live lab](https://kueim.github.io/serendipity-lab/)

No account, API key, database, package install, or build step is needed. Experiments run in your browser. This is an uncalibrated computational model, not empirical evidence about the causes of human luck.

## Run your own copy

Install Python 3, then download this repository using **Code → Download ZIP** and extract it, or clone it:

```sh
git clone https://github.com/KueiM/serendipity-lab.git
cd serendipity-lab
python3 -m http.server 4173 --directory dist
```

Open **http://localhost:4173/**. Stop the server with Ctrl+C. On Windows, use `py -3` instead of `python3` if needed. Serve the folder over HTTP; opening the HTML directly as a file will not reliably load modules and workers.

## Publish your own website

1. Click **Fork** on this repository and create your own copy.
2. In your fork, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Open **Actions** and enable workflows if GitHub asks.
4. Select **Deploy lab to GitHub Pages**, choose **Run workflow**, and run it on `main`.
5. After the deployment succeeds, open the website URL shown in the workflow or Pages settings. With the default repository name, it will be `https://YOUR-USERNAME.github.io/serendipity-lab/`.

Future pushes to `main` test and publish automatically. Update the live-demo link above for your fork. GitHub Pages availability depends on your account and repository settings. You can also deploy the contents of `dist/` to any static web host; keep its files together.

## What you can test

- **Paired live field:** compare two allocations under equal effort and time budgets, inspect opportunities, and replay the same world.
- **Findings & patterns:** 55 conditions covering strategies, mechanism removals, interactions, environments, sensitivity, an allocation grid, independent grid validation, and factorial replication.
- **Evolution:** three 24-strategy populations evolve for 20 generations with crossover, adaptive mutation, elites, and random immigrants. Checkpoints compete on separate selection worlds before a locked champion faces final testing.
- **Exports:** save exact settings, per-world results, statistical evidence, and evolution history as JSON, CSV, or Markdown.

## Reproduce and test

Install Node.js 22 or later to run the checks and command-line study. No npm dependencies are required.

```sh
npm test
npm run research -- 42 300
```

The study arguments are base seed, worlds per condition (10–1,000), and optional output folder. Outputs are written under `research-output/` with the analysis version and seed in their filenames.

## Research methods

Model version **2.0.0**, analysis version **3.0.0**.

All allocations share a 100-point budget. Mechanism removals disable incremental benefits without reallocating effort; baseline capabilities remain. Removing preparedness also removes encounter-based learning. These effects measure dependence at the chosen allocation, not the optimal effort allocation.

Success rates use 95% Wilson intervals. Exploratory differences use 2,000 paired percentile bootstrap resamples. Six predeclared hypotheses (three removal effects and three pairwise interactions) are evaluated on independent discovery and replication blocks. Both adjusted bands must clear the chosen practical-effect threshold in the same direction. These use 10,000 paired resamples and Bonferroni alpha allocation across 12 bands. Coverage is approximate; constant contrasts are marked insufficient variation. Ranking stability uses 1,000 paired resamples, splitting winner credit among ties; it is not a probability of true optimality.

Study streams are 0 (discovery), 1 (grid holdout), and 2 (factorial replication). Seeds follow `uint32(base + stream * 1000003 + index)`.

Evolution ranks success first and breaks ties with fitness. Each generation shares 8 fixed anchor and 16 rotating worlds. Four distinct elites, tournament selection, crossover, adaptive mutation, and three immigrants preserve alternatives. Checkpoints at generations 1, 4, 8, 12, 16, and 20 compete on 100 selection worlds. Monitoring uses a fixed 24-world block and never affects selection. Final testing compares the locked champion against balanced effort and its source restart’s initial leader, with two adjusted 97.5% bootstrap bands. Training streams are 100/125/150 for anchors and 101–120/126–145/151–170 for rotating worlds; monitor, selection, and final-test streams are 200, 201, and 202.

Reusing a base seed reuses evaluation worlds. Repeated tuning against the same tests is not independent validation. Intervals describe simulated world variation, not uncertainty about the model’s validity. Results depend on hypothetical rules and do not establish real-world causes of luck or a global optimum.

References: [NIST Wilson intervals](https://itl.nist.gov/div898/handbook/prc/section2/prc241.htm), [NIST Bonferroni method](https://itl.nist.gov/div898/handbook/prc/section4/prc473.htm).

## Source map

- `dist/model.js`: seeded simulator and outcome accounting.
- `dist/experiments.js`: research suite, evolutionary search, and CSV export.
- `dist/statistics.js`: replication decisions, adjusted bands, ranking stability.
- `dist/worker.js`: cancellable background experiments.
- `dist/app.js`: interface, visualizations, and exports.
- `model.test.js`: model and analysis checks.

The interface uses Google Fonts with system-font fallbacks. Simulation data stays in the browser unless you export and share it.

## License

[MIT](LICENSE). You may use, modify, and host your own copy; retain the copyright and license notice when distributing the software.
