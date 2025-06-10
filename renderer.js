// Import ipcRenderer to communicate with main process
const { ipcRenderer } = require('electron');

// Get references to the form and the run list in the DOM
const form = document.getElementById('run-form');
const runList = document.getElementById('run-list');


// Listen to form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault(); // Prevent the page from reloading
  // Gather data from the form fields
  const run = {
    date: document.getElementById('date').value,
    distance: parseFloat(document.getElementById('distance').value),
    effort: parseInt(document.getElementById('effort').value),
    notes: document.getElementById('notes').value
  };
  // Send the run data to the main process to save in the database
  await ipcRenderer.invoke('save-run', run);
  form.reset(); // Clear the form fields
  loadRuns();   // Refresh the list of runs
});

// Function to load and display all runs
async function loadRuns() {
    // Ask the main process for all runs
    const runs = await ipcRenderer.invoke('get-runs');
    runList.innerHTML = ''; // Clear the list
    // For each run, create a list iteam and add it to the list 
    runs.forEach(run => {
      const li = document.createElement('li');
      li.textContent = `${run.date}: ${run.distance} miles, Effort: ${run.effort}, Notes: ${run.notes}`;

      // Create a delete button
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.style.marginLeft = '10px';
      delBtn.onclick = async () => {
        await ipcRenderer.invoke('delete-run',run.id)
        loadRuns();
      };
      li.appendChild(delBtn);
      runList.appendChild(li);
    });
}

// Load Runs when the app starts
loadRuns();