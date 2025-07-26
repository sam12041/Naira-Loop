// Configuration
let newAnnouncement = "Earn points from tasks and referrals"
let version = "Version 2.0.0";
let updateDate = "Last Updated: April 14, 2025";
const config = {
    admins: ['Tenoco'], // List of admin usernames
    github: {
        owner: 'Delinqs',
        repo: 'packcash',
        path: 'database.json',
        token: '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' // Replace with actual token
    }
};

// Global Variables
let currentUser = null;
let database = null;
let announcement = document.getElementById("announcement");
announcement.innerHTML = newAnnouncement;
document.querySelector(".version-tag").innerHTML = version;
document.querySelector(".update-date").innerHTML = updateDate;

// Utility Functions
function showAlert(message) {
    const alert = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('alert-message');
    alertMessage.textContent = message;
    alert.classList.remove('hidden');
}

function closeAlert() {
    document.getElementById('custom-alert').classList.add('hidden');
}

function setCookie(name, value, days) {
    const encryptedValue = btoa(value); // Simple base64 encryption
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encryptedValue};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split('=').map(c => c.trim());
        if (cookieName === name) {
            return atob(cookieValue); // Decrypt base64
        }
    }
    return null;
}

// Add spinner styles to the document head
const addSpinnerStyles = () => {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .db-spinner-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      visibility: hidden;
      opacity: 0;
      transition: visibility 0s linear 0.2s, opacity 0.2s;
    }
    
    .db-spinner-container {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .db-spinner-overlay.active {
      visibility: visible;
      opacity: 1;
      transition-delay: 0s;
    }
    
    .db-spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: db-spin 1s ease-in-out infinite;
    }
    
    @keyframes db-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleElement);
};

// Create spinner DOM elements
const createSpinnerElements = () => {
  const overlay = document.createElement('div');
  overlay.className = 'db-spinner-overlay';
  
  const spinnerContainer = document.createElement('div');
  spinnerContainer.className = 'db-spinner-container';
  
  const spinner = document.createElement('div');
  spinner.className = 'db-spinner';
  
  spinnerContainer.appendChild(spinner);
  overlay.appendChild(spinnerContainer);
  document.body.appendChild(overlay);
  
  return {
    show: () => {
      overlay.classList.add('active');
    },
    hide: () => {
      overlay.classList.remove('active');
    }
  };
};

// Initialize spinner
addSpinnerStyles();
const dbSpinner = createSpinnerElements();

// Helper function to create a random delay between min and max milliseconds
const randomDelay = (min, max) => {
    const delayTime = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`Waiting for ${delayTime}ms before database operation`);
    return new Promise(resolve => setTimeout(resolve, delayTime));
};

