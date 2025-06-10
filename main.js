//Import Electron's app and BroswerWindow modules, and ipcMain for communication
const{ app, BrowserWindow, ipcMain }=require('electron');
//Import path module to work with file and directory paths
const path = require('path');
//Import better-sqlite3 to use sqlite database
const Database = require('better-sqlite3');

//Create sqlite database file named 'runs.db'
const db = Database('runs.db');
//Create a table named 'runs' if it doesn't exist
db.prepare(`
   CREATE TABLE IF NOT EXISTS runs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     date Text,                            
     distance, REAL,                       
     effort INTEGER,                      
     notes TEXT                          
  )
`).run();
//Unique ID for each run
//Date of Run
//Distance in miles
 //Effort level (1-10)
 //Optional Notes
//Function to create the main application window
function createWindow() {
    // Create a new browser window with specified width and height
    const win= new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true, //Allow Node.js integration in renderer
            contextIsolation: false //Allow renderer to access Node.js modules
        }
    });


// Load the index.html file into window
win.loadFile('index.html');
}


// Handles 'save-run' event from renderer process to save a run in the database
ipcMain.handle('save-run', (Event, run)=> {
   // Prepare an SQL statement to insert a new run
   const stmt = db.prepare('INSERT INTO runs (date, distance, effort, notes) VALUES (?, ?, ?, ?)');
   // Execute the statement with data from the renderer
   stmt.run(run.date, run.distance, run.effort, run.notes);
});

//Handle 'get-runs' event from renderer process to fetch all runs
ipcMain.handle('get-runs', ()=>{
   //Prepare an SQL statement to select all runs, newest first
   const stmt=db.prepare('SELECT * FROM runs ORDER by date DESC');
   // Return all runs as an array of objects
   return stmt.all();
});

ipcMain.handle('delete-run', (Event, id)=> {
   // Prepare an SQL statement to delete a new run
   const stmt = db.prepare('DELETE FROM runs WHERE id =?');
   // Execute the statement with data from the renderer
   stmt.run(id);
});

// When Electron is ready, creates window
app.whenReady().then(createWindow);