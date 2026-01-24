This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Installation

Install JavaScript/TypeScript dependencies using `npm`.

```bash
# in the repository root
npm install
```

Install Python dependencies using `poetry`.

```bash
# in the repository root
poetry install
```

You may also use something like `pip` to install the dependencies manually. They are listed in `pyproject.toml`.

### Using mise to install NPM and Poetry

The version manager mise will manage the installation of NPM, Python, and Poetry automatically for you, ensuring you have the correct version of each. Learn how to install it here: https://mise.jdx.dev/getting-started.html

Once mise is installed, you can run this command:

```
# in the repository root
mise install
```

Follow any prompts to install any missing plugins. Usually, the command to add a plugin look something like this:

```
mise plugin add nodejs
mise plugin add poetry
mise plugin add python
```

## Running the server

To run the server that serves the page with the audio + visuals:

1. Run the app via:
   ```bash
   # in the repository root:
   npm run dev
   ```
2. Navigate to the app in your browser. By default the location will be [https://localhost:3000/](https://localhost:3000/)

## Running motion capture

Run motion capture via the following command, replacing the index `--cam 0` with the correct camera index for your system if needed.

```bash
# in the repository root:
poetry run python ./motion-tracking/skeleton.py -model yolov8s-pose.pt --cam 0
```

If this is the first time running this command on this machine, you'll have to wait for the file `yolov8s-pose.pt` to download (about 27MB).

## Contributing

This project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) for formatting the web code.

For your convenience, a pre-commit hook has been set up. It will be installed once you run `npm install` in the repo after pulling the latest changes.

This hook will run **any time you make a Git commit** to make sure your code is always formatted and linted before being merged.

If you need to make a commit with Eslint errors for some unavoidable reason, you can **disable the pre-commit hook** on the Git command line interface via the `-n` option. (Git GUIs will require a different method.)

In addition, a Github Action is run any time you make a pull request to the `main` branch that does the same thing, plus runs `npm run build` to make sure the build completes, including a TypeScript compile.

These measures are useful, especially if you make **frequent commits**. But in the event that you forget/that is not possible, more immediate feedback via your editor will save you lots of trouble. Therefore it is helpful to configure your settings/plugins with:

- ESLint errors/warnings in the editor
- TypeScript errors/warnings in the editor
- auto-formatting via local `prettier` installation on save.

## Learn Next.js

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Tone.js

Some helpful references for working with Tone.js:

- [Tone.js homepage](https://tonejs.github.io/) - You can test APIs by opening the console. There is an instance of `Tone` available there for you to play with.
- [Tone.js wiki - Time](https://github.com/Tonejs/Tone.js/wiki/Time) - Details about the time notation not covered clearly in the API docs
