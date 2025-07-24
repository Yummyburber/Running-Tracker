//Import Electron's app and BroswerWindow modules, and ipcMain for communication
const { app, BrowserWindow, ipcMain } = require('electron');
//Import path module to work with file and directory paths
const path = require('path');
//Import better-sqlite3 to use sqlite database
const Database = require('better-sqlite3');
const axios = require('axios');

// Create database connection
const db = new Database('runs.db');

// API configuration
const WEATHER_API_KEY = '5ed0dafe4e57e43bf231c5866147ebcc';
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';

// Weather API service
class WeatherService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    async getWeatherData(lat, lon) {
        const cacheKey = `${lat},${lon}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            console.log('Fetching weather data for:', lat, lon);
            const response = await axios.get(WEATHER_API_URL, {
                params: {
                    lat,
                    lon,
                    appid: WEATHER_API_KEY,
                    units: 'imperial'
                }
            });

            console.log('Weather API response:', response.data);

            const weatherData = {
                temp: response.data.main.temp,
                condition: response.data.weather[0].main,
                humidity: response.data.main.humidity,
                windSpeed: response.data.wind.speed
            };

            this.cache.set(cacheKey, {
                data: weatherData,
                timestamp: Date.now()
            });

            return weatherData;
        } catch (error) {
            console.error('Weather API Error:', error.response?.data || error.message);
            throw new Error('Failed to fetch weather data: ' + (error.response?.data?.message || error.message));
        }
    }
}

// Initialize services
const weatherService = new WeatherService();

// Register IPC handlers
function registerIpcHandlers() {
    // Weather handler
    ipcMain.handle('get-weather', async (event, { lat, lon }) => {
        console.log('Weather handler called with:', { lat, lon });
        try {
            if (!lat || !lon) {
                throw new Error('Invalid location coordinates');
            }
            const weather = await weatherService.getWeatherData(lat, lon);
            console.log('Weather data retrieved:', weather);
            return weather;
        } catch (error) {
            console.error('Weather handler error:', error);
            throw new Error('Failed to get weather data: ' + error.message);
        }
    });

    // Existing handlers
    ipcMain.handle('save-run', async (event, run) => {
        try {
            const stmt = db.prepare(`
                INSERT INTO runs (
                    date, distance, duration, pace, effort, category, notes,
                    weather_temp, weather_condition, weather_humidity, weather_wind_speed
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                run.date,
                run.distance,
                run.duration,
                run.pace,
                run.effort,
                run.category,
                run.notes,
                normalizeWeatherString(run.weather?.temp) || null,
                normalizeWeatherString(run.weather?.condition) || null,
                normalizeWeatherString(run.weather?.humidity) || null,
                normalizeWeatherString(run.weather?.windSpeed) || null
            );
            
