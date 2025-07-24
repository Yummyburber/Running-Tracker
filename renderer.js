// Import ipcRenderer to communicate with main process
const { ipcRenderer } = require('electron');

// Get references to DOM elements
const form = document.getElementById('run-form');
const runList = document.getElementById('run-list');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const runIdInput = document.getElementById('run-id');
const statsSection = document.getElementById('stats-section');
const unitToggleBtn = document.getElementById('unit-toggle-btn');
const distanceUnitSpan = document.getElementById('distance-unit');
const goalsGrid = document.getElementById('goals-grid');
const addGoalBtn = document.getElementById('add-goal-btn');
const goalModal = document.getElementById('goal-modal');
const goalForm = document.getElementById('goal-form');
const closeGoalModal = document.getElementById('close-goal-modal');
const weatherTemp = document.getElementById('weather-temp');
const weatherCondition = document.getElementById('weather-condition');
const weatherHumidity = document.getElementById('weather-humidity');
const weatherWind = document.getElementById('weather-wind');
const getWeatherBtn = document.getElementById('get-weather-btn');
const mileageViewToggleBtn = document.getElementById('mileage-view-toggle');
let mileageView = 'week'; // 'week' or 'month'

// Chart.js instances
let distanceChart = null;
let categoryChart = null;

// Unit conversion constants
const MILES_TO_KM = 1.60934;
const KM_TO_MILES = 0.621371;

// Current unit state
let isMetric = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadRuns();
    loadStats();
    loadGoals();
    setupUnitToggle();
    setupGoalModal();
    setupWeatherButton();
    setupMileageViewToggle();
    
    // Show add run form by default
    showAddRunForm();
});

// Setup unit toggle functionality
function setupUnitToggle() {
    unitToggleBtn.addEventListener('click', () => {
        isMetric = !isMetric;
        updateUnitDisplay();
        loadRuns();
        loadStats();
    });
}

// Setup mileage view toggle
function setupMileageViewToggle() {
    if (mileageViewToggleBtn) {
        mileageViewToggleBtn.addEventListener('click', () => {
            mileageView = mileageView === 'week' ? 'month' : 'week';
            updateMileageViewToggleText();
            loadMileageChart();
        });
    }
}

function updateMileageViewToggleText() {
    if (mileageViewToggleBtn) {
        mileageViewToggleBtn.textContent = mileageView === 'week' ? 'Switch to Monthly View' : 'Switch to Weekly View';
    }
}

// Update unit display throughout the application
function updateUnitDisplay() {
    const unit = isMetric ? 'kilometers' : 'miles';
    const oppositeUnit = isMetric ? 'miles' : 'kilometers';
    distanceUnitSpan.textContent = unit;
    unitToggleBtn.textContent = `Switch to ${oppositeUnit}`;
}

// Convert distance between miles and kilometers
function convertDistance(distance, toMetric) {
    if (toMetric) {
        // Convert miles to kilometers
        return distance * MILES_TO_KM;
    } else {
        // Convert kilometers to miles
        return distance * KM_TO_MILES;
    }
}

// Format distance with appropriate unit
function formatDistance(distance) {
    // distance is always stored in miles, so convert to km if in metric mode
    const convertedDistance = isMetric ? distance * MILES_TO_KM : distance;
    return `${convertedDistance.toFixed(2)} ${isMetric ? 'km' : 'miles'}`;
}

// Calculate pace in minutes per unit
function calculatePace(distance, duration) {
    if (distance === 0) return 0;
    // Convert duration to minutes
    const durationInMinutes = duration / 60;
    // Calculate pace in minutes per unit
    return durationInMinutes / distance;
}