async function fetchDatabase() {
    try {
        // Show spinner
        dbSpinner.show();
        
        // Add random delay (2-5 seconds) before API call
        await randomDelay(2000, 5000);
        
        const response = await fetch(`https://api.github.com/repos/${config.github.owner}/${config.github.repo}/contents/${config.github.path}`, {
            headers: {
                'Authorization': `token ${config.github.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                // Create new database if it doesn't exist
                return initializeDatabase();
            }
            throw new Error(`Failed to fetch database: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = atob(data.content);
        database = JSON.parse(content);
        
        // Hide spinner
        dbSpinner.hide();
        return database;
    } catch (error) {
        console.error('Error fetching database:', error);
        return initializeDatabase();
    } finally {
        // Ensure spinner is hidden even if an error occurs
        setTimeout(() => dbSpinner.hide(), 500);
    }
}

async function updateDatabase() {
    try {
        // Show spinner
        dbSpinner.show();
        
        let maxRetries = 3; // Add retry mechanism
        let retryCount = 0;
        let success = false;

        while (!success && retryCount < maxRetries) {
            try {
                // Get current file to get its SHA
                const currentFileResponse = await fetch(`https://api.github.com/repos/${config.github.owner}/${config.github.repo}/contents/${config.github.path}`, {
                    headers: {
                        'Authorization': `token ${config.github.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (!currentFileResponse.ok) {
                    throw new Error(`Failed to fetch current file: ${currentFileResponse.status} ${currentFileResponse.statusText}`);
                }
                
                const currentFile = await currentFileResponse.json();
                
                // Prepare content
                const content = JSON.stringify(database, null, 2);
                const encodedContent = btoa(content);
                
                // Minimal delay before update to reduce conflict window
                await randomDelay(500, 1000);
                
                const response = await fetch(`https://api.github.com/repos/${config.github.owner}/${config.github.repo}/contents/${config.github.path}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${config.github.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Update database [Attempt ${retryCount + 1}]`,
                        content: encodedContent,
                        sha: currentFile.sha
                    })
                });

                if (!response.ok) {
                    if (response.status === 409) {
                        console.warn(`Conflict detected (409), retry attempt ${retryCount + 1} of ${maxRetries}`);
                        retryCount++;
                        // Add exponential backoff
                        await randomDelay(1000 * Math.pow(2, retryCount), 1000 * Math.pow(2, retryCount + 1));
                        continue;
                    }
                    throw new Error(`Failed to update database: ${response.status} ${response.statusText}`);
                }
                
                console.log('Database updated successfully');
                success = true;
                
                // Show success message briefly before hiding
                await randomDelay(800, 800);
                return true;
            } catch (error) {
                if (error.message.includes('409') && retryCount < maxRetries - 1) {
                    retryCount++;
                    console.warn(`Conflict error, retrying (${retryCount}/${maxRetries})...`);
                    await randomDelay(1000 * Math.pow(2, retryCount), 1000 * Math.pow(2, retryCount + 1));
                } else {
                    throw error; // Re-throw if it's not a conflict or we've exceeded retries
                }
            }
        }
        
        if (!success) {
            throw new Error(`Failed to update database after ${maxRetries} attempts due to conflicts`);
        }
        
        return true;
    } catch (error) {
        console.error('Error updating database:', error);
        showAlert('Failed to update database. Please try again.');
        return false;
    } finally {
        // Ensure spinner is hidden even if an error occurs
        setTimeout(() => dbSpinner.hide(), 500);
    }
}

function initializeDatabase() {
    return {
        users: {},
        withdrawals: [],
        totalBerk: 0,
        totalWithdrawals: 0,
        completedWithdrawals: 0,
        incompleteWithdrawals: 0
    };
}

// Authentication Functions
async function login(username, password) {
    await fetchDatabase();
    const user = database.users[username];
    
    if (!user || user.password !== password) {
        showAlert('Invalid username or password');
        return false;
    }

    currentUser = username;
    setCookie('username', username, 7);
    setCookie('password', password, 7);
    showMainApp();
    return true;
}

// Function to fetch user's IP address
async function fetchIPAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error fetching IP address:', error);
        return 'Unknown';
    }
}

// Update the original register function to use database config
async function register(username, password, referralCode) {
  await fetchDatabase();
  await ensureConfigInDatabase();
  const dbConfig = getConfig();
  
  if (database.users[username]) {
    showAlert("Username already exists");
    return false;
  }
  
  if (!isValidPassword(password)) {
    showAlert("Password must be at least 8 characters long and include both numbers and letters");
    return false;
  }
  
  let ip = await fetchIPAddress();
  
  const userData = {
    password: password,
    balance: 0,
    referralCode: generateReferralCode(),
    referralCount: 0,
    referralHistory: [],
    completedTasks: [],
    withdrawalHistory: [],
    ipAddress: ip,
    registrationDate: (new Date()).toISOString()
  };
  
  if (referralCode) {
    const referrer = Object.entries(database.users).find(([_, user]) => user.referralCode === referralCode);
    if (referrer) {
      const [referrerUsername, referrerData] = referrer;
      referrerData.balance += dbConfig.rewards.referrerReward;
      referrerData.referralCount += 1;
      referrerData.referralHistory.push(username);
      userData.balance += dbConfig.rewards.newUserReward;
    }
  }
  
  database.users[username] = userData;
  await updateDatabase();
  
  currentUser = username;
  setCookie("username", username, 7);
  setCookie("password", password, 7);
  showMainApp();
  return true;
}

function isValidPassword(password) {
    const hasNumber = /\d/;
    const hasLetter = /[a-zA-Z]/;
    return password.length >= 8 && hasNumber.test(password) && hasLetter.test(password);
}

function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// UI Functions
function showMainApp() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-sections').classList.remove('hidden');
    updateUI();
}

function updateUI() {
    const user = database.users[currentUser];
    
    // Update user info
    document.getElementById('username-display').textContent = currentUser;
    document.getElementById('balance-display').textContent = user.balance.toFixed(2);
    
    // Update referral info
    document.getElementById('referral-code').textContent = user.referralCode;
    document.getElementById('referral-count').textContent = user.referralCount;
    
    // Update tasks
    updateTasksUI();
    
    // Update withdrawal history
    updateWithdrawalHistory();
    
    // Update admin section if applicable
    if (config.admins.includes(currentUser)) {
        document.getElementById('admin-section').classList.remove('hidden');
        updateAdminUI();
    }
    
    // Update leaderboard
    updateLeaderboard();
}

// Update the original updateTasksUI function to use database config
function updateTasksUI() {
  const tasksContainer = document.getElementById("tasks-container");
  const user = database.users[currentUser];
  const dbConfig = getConfig();
  
  tasksContainer.innerHTML = "";
  
  dbConfig.tasks.forEach(task => {
    const completed = user.completedTasks.includes(task.id);
    const taskCard = document.createElement("div");
    taskCard.className = "task-card";
    taskCard.innerHTML = `
      <div class="task-info">
        <div class="task-title-description">
          <div class="task-title">${task.title}</div>
          <div class="task-description">${task.description}</div>
        </div>
      </div>
      <div class="task-controls">
        <div class="task-reward">
          <i class="fas fa-star"></i>
          ${task.reward}
        </div>
        <div class="task-status">
          
        </div>
        ${completed ? 
          '<button class="task-button completed" disabled>Completed</button>' : 
          `<button class="task-button" onclick="completeTask('${task.id}')">Start</button>`}
      </div>
    `;
    tasksContainer.appendChild(taskCard);
  });
}


// Override the original completeTask function to use database config
async function completeTask(taskId) {
  const dbConfig = getConfig();
  const user = database.users[currentUser];
  const task = dbConfig.tasks.find(t => t.id === taskId);
  
  if (user.completedTasks.includes(taskId)) return;
  
  window.location.href = task.url;
  setTimeout(async () => {
    user.completedTasks.push(taskId);
    user.balance += task.reward;
    database.totalBerk += task.reward;
    await updateDatabase();
    updateUI();
    showAlert(`Congratulations! You earned ${task.reward} Points. It may take a minute before it reflects in your balance`);
  }, 5000);
}


// Override the original submitWithdrawal function to use database config
async function submitWithdrawal(userId, amount, password) {
  const dbConfig = getConfig();
  
  if (!dbConfig.rewards.withdrawalsEnabled) {
    return showAlert("Withdrawals are currently closed");
  }
  
  const user = database.users[currentUser];
  
  if (password !== user.password) {
    return showAlert("Invalid password");
  }
  
  if (amount < dbConfig.rewards.minimumWithdrawal || amount > dbConfig.rewards.maximumWithdrawal) {
    return showAlert(`Withdrawal amount must be between ${dbConfig.rewards.minimumWithdrawal} and ${dbConfig.rewards.maximumWithdrawal} Points`);
  }
  
  if (amount > user.balance) {
    return showAlert("Insufficient balance");
  }
  
  if (getWithdrawalLimits().count >= 1) {
    return showAlert("Daily withdrawal limit reached (1 withdrawal per day)");
  }
  
  const withdrawal = {
    id: Date.now(),
    username: currentUser,
    userId: userId,
    amount: amount,
    status: "confirmed",
    timestamp: (new Date()).toISOString()
  };
  
  database.withdrawals.push(withdrawal);
  user.withdrawalHistory.push(withdrawal);
  user.balance -= amount;
  database.totalBerk -= amount;
  database.totalWithdrawals += 1;
  database.incompleteWithdrawals += 1;
  
  updateWithdrawalCount();
  await updateDatabase();
  updateUI();
  showAlert("Withdrawal request submitted successfully");
}


