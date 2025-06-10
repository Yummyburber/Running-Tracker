# Running Tracker

A simple cross-platform desktop app to log your runs, track effort and distance, and manage your running history. Built with Electron, JavaScript, HTML, CSS, and SQLite.

## Features

- Log each run with date, distance, effort (1-10), and notes
- View a list of all logged runs
- Delete runs from your history
- Append run details to a single notes file (e.g., for journaling in Notepad)
- Data stored locally in a lightweight SQLite database

## Setup & Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/YOUR_USERNAME/Running-Tracker.git
   cd Running-Tracker
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Rebuild native modules for Electron:**
   ```sh
   npx electron-rebuild
   ```

4. **Start the app:**
   ```sh
   npm start
   ```

## Usage

- Fill out the form to log a new run.
- All runs are listed below the form. Each run can be deleted with the "Delete" button.
- Use the "Send to Notes" button to append a run's details to a `RunningLog.txt` file in your Documents folder, which opens in your default text editor.

## Project Structure

- `main.js` — Electron main process, database setup, IPC handlers
- `index.html` — App UI
- `renderer.js` — UI logic and communication with main process
- `styles.css` — App styling
- `runs.db` — SQLite database (created automatically)
- `.gitignore` — Ignores `node_modules` and `runs.db`

## Requirements
- [Node.js](https://nodejs.org/) (v16 or newer recommended)
- [npm](https://www.npmjs.com/)

## Notes
- All data is stored locally; nothing is uploaded to the cloud.
- If you want to reset your data, delete the `runs.db` file.

## License