// Format duration as HH:MM:SS
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Format pace with appropriate unit
function formatPace(paceInMinutes) {
    if (paceInMinutes === 0) return 'N/A';
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.round((paceInMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /${isMetric ? 'km' : 'mile'}`;
}

// Setup goal modal functionality
function setupGoalModal() {
    addGoalBtn.addEventListener('click', () => {
        goalModal.style.display = 'block';
    });

    closeGoalModal.addEventListener('click', () => {
        goalModal.style.display = 'none';
    });

    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const goalData = {
            type: document.getElementById('goal-type').value,
            targetValue: parseFloat(document.getElementById('goal-target').value),
            startDate: document.getElementById('goal-start').value,
            endDate: document.getElementById('goal-end').value,
            status: 'active',
            notes: document.getElementById('goal-notes').value
        };

        try {
            await ipcRenderer.invoke('save-goal', goalData);
            goalForm.reset();
            goalModal.style.display = 'none';
            loadGoals();
        } catch (error) {
            showError(error.message);
        }
    });
}

// Load and display goals
async function loadGoals() {
    try {
        const goals = await ipcRenderer.invoke('get-goals');
        goalsGrid.innerHTML = '';
        
        goals.forEach(goal => {
            const goalElement = document.createElement('div');
            goalElement.className = 'goal-card';
            
            const progress = (goal.progress / goal.target_value) * 100;
            const goalType = goal.type.charAt(0).toUpperCase() + goal.type.slice(1);
            
            goalElement.innerHTML = `
                <h3>${goalType} Goal</h3>
                <div class="goal-progress">
                    <div class="goal-progress-bar" style="width: ${progress}%"></div>
                </div>
                <div class="goal-dates">
                    ${goal.progress} / ${goal.target_value} ${goal.type === 'distance' ? (isMetric ? 'km' : 'miles') : ''}
                    <br>
                    ${goal.start_date} to ${goal.end_date}
                </div>
                ${goal.notes ? `<p>${goal.notes}</p>` : ''}
            `;
            
            goalsGrid.appendChild(goalElement);
        });
    } catch (error) {
        showError(error.message);
    }
}

// Function to set form in edit mode
function setEditMode(run) {
    runIdInput.value = run.id;
    document.getElementById('date').value = run.date;
    // Convert the stored miles to the current display unit
    const displayDistance = isMetric ? run.distance * MILES_TO_KM : run.distance;
    document.getElementById('distance').value = displayDistance.toFixed(2);
    document.getElementById('category').value = run.category;
    document.getElementById('effort').value = run.effort;
    document.getElementById('notes').value = run.notes;
    
    // Set weather fields
    document.getElementById('weather-temp').value = run.weather_temp || '';
    document.getElementById('weather-condition').value = run.weather_condition || '';
    document.getElementById('weather-humidity').value = run.weather_humidity || '';
    document.getElementById('weather-wind').value = run.weather_wind_speed || '';

    // Set duration fields
    const hours = Math.floor(run.duration / 3600);
    const minutes = Math.floor((run.duration % 3600) / 60);
    const seconds = run.duration % 60;
    document.getElementById('hours').value = hours;
    document.getElementById('minutes').value = minutes;
    document.getElementById('seconds').value = seconds;

    submitBtn.textContent = 'Update Run';
    cancelBtn.style.display = 'block';
}

// Function to reset form to add mode
function resetForm() {
    form.reset();
    runIdInput.value = '';
    submitBtn.textContent = 'Add Run';
    cancelBtn.style.display = 'none';
    document.querySelectorAll('.error').forEach(el => el.textContent = '');
}

// Function to validate form inputs
function validateForm() {
    let isValid = true;
    const date = document.getElementById('date').value;
    const distance = parseFloat(document.getElementById('distance').value);
    const category = document.getElementById('category').value;
    const effort = parseInt(document.getElementById('effort').value);
    const hours = parseInt(document.getElementById('hours').value) || 0;
    const minutes = parseInt(document.getElementById('minutes').value) || 0;
    const seconds = parseInt(document.getElementById('seconds').value) || 0;

    // Check if at least one duration field is filled
    if (!hours && !minutes && !seconds) {
        showError('Please enter at least one duration field (hours, minutes, or seconds)');
        isValid = false;
    }

    // Validate effort (1-10)
    if (isNaN(effort) || effort < 1 || effort > 10) {
        showError('Effort must be between 1 and 10');
        isValid = false;
    }

    // Validate distance
    if (isNaN(distance) || distance <= 0) {
        showError('Distance must be greater than 0');
        isValid = false;
    }

    // Validate category
    if (!category) {
        showError('Please select a run category');
        isValid = false;
    }

    // Validate date
    if (!date) {
        showError('Please select a date');
        isValid = false;
    }

    return isValid;
}

// Function to show error messages
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Listen to form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
        const hours = parseInt(document.getElementById('hours').value) || 0;
        const minutes = parseInt(document.getElementById('minutes').value) || 0;
        const seconds = parseInt(document.getElementById('seconds').value) || 0;
        const duration = hours * 3600 + minutes * 60 + seconds;
        const inputDistance = parseFloat(document.getElementById('distance').value);
        
        // Convert input distance to miles for storage if we're in metric mode
        const distance = isMetric ? inputDistance * KM_TO_MILES : inputDistance;
        
        // Calculate pace in the current unit system
        const durationInMinutes = duration / 60;
        const pace = durationInMinutes / inputDistance;

        const runData = {
            date: document.getElementById('date').value,
            distance: distance,
            duration: duration,
            pace: pace,
            effort: parseInt(document.getElementById('effort').value),
            category: document.getElementById('category').value,
            notes: document.getElementById('notes').value,
            weather: {
                temp: parseFloat(document.getElementById('weather-temp').value) || null,
                condition: document.getElementById('weather-condition').value || null,
                humidity: parseInt(document.getElementById('weather-humidity').value) || null,
                windSpeed: parseFloat(document.getElementById('weather-wind').value) || null
            }
        };

        if (runIdInput.value) {
            runData.id = runIdInput.value;
            await ipcRenderer.invoke('update-run', runData);
        } else {
            await ipcRenderer.invoke('save-run', runData);
        }
        
        form.reset();
        runIdInput.value = '';
        submitBtn.textContent = 'Add Run';
        cancelBtn.style.display = 'none';
        loadRuns();
        loadStats();
        loadGoals();
    } catch (error) {
        showError(error.message);
    }
});

// Handle cancel button
cancelBtn.addEventListener('click', () => {
    form.reset();
    runIdInput.value = '';
    submitBtn.textContent = 'Add Run';
    cancelBtn.style.display = 'none';
});

// Function to load and display all runs
async function loadRuns() {
    try {
        const runs = await ipcRenderer.invoke('get-runs');
        runList.innerHTML = '';
        
        runs.forEach(run => {
            const runElement = document.createElement('div');
            runElement.className = 'run-item';
            
            const weatherInfo = run.weather_temp ? `
                <div class="run-weather">
                    ${fixEncoding(`${run.weather_temp}°F`)}
                    ${run.weather_condition ? fixEncoding(`• ${run.weather_condition}`) : ''}
                    ${run.weather_humidity ? fixEncoding(`• ${run.weather_humidity}% humidity`) : ''}
                    ${run.weather_wind_speed ? fixEncoding(`• ${run.weather_wind_speed} mph wind`) : ''}
                </div>
            ` : '';
            
            // Convert stored distance to current unit system for display
            const displayDistance = isMetric ? run.distance * MILES_TO_KM : run.distance;
            // Calculate pace in current unit system
            const durationInMinutes = run.duration / 60;
            const pace = durationInMinutes / displayDistance;
            
            runElement.innerHTML = `
                <div class="run-header">
                    <span class="run-date">${run.date}</span>
                    <span class="run-category">${run.category}</span>
                    <div class="run-actions">
                        <button onclick="editRun(${run.id})">Edit</button>
                        <button onclick="deleteRun(${run.id})">Delete</button>
                    </div>
                </div>
                <div class="run-details">
                    <div>Distance: ${formatDistance(run.distance)}</div>
                    <div>Duration: ${formatDuration(run.duration)}</div>
                    <div>Pace: ${formatPace(pace)}</div>
                    <div>Effort: ${run.effort}/10</div>
                </div>
                ${weatherInfo}
                ${run.notes ? `<div class="run-notes">${run.notes}</div>` : ''}
            `;
            runList.appendChild(runElement);
        });
    } catch (error) {
        showError(error.message);
    }
}

// Load statistics
async function loadStats() {
    try {
        const stats = await ipcRenderer.invoke('get-run-stats');
        
        // Update statistics cards
        document.getElementById('total-runs').textContent = stats.totalRuns;
        document.getElementById('total-distance').textContent = formatDistance(stats.totalDistance);
        document.getElementById('avg-pace').textContent = formatPace(stats.avgPace);

        // Update charts
        await loadMileageChart();
        updateCategoryChart(stats.runsByCategory);
    } catch (error) {
        showError(error.message);
    }
}

// Helper: get start of current week (Sunday)
function getStartOfCurrentWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    return new Date(now.getFullYear(), now.getMonth(), diff);
}

// Helper: get all dates for current week (Sun-Sat)
function getCurrentWeekDates() {
    const start = getStartOfCurrentWeek();
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
}

// Helper: get all week start dates for current month
function getWeeksOfCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const weeks = [];
    let current = new Date(firstDay);
    current.setDate(current.getDate() - current.getDay()); // go to Sunday before or on 1st
    while (current <= lastDay) {
        weeks.push(new Date(current));
        current.setDate(current.getDate() + 7);
    }
    return weeks;
}

// Helper: get month names
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Main chart loader
async function loadMileageChart() {
    try {
        const ctx = document.getElementById('distance-chart').getContext('2d');
        if (distanceChart) distanceChart.destroy();
        let chartType, label, labels, values;
        if (mileageView === 'week') {
            // --- Weekly Chart: Current Week, days Sun-Sat ---
            const runs = await ipcRenderer.invoke('get-runs');
            const weekDates = getCurrentWeekDates();
            labels = weekDates.map(d => d.toLocaleDateString(undefined, { weekday: 'short' }));
            values = weekDates.map(d => {
                const dateStr = d.toISOString().slice(0, 10);
                const dayRuns = runs.filter(r => r.date === dateStr);
                const total = dayRuns.reduce((sum, r) => sum + (isMetric ? r.distance * MILES_TO_KM : r.distance), 0);
                return total;
            });
            chartType = 'bar';
            label = `Mileage This Week (${isMetric ? 'km' : 'miles'})`;
        } else {
            // --- Monthly Chart: Last 12 months, highlight current month ---
            const monthly = await ipcRenderer.invoke('get-monthly-mileage');
            const now = new Date();
            const months = [];
            const monthLabels = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                months.push(key);
                monthLabels.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
            }
            labels = monthLabels;
            values = months.map(key => {
                const m = monthly.find(x => x.month === key);
                return m ? convertDistance(m.total, isMetric) : 0;
            });
            chartType = 'line';
            label = `Mileage by Month (${isMetric ? 'km' : 'miles'})`;
        }
        // Draw main chart
        distanceChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: labels.map((l, i) => (mileageView === 'month' && i === labels.length - 1) ? '#f39c12' : '#3498db'),
                    borderColor: '#3498db',
                    fill: mileageView === 'week',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: mileageView === 'week' ? 'Mileage This Week' : 'Mileage by Month'
                    }
                }
            }
        });
        // --- Weeks of Current Month Chart ---
        let weekMonthChart = window.weekMonthChart;
        const weekMonthCanvas = document.getElementById('week-month-chart');
        if (weekMonthCanvas) {
            if (weekMonthChart) weekMonthChart.destroy();
            const runs = await ipcRenderer.invoke('get-runs');
            const weeks = getWeeksOfCurrentMonth();
            const weekLabels = weeks.map((d, i) => `Week ${i + 1}`);
            const weekTotals = weeks.map((start, i) => {
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                return runs.filter(r => {
                    const d = new Date(r.date);
                    return d >= start && d <= end;
                }).reduce((sum, r) => sum + (isMetric ? r.distance * MILES_TO_KM : r.distance), 0);
            });
            window.weekMonthChart = new Chart(weekMonthCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: weekLabels,
                    datasets: [{
                        label: `Mileage by Week (${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()})`,
                        data: weekTotals,
                        backgroundColor: '#2ecc71',
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Weeks of Current Month'
                        }
                    }
                }
            });
        }
    } catch (error) {
        showError('Failed to load mileage chart: ' + (error.message || error));
        console.error('Mileage chart error:', error);
    }
}

// Update distance chart
function updateDistanceChart(data) {
    const ctx = document.getElementById('distance-chart').getContext('2d');
    
    if (distanceChart) {
        distanceChart.destroy();
    }

    const convertedData = data.map(d => ({
        date: d.date,
        distance: convertDistance(d.distance, isMetric)
    }));

    distanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: convertedData.map(d => d.date),
            datasets: [{
                label: `Distance (${isMetric ? 'km' : 'miles'})`,
                data: convertedData.map(d => d.distance),
                borderColor: '#3498db',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Update category chart
function updateCategoryChart(data) {
    const ctx = document.getElementById('category-chart').getContext('2d');
    
    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(d => d.category),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: [
                    '#3498db',
                    '#2ecc71',
                    '#e74c3c',
                    '#f1c40f',
                    '#9b59b6',
                    '#1abc9c'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Function to edit a run
async function editRun(id) {
    try {
        const run = await ipcRenderer.invoke('get-run', id);
        setEditMode(run);
    } catch (error) {
        showError(error.message);
    }
}

// Function to delete a run
async function deleteRun(id) {
    if (confirm('Are you sure you want to delete this run?')) {
        try {
            await ipcRenderer.invoke('delete-run', id);
            loadRuns();
            loadStats();
        } catch (error) {
            showError(error.message);
        }
    }
}

// Function to get current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.error('Geolocation not supported');
            reject(new Error('Geolocation is not supported by your browser. Please enable location services.'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 15000, // Increased timeout to 15 seconds
            maximumAge: 0
        };

        console.log('Requesting location...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('Location received:', position);
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMessage = 'Unable to retrieve your location. ';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Please allow location access in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out.';
                        break;
                    default:
                        errorMessage += 'An unknown error occurred.';
                }
                reject(new Error(errorMessage));
            },
            options
        );
    });
}

// Function to set weather-based background
function setWeatherBackground(condition) {
    const body = document.body;
    // Remove any existing weather classes
    body.classList.remove('weather-sunny', 'weather-cloudy', 'weather-rainy', 'weather-snowy', 'weather-clear', 'weather-stormy', 'weather-foggy', 'weather-misty');
    
    // Convert condition to lowercase for consistent matching
    const weatherCondition = condition.toLowerCase();
    
    // Map weather conditions to background classes
    if (weatherCondition.includes('thunder') || weatherCondition.includes('storm')) {
        body.classList.add('weather-stormy');
    } else if (weatherCondition.includes('sun') || weatherCondition.includes('clear')) {
        body.classList.add('weather-sunny');
    } else if (weatherCondition.includes('cloud')) {
        body.classList.add('weather-cloudy');
    } else if (weatherCondition.includes('rain') || weatherCondition.includes('drizzle') || weatherCondition.includes('shower')) {
        body.classList.add('weather-rainy');
    } else if (weatherCondition.includes('snow') || weatherCondition.includes('sleet') || weatherCondition.includes('flurries')) {
        body.classList.add('weather-snowy');
    } else if (weatherCondition.includes('fog') || weatherCondition.includes('haze')) {
        body.classList.add('weather-foggy');
    } else if (weatherCondition.includes('mist')) {
        body.classList.add('weather-misty');
    } else {
        body.classList.add('weather-clear');
    }
}

// Function to fetch weather data
async function fetchWeatherData() {
    try {
        // Show loading state
        getWeatherBtn.disabled = true;
        getWeatherBtn.textContent = 'Getting Location...';

        // Get location
        let location;
        try {
            location = await getCurrentLocation();
            console.log('Location obtained:', location);
        } catch (error) {
            console.error('Location error:', error);
            // Fallback to Aledo, Illinois
            location = {
                lat: 41.1992,
                lon: -90.7493
            };
            console.log('Using fallback location:', location);
        }
        
        // Update button text while fetching weather
        getWeatherBtn.textContent = 'Getting Weather...';
        
        try {
            console.log('Requesting weather data for:', location);
            // Get weather data
            const weather = await ipcRenderer.invoke('get-weather', location);
            console.log('Weather data received:', weather);
            
            if (!weather) {
                throw new Error('No weather data received');
            }
            
            // Update form fields
            weatherTemp.value = Math.round(weather.temp);
            weatherCondition.value = weather.condition;
            weatherHumidity.value = weather.humidity;
            weatherWind.value = Math.round(weather.windSpeed);

            // Set weather-based background
            setWeatherBackground(weather.condition);

            // Show success message
            showSuccess('Weather data updated successfully');
        } catch (error) {
            console.error('Weather API error:', error);
            showError('Failed to get weather data: ' + error.message);
        }
    } catch (error) {
        console.error('Weather update error:', error);
        showError('Failed to update weather: ' + error.message);
    } finally {
        // Reset button state
        getWeatherBtn.disabled = false;
        getWeatherBtn.textContent = 'Refresh Weather';
    }
}

// Setup weather button functionality
function setupWeatherButton() {
    getWeatherBtn.addEventListener('click', fetchWeatherData);
}

// Function to show success messages
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

// Function to show the add run form
function showAddRunForm() {
    // Reset form
    form.reset();
    runIdInput.value = '';
    submitBtn.textContent = 'Add Run';
    cancelBtn.style.display = 'none';
    
    // Show form
    form.classList.remove('hidden');
    runList.classList.add('hidden');
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    
    // Fetch weather data automatically
    fetchWeatherData();
}

// Add weather-based styles to the document
const style = document.createElement('style');
style.textContent = `
    .weather-sunny {
        background: linear-gradient(135deg, #ffd700, #ff8c00);
        color: #000;
    }
    
    .weather-cloudy {
        background: linear-gradient(135deg, #b0c4de, #778899);
        color: #fff;
    }
    
    .weather-rainy {
        background: linear-gradient(135deg, #4682b4, #1e3a5f);
        color: #fff;
    }
    
    .weather-snowy {
        background: linear-gradient(135deg, #e0ffff, #b0e0e6);
        color: #000;
    }
    
    .weather-clear {
        background: linear-gradient(135deg, #87ceeb, #1e90ff);
        color: #fff;
    }
    
    .weather-stormy {
        background: linear-gradient(135deg, #2c3e50, #34495e);
        color: #fff;
    }
    
    .weather-foggy {
        background: linear-gradient(135deg, #d3d3d3, #a9a9a9);
        color: #000;
    }
    
    .weather-misty {
        background: linear-gradient(135deg, #e6e6fa, #d8bfd8);
        color: #000;
    }
    
    /* Ensure form elements remain readable */
    .weather-sunny input,
    .weather-sunny select,
    .weather-sunny textarea {
        background-color: rgba(255, 255, 255, 0.9);
        color: #000;
    }
    
    .weather-cloudy input,
    .weather-cloudy select,
    .weather-cloudy textarea,
    .weather-rainy input,
    .weather-rainy select,
    .weather-rainy textarea,
    .weather-clear input,
    .weather-clear select,
    .weather-clear textarea,
    .weather-stormy input,
    .weather-stormy select,
    .weather-stormy textarea {
        background-color: rgba(255, 255, 255, 0.9);
        color: #000;
    }
    
    .weather-snowy input,
    .weather-snowy select,
    .weather-snowy textarea,
    .weather-foggy input,
    .weather-foggy select,
    .weather-foggy textarea,
    .weather-misty input,
    .weather-misty select,
    .weather-misty textarea {
        background-color: rgba(255, 255, 255, 0.9);
        color: #000;
    }
    
    /* Ensure buttons remain visible */
    button {
        background-color: rgba(255, 255, 255, 0.9);
        color: #000;
        border: 1px solid rgba(0, 0, 0, 0.2);
    }
    
    button:hover {
        background-color: rgba(255, 255, 255, 1);
    }
`;
document.head.appendChild(style);

// Fix encoding issues for old data
function fixEncoding(str) {
    return str
        .replace(/Â°F/g, '°F')
        .replace(/â€¢/g, '•');
}