// Helper function to get withdrawal limits from cookies
function getWithdrawalLimits() {
    const now = new Date();
    const todayStr = now.toDateString();
    
    // Get existing data from cookie or create new
    let withdrawalData = getCookie('withdrawalLimits');
    
    if (withdrawalData) {
        try {
            withdrawalData = JSON.parse(withdrawalData);
            
            // Check if it's a new day, reset if needed
            if (withdrawalData.date !== todayStr) {
                withdrawalData = {
                    date: todayStr,
                    count: 0,
                    lastReset: now.getTime()
                };
            }
        } catch (e) {
            // Invalid cookie, create new data
            withdrawalData = {
                date: todayStr,
                count: 0,
                lastReset: now.getTime()
            };
        }
    } else {
        // No cookie found, create new data
        withdrawalData = {
            date: todayStr,
            count: 0,
            lastReset: now.getTime()
        };
    }
    
    // Check if 24 hours have passed since last reset
    const hoursSinceReset = (now.getTime() - withdrawalData.lastReset) / (1000 * 60 * 60);
    if (hoursSinceReset >= 24) {
        withdrawalData = {
            date: todayStr,
            count: 0,
            lastReset: now.getTime()
        };
    }
    
    return withdrawalData;
}

// Helper function to update withdrawal count
function updateWithdrawalCount() {
    const withdrawalData = getWithdrawalLimits();
    withdrawalData.count += 1;
    
    // Store updated count in cookie (7-day expiry)
    setCookie('withdrawalLimits', JSON.stringify(withdrawalData), 7);
}

// Helper function to get cookie
function getCookie(name) {
    const cookieArr = document.cookie.split(';');
    
    for (let i = 0; i < cookieArr.length; i++) {
        const cookiePair = cookieArr[i].split('=');
        
        if (name === cookiePair[0].trim()) {
            return decodeURIComponent(cookiePair[1]);
        }
    }
    
    return null;
}