            return result.lastInsertRowid;
        } catch (error) {
            throw new Error('Failed to save run: ' + error.message);
        }
    });

    // Handles 'update-run' event to update an existing run
    ipcMain.handle('update-run', async (event, run) => {
        try {
            const stmt = db.prepare(`
                UPDATE runs 
                SET date = ?, distance = ?, duration = ?, pace = ?, effort = ?, 
                    category = ?, notes = ?, weather_temp = ?, weather_condition = ?,
                    weather_humidity = ?, weather_wind_speed = ?
                WHERE id = ?
            `);
            
            const result = stmt.run(
                run.date,
                run.distance,
                run.duration,
                run.pace,
                run.effort,
                run.category,
                run.notes,
                normalizeWeatherString(run.weather?.temp) || null,
                normalizeWeatherString(run.weather?.condition) || null,
                normalizeWeatherString(run.weather?.humidity) || null,
                normalizeWeatherString(run.weather?.windSpeed) || null,
                run.id
            );
            
            return { success: true };
        } catch (error) {
            throw new Error('Failed to update run: ' + error.message);
        }
    });

    // Handles 'get-run' event to fetch a single run
    ipcMain.handle('get-run', async (event, id) => {
        try {
            const stmt = db.prepare('SELECT * FROM runs WHERE id = ?');
            const run = stmt.get(id);
            
            if (!run) {
                throw new Error('Run not found');
            }
            
            return run;
        } catch (error) {
            throw new Error('Failed to get run: ' + error.message);
        }
    });

    // Handles 'get-runs' event from renderer process to fetch all runs
    ipcMain.handle('get-runs', async () => {
        try {
            const stmt = db.prepare('SELECT * FROM runs ORDER BY date DESC');
            return stmt.all();
        } catch (error) {
            throw new Error('Failed to get runs: ' + error.message);
        }
    });

    // Handles 'get-run-stats' event to fetch running statistics
    ipcMain.handle('get-run-stats', async () => {
        try {
            // Get total runs and distance
            const totals = db.prepare(`
                SELECT 
                    COUNT(*) as totalRuns,
                    SUM(distance) as totalDistance,
                    AVG(pace) as avgPace
                FROM runs
            `).get();

            // Get distance by date for the line chart
            const distanceByDate = db.prepare(`
                SELECT date, distance
                FROM runs
                ORDER BY date ASC
            `).all();

            // Get run count by category for the pie chart
            const runsByCategory = db.prepare(`
                SELECT category, COUNT(*) as count
                FROM runs
                GROUP BY category
                ORDER BY count DESC
            `).all();

            return {
                totalRuns: totals.totalRuns || 0,
                totalDistance: totals.totalDistance || 0,
                avgPace: totals.avgPace || 0,
                distanceByDate,
                runsByCategory
            };
        } catch (error) {
            throw new Error('Failed to get run statistics: ' + error.message);
        }
    });

    // Handles 'delete-run' event to delete a run
    ipcMain.handle('delete-run', async (event, id) => {
        try {
            const stmt = db.prepare('DELETE FROM runs WHERE id = ?');
            const result = stmt.run(id);
            return { success: true };
        } catch (error) {
            throw new Error('Failed to delete run: ' + error.message);
        }
    });

    // Add new IPC handlers for goals and achievements
    ipcMain.handle('save-goal', async (event, goal) => {
        try {
            const stmt = db.prepare(`
                INSERT INTO goals (type, target_value, start_date, end_date, status, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                goal.type,
                goal.targetValue,
                goal.startDate,
                goal.endDate,
                goal.status,
                goal.notes
            );
            
            return result.lastInsertRowid;
        } catch (error) {
            throw new Error('Failed to save goal: ' + error.message);
        }
    });

    // Handles 'get-goals' event to fetch all goals
    ipcMain.handle('get-goals', async () => {
        try {
            const stmt = db.prepare('SELECT * FROM goals ORDER BY end_date DESC');
            return stmt.all();
        } catch (error) {
            throw new Error('Failed to get goals: ' + error.message);
        }
    });

    ipcMain.handle('update-goal-progress', async (event, { id, progress }) => {
        try {
            const stmt = db.prepare('UPDATE goals SET progress = ? WHERE id = ?');
            const result = stmt.run(progress, id);
            return { success: true };
        } catch (error) {
            throw new Error('Failed to update goal progress: ' + error.message);
        }
    });

    // Handles 'get-achievements' event to fetch all achievements
    ipcMain.handle('get-achievements', async () => {
        try {
            const stmt = db.prepare('SELECT * FROM achievements ORDER BY date_earned DESC');
            return stmt.all();
        } catch (error) {
            throw new Error('Failed to get achievements: ' + error.message);
        }
    });

    // Handles 'get-weekly-mileage' event to fetch weekly mileage aggregates
    ipcMain.handle('get-weekly-mileage', async () => {
        try {
            // SQLite: strftime('%Y-%W', date) gives year-week
            const weeklyMileage = db.prepare(`
                SELECT strftime('%Y-%W', date) as week, SUM(distance) as total
                FROM runs
                GROUP BY week
                ORDER BY week ASC
            `).all();
            return weeklyMileage;
        } catch (error) {
            throw new Error('Failed to get weekly mileage: ' + error.message);
        }
    });

    // Handles 'get-monthly-mileage' event to fetch monthly mileage aggregates
    ipcMain.handle('get-monthly-mileage', async () => {
        try {
            // SQLite: strftime('%Y-%m', date) gives year-month
            const monthlyMileage = db.prepare(`
                SELECT strftime('%Y-%m', date) as month, SUM(distance) as total
                FROM runs
                GROUP BY month
                ORDER BY month ASC
            `).all();
            return monthlyMileage;
        } catch (error) {
            throw new Error('Failed to get monthly mileage: ' + error.message);
        }
    });
}

function normalizeWeatherString(str) {
    return typeof str === 'string' ? str.normalize('NFC') : str;
}

// Function to create the main application window
function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableBlinkFeatures: 'Geolocation',
            webSecurity: true
        }
    });

    // Enable geolocation
    win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['geolocation'];
        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            callback(false);
        }
    });

    // Load the index.html file into window
    win.loadFile('index.html');

    // Open DevTools for debugging
    win.webContents.openDevTools();
}

// Initialize the application
app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});