// Helper function to set cookie
function setCookie(name, value, daysToLive) {
    const date = new Date();
    date.setTime(date.getTime() + (daysToLive * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
}

// Check if config exists in database and create it if not
async function ensureConfigInDatabase() {
  if (!database.config) {
    console.log("Creating config in database");
    database.config = {
      rewards: {
        referrerReward: config.rewards.referrerReward,
        newUserReward: config.rewards.newUserReward,
        minimumWithdrawal: config.rewards.minimumWithdrawal,
        maximumWithdrawal: config.rewards.maximumWithdrawal,
        withdrawalsEnabled: config.rewards.withdrawalsEnabled
      },
      tasks: config.tasks,
      admins: config.admins
    };
    await updateDatabase();
  }
  return database.config;
}

// Get config from database (this will replace direct access to config object)
function getConfig() {
  return database.config || config;
}

// Update admin UI to include config management
function updateAdminUI() {
  document.getElementById("total-users").textContent = Object.keys(database.users).length;
  document.getElementById("active-users").textContent = Object.keys(database.users).length;
  document.getElementById("total-berk").textContent = database.totalBerk.toFixed(2);
  updateWithdrawalRequests();
  updateTopUsers();
  populateUsersList();
  updateConfigUI();
}

// Add config UI section
function updateConfigUI() {
  const adminSection = document.getElementById("admin-section");
  
  // Check if config section already exists
  let configSection = document.getElementById("config-management");
  if (!configSection) {
    // Create config management section if it doesn't exist
    configSection = document.createElement("div");
    configSection.id = "config-management";
    configSection.className = "admin-panel-section";
    configSection.innerHTML = `
      <h3>Config Management</h3>
      <div class="config-forms">
        <div class="config-form">
          <h4>Reward Settings</h4>
          <div class="form-group">
            <label>Referrer Reward:</label>
            <input type="number" id="referrer-reward" value="${getConfig().rewards.referrerReward}">
          </div>
          <div class="form-group">
            <label>New User Reward:</label>
            <input type="number" id="new-user-reward" value="${getConfig().rewards.newUserReward}">
          </div>
          <div class="form-group">
            <label>Minimum Withdrawal:</label>
            <input type="number" id="min-withdrawal" value="${getConfig().rewards.minimumWithdrawal}">
          </div>
          <div class="form-group">
            <label>Maximum Withdrawal:</label>
            <input type="number" id="max-withdrawal" value="${getConfig().rewards.maximumWithdrawal}">
          </div>
          <div class="form-group">
            <label>Withdrawals Enabled:</label>
            <input type="checkbox" id="withdrawals-enabled" ${getConfig().rewards.withdrawalsEnabled ? 'checked' : ''}>
          </div>
          <button onclick="saveRewardSettings()">Save Reward Settings</button>
        </div>
        
        <div class="config-form">
          <h4>Task Management</h4>
          <div id="tasks-list">
            ${renderTasksList()}
          </div>
          <button onclick="showAddTaskForm()">Add New Task</button>
        </div>
      </div>
      
      <div id="add-task-form" class="hidden">
        <h4>Add/Edit Task</h4>
        <input type="hidden" id="edit-task-id">
        <div class="form-group">
          <label>Task ID:</label>
          <input type="text" id="task-id" placeholder="Unique task identifier">
        </div>
        <div class="form-group">
          <label>Title:</label>
          <input type="text" id="task-title" placeholder="Task title">
        </div>
        <div class="form-group">
          <label>Description:</label>
          <input type="text" id="task-description" placeholder="Task description">
        </div>
        <div class="form-group">
          <label>Reward:</label>
          <input type="number" id="task-reward" placeholder="Points reward">
        </div>
        <div class="form-group">
          <label>URL:</label>
          <input type="text" id="task-url" placeholder="Task URL">
        </div>
        <div class="form-group">
          <label>Type:</label>
          <input type="text" id="task-type" placeholder="Task type (e.g., link)">
        </div>
        <button onclick="saveTask()">Save Task</button>
        <button onclick="cancelTaskEdit()">Cancel</button>
      </div>
    `;
    
    adminSection.appendChild(configSection);
  } else {
    // Update existing values
    document.getElementById("referrer-reward").value = getConfig().rewards.referrerReward;
    document.getElementById("new-user-reward").value = getConfig().rewards.newUserReward;
    document.getElementById("min-withdrawal").value = getConfig().rewards.minimumWithdrawal;
    document.getElementById("max-withdrawal").value = getConfig().rewards.maximumWithdrawal;
    document.getElementById("withdrawals-enabled").checked = getConfig().rewards.withdrawalsEnabled;
    
    document.getElementById("tasks-list").innerHTML = renderTasksList();
  }
}

// Render the tasks list for admin UI
function renderTasksList() {
  return getConfig().tasks.map((task, index) => `
    <div class="task-item">
      <div class="task-item-info">
        <strong>${task.title}</strong> (${task.id})
        <span>${task.reward} Points</span>
      </div>
      <div class="task-item-actions">
        <button onclick="editTask(${index})">Edit</button>
        <button onclick="deleteTask(${index})">Delete</button>
      </div>
    </div>
  `).join('');
}

// Save reward settings to database
async function saveRewardSettings() {
  const dbConfig = await ensureConfigInDatabase();
  
  dbConfig.rewards = {
    referrerReward: parseFloat(document.getElementById("referrer-reward").value),
    newUserReward: parseFloat(document.getElementById("new-user-reward").value),
    minimumWithdrawal: parseFloat(document.getElementById("min-withdrawal").value),
    maximumWithdrawal: parseFloat(document.getElementById("max-withdrawal").value),
    withdrawalsEnabled: document.getElementById("withdrawals-enabled").checked
  };
  
  await updateDatabase();
  showAlert("Reward settings saved successfully");
}

// Show the add task form
function showAddTaskForm() {
  document.getElementById("add-task-form").classList.remove("hidden");
  document.getElementById("edit-task-id").value = "";
  document.getElementById("task-id").value = "";
  document.getElementById("task-id").disabled = false;
  document.getElementById("task-title").value = "";
  document.getElementById("task-description").value = "";
  document.getElementById("task-reward").value = "";
  document.getElementById("task-url").value = "";
  document.getElementById("task-type").value = "link";
}

// Edit an existing task
function editTask(index) {
  const task = getConfig().tasks[index];
  document.getElementById("add-task-form").classList.remove("hidden");
  document.getElementById("edit-task-id").value = index;
  document.getElementById("task-id").value = task.id;
  document.getElementById("task-id").disabled = true;
  document.getElementById("task-title").value = task.title;
  document.getElementById("task-description").value = task.description;
  document.getElementById("task-reward").value = task.reward;
  document.getElementById("task-url").value = task.url;
  document.getElementById("task-type").value = task.type;
}

// Delete a task
async function deleteTask(index) {
  if (confirm("Are you sure you want to delete this task?")) {
    const dbConfig = await ensureConfigInDatabase();
    dbConfig.tasks.splice(index, 1);
    await updateDatabase();
    updateConfigUI();
    showAlert("Task deleted successfully");
  }
}

// Save a new or edited task
async function saveTask() {
  const dbConfig = await ensureConfigInDatabase();
  const editIndex = document.getElementById("edit-task-id").value;
  
  const task = {
    id: document.getElementById("task-id").value,
    title: document.getElementById("task-title").value,
    description: document.getElementById("task-description").value,
    reward: parseFloat(document.getElementById("task-reward").value),
    url: document.getElementById("task-url").value,
    type: document.getElementById("task-type").value || "link"
  };
  
  // Validate task data
  if (!task.id || !task.title || !task.description || isNaN(task.reward) || !task.url) {
    return showAlert("Please fill in all fields correctly");
  }
  
  if (editIndex === "") {
    // Add new task
    // Check if task ID already exists
    if (dbConfig.tasks.some(t => t.id === task.id)) {
      return showAlert("Task ID already exists. Please use a unique ID.");
    }
    dbConfig.tasks.push(task);
  } else {
    // Update existing task
    dbConfig.tasks[editIndex] = task;
  }
  
  await updateDatabase();
  document.getElementById("add-task-form").classList.add("hidden");
  updateConfigUI();
  showAlert("Task saved successfully");
}

// Cancel task editing
function cancelTaskEdit() {
  document.getElementById("add-task-form").classList.add("hidden");
}

// Initialize the config in the database when the app loads
document.addEventListener("DOMContentLoaded", async () => {
  const username = getCookie("username");
  const password = getCookie("password");
  
  if (username && password) {
    await login(username, password);
  }
  
  // Initialize database config
  await fetchDatabase();
  await ensureConfigInDatabase();
  
  setupUserManagementListeners();
  
  // Add window references for the new admin functions
  window.banUser = banUser;
  window.saveRewardSettings = saveRewardSettings;
  window.showAddTaskForm = showAddTaskForm;
  window.editTask = editTask;
  window.deleteTask = deleteTask;
  window.saveTask = saveTask;
  window.cancelTaskEdit = cancelTaskEdit;
  
  // Original event listeners
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    await login(username, password);
  });
  
  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;
    const referralCode = document.getElementById("register-referral").value;
    await register(username, password, referralCode);
  });
  
  document.getElementById("withdrawal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("bon-userid").value;
    const amount = parseFloat(document.getElementById("withdrawal-amount").value);
    const password = document.getElementById("withdrawal-password").value;
    await submitWithdrawal(userId, amount, password);
  });
  
  document.getElementById("withdrawal-date-filter").addEventListener("change", () => {
    if (getConfig().admins.includes(currentUser)) {
      updateWithdrawalRequests();
    }
  });
});


function updateWithdrawalRequests() {
    const container = document.getElementById('withdrawal-requests-list');
    const dateFilter = document.getElementById('withdrawal-date-filter').value;
    
    let filteredWithdrawals = database.withdrawals.filter(w => w.status === 'confirmed');
    if (dateFilter) {
        filteredWithdrawals = filteredWithdrawals.filter(w => 
            w.timestamp.startsWith(dateFilter)
        );
    }
    
    container.innerHTML = filteredWithdrawals.map(w => `
        <div class="withdrawal-request">
            <p>User: ${w.username}</p>
            <p>Account Number: ${w.userId}</p>
            <p>Amount: ${w.amount} Points</p>
            <button onclick="completeWithdrawal(${w.id})">Mark as Completed</button>
        </div>
    `).join('');
}

async function completeWithdrawal(withdrawalId) {
    const withdrawal = database.withdrawals.find(w => w.id === withdrawalId);
    if (withdrawal) {
        withdrawal.status = 'completed';
        database.completedWithdrawals += 1;
        database.incompleteWithdrawals -= 1;
        
        const user = database.users[withdrawal.username];
        const userWithdrawal = user.withdrawalHistory.find(w => w.id === withdrawalId);
        if (userWithdrawal) {
            userWithdrawal.status = 'completed';
        }
        
        await updateDatabase();
        updateAdminUI();
        showAlert('Withdrawal marked as completed');
    }
}

function updateTopUsers() {
    // Sort users by BERK balance
    const topBerkUsers = Object.entries(database.users)
        .sort(([, a], [, b]) => b.balance - a.balance)
        .slice(0, 3);
    
    // Sort users by referral count
    const topReferralUsers = Object.entries(database.users)
        .sort(([, a], [, b]) => b.referralCount - a.referralCount)
        .slice(0, 3);
    
    document.getElementById('top-berk-users').innerHTML = topBerkUsers.map(([username, user], index) => `
        <p>${index + 1}. ${username}: ${user.balance.toFixed(2)} Points</p>
    `).join('');
    
    document.getElementById('top-referral-users').innerHTML = topReferralUsers.map(([username, user], index) => `
        <p>${index + 1}. ${username}: ${user.referralCount} referrals</p>
    `).join('');
}

function updateLeaderboard() {
    const berkLeaderboard = Object.entries(database.users)
        .sort(([, a], [, b]) => b.balance - a.balance)
        .slice(0, 100);
    
    const referralLeaderboard = Object.entries(database.users)
        .sort(([, a], [, b]) => b.referralCount - a.referralCount)
        .slice(0, 100);
    
    document.getElementById('berk-leaderboard').innerHTML = berkLeaderboard.map(([username, user], index) => `
        <div class="leaderboard-entry">
            <span>${index + 1}.</span>
            <span>${username}</span>
            <span>${user.balance.toFixed(2)} Points</span>
        </div>
    `).join('');
    
    document.getElementById('referral-leaderboard').innerHTML = referralLeaderboard.map(([username, user], index) => `
        <div class="leaderboard-entry">
            <span>${index + 1}.</span>
            <span>${username}</span>
            <span>${user.referralCount} referrals</span>
        </div>
    `).join('');
}

function updateWithdrawalHistory() {
    const user = database.users[currentUser];
    const container = document.getElementById('withdrawal-history');
    
    container.innerHTML = user.withdrawalHistory.map(w => `
        <div class="withdrawal-entry">
            <p>Amount: ${w.amount} Points</p>
            <p>Status: <span class="status-${w.status}">${w.status}</span></p>
            <p>Date: ${new Date(w.timestamp).toLocaleDateString()}</p>
        </div>
    `).join('');
}

// User Management Functions
// Updated populateUsersList function to display IP address
function populateUsersList(searchTerm = '') {
    if (!config.admins.includes(currentUser)) return;
    
    const usersContainer = document.getElementById('users');
    usersContainer.innerHTML = '';
    
    // Filter users based on search term (username OR IP address)
    const filteredUsers = Object.entries(database.users)
        .filter(([username, userData]) => {
            const ipAddress = userData.ipAddress || '';
            return searchTerm === '' || 
                   username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   ipAddress.toLowerCase().includes(searchTerm.toLowerCase());
        });
    
    if (filteredUsers.length === 0) {
        usersContainer.innerHTML = '<p>No users found</p>';
        return;
    }
    
    // Create user elements
    filteredUsers.forEach(([username, userData]) => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        userElement.innerHTML = `
            <div class="user-header">
                <input type="radio" name="selectedUser" value="${username}" id="user-${username}">
                <label for="user-${username}">${username}</label>
            </div>
            <div class="user-details">
                <p>Balance: ${userData.balance.toFixed(2)} Points</p>
                <p>Referral Code: ${userData.referralCode}</p>
                <p>Referrals: ${userData.referralCount}</p>
                <p>Completed Tasks: ${userData.completedTasks.length}</p>
                <p>Withdrawal History: ${userData.withdrawalHistory.length} transactions</p>
                <p>IP Address: ${userData.ipAddress || 'Unknown'}</p>
                <p>Registration Date: ${userData.registrationDate ? new Date(userData.registrationDate).toLocaleString() : 'Unknown'}</p>
            </div>
        `;
        usersContainer.appendChild(userElement);
    });
}

async function banUser() {
    if (!config.admins.includes(currentUser)) {
        showAlert('You do not have permission to perform this action');
        return;
    }
    
    const selectedUser = document.querySelector('input[name="selectedUser"]:checked');
    
    if (!selectedUser) {
        showAlert('Please select a user to ban');
        return;
    }
    
    const username = selectedUser.value;
    
    // Prevent admins from banning themselves or other admins
    if (username === currentUser || config.admins.includes(username)) {
        showAlert('You cannot ban yourself or other administrators');
        return;
    }
    
    if (confirm(`Are you sure you want to ban ${username}? This action cannot be undone.`)) {
        // Delete the user from the database
        delete database.users[username];
        
        // Remove user's withdrawals from the global withdrawals list
        database.withdrawals = database.withdrawals.filter(w => w.username !== username);
        
        // Update database
        await updateDatabase();
        
        // Refresh the UI
        populateUsersList();
        updateAdminUI();
        
        showAlert(`User ${username} has been banned and removed from the system`);
    }
}

// Add event listeners for user management
function setupUserManagementListeners() {
    const searchInput = document.getElementById('searchUsers');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            populateUsersList(e.target.value);
        });
    }
}


// Navigation Functions
function switchSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`${section}-section`).classList.remove('hidden');
    document.querySelector(`[onclick="switchSection('${section}')"]`).classList.add('active');
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-form').forEach(form => form.classList.add('hidden'));
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById(`${tab}-form`).classList.remove('hidden');
    document.querySelector(`[onclick="switchAuthTab('${tab}')"]`).classList.add('active');
}

function switchLeaderboardTab(tab) {
    document.getElementById('berk-leaderboard').classList.toggle('hidden', tab !== 'berk');
    document.getElementById('referral-leaderboard').classList.toggle('hidden', tab !== 'referrals');
    document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[onclick="switchLeaderboardTab('${tab}')"]`).classList.add('active');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Check for saved login
    const savedUsername = getCookie('username');
    const savedPassword = getCookie('password');
    if (savedUsername && savedPassword) {
        await login(savedUsername, savedPassword);
    }
    
    // Setup user management listeners
    setupUserManagementListeners();
    
    // Add global reference to banUser function
    window.banUser = banUser;
    
    // Login form submission
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        await login(username, password);
    });
    
    // Register form submission
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const referralCode = document.getElementById('register-referral').value;
        await register(username, password, referralCode);
    });
    
    // Withdrawal form submission
    document.getElementById('withdrawal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('bon-userid').value;
        const amount = parseFloat(document.getElementById('withdrawal-amount').value);
        const password = document.getElementById('withdrawal-password').value;
        await submitWithdrawal(userId, amount, password);
    });
    
    // Date filter for withdrawal requests
    document.getElementById('withdrawal-date-filter').addEventListener('change', () => {
        if (config.admins.includes(currentUser)) {
            updateWithdrawalRequests();
        }
    });
});

// Copy referral code to clipboard
function copyReferralCode() {
    const referralCode = document.getElementById('referral-code').textContent;
    navigator.clipboard.writeText(referralCode)
        .then(() => showAlert('Referral code copied to clipboard!'))
        .catch(() => showAlert('Failed to copy referral code'));
}

// Error handling for database operations
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', error);
    showAlert('Please refresh the webpage...');
    return false;
};

// Periodic UI updates (every 120 seconds)
setInterval(() => {
    if (currentUser) {
        fetchDatabase().then(() => updateUI());
    }
}, 120000);
