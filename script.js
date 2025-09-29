// Storage Management System
class StorageManager {
    constructor() {
        this.storageKey = 'missionMonitorData';
        this.init();
    }

    init() {
        if (!localStorage.getItem(this.storageKey)) {
            this.initializeStorage();
        }
    }

    initializeStorage() {
        const initialData = {
            users: {},
            currentUser: null,
            tasks: [],
            badges: [],
            settings: {
                theme: 'light',
                notifications: true
            }
        };
        localStorage.setItem(this.storageKey, JSON.stringify(initialData));
    }

    getData() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || {};
        } catch (error) {
            console.error('Error parsing storage data:', error);
            this.initializeStorage();
            return this.getData();
        }
    }

    saveData(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            return false;
        }
    }

    // User Management
    addUser(userData) {
        const data = this.getData();
        if (data.users[userData.username]) {
            return false; // User already exists
        }
        data.users[userData.username] = {
            ...userData,
            createdAt: new Date().toISOString()
        };
        return this.saveData(data);
    }

    getUser(username) {
        const data = this.getData();
        return data.users[username] || null;
    }

    getUsers() {
        const data = this.getData();
        return data.users || {};
    }

    setCurrentUser(username) {
        const data = this.getData();
        data.currentUser = username;
        return this.saveData(data);
    }

    getCurrentUser() {
        const data = this.getData();
        return data.currentUser;
    }

    // Task Management
    addTask(task) {
        const data = this.getData();
        const newTask = {
            ...task,
            id: this.generateId(),
            userId: data.currentUser,
            createdAt: new Date().toISOString(),
            completed: false
        };
        data.tasks.push(newTask);
        this.saveData(data);
        return newTask;
    }

    getTasks() {
        const data = this.getData();
        const currentUser = data.currentUser;
        return data.tasks.filter(task => task.userId === currentUser) || [];
    }

    updateTask(taskId, updates) {
        const data = this.getData();
        const taskIndex = data.tasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            data.tasks[taskIndex] = { ...data.tasks[taskIndex], ...updates };
            this.saveData(data);
            return data.tasks[taskIndex];
        }
        return null;
    }

    deleteTask(taskId) {
        const data = this.getData();
        const taskIndex = data.tasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            data.tasks.splice(taskIndex, 1);
            return this.saveData(data);
        }
        return false;
    }

    completeTask(taskId) {
        const task = this.updateTask(taskId, {
            completed: true,
            completedAt: new Date().toISOString()
        });
        return task;
    }

    // Badge Management
    addBadge(badge) {
        const data = this.getData();
        const existingBadge = data.badges.find(b => 
            b.id === badge.id && b.userId === data.currentUser
        );
        
        if (existingBadge) {
            return null; // Badge already exists
        }

        const newBadge = {
            ...badge,
            userId: data.currentUser,
            earnedAt: new Date().toISOString()
        };
        data.badges.push(newBadge);
        this.saveData(data);
        return newBadge;
    }

    getBadges() {
        const data = this.getData();
        const currentUser = data.currentUser;
        return data.badges.filter(badge => badge.userId === currentUser) || [];
    }

    // Statistics
    getTaskStats() {
        const tasks = this.getTasks();
        const today = new Date().toISOString().split('T')[0];
        
        const todayTasks = tasks.filter(task => task.date === today);
        const completedTasks = tasks.filter(task => task.completed);
        const pendingTasks = tasks.filter(task => !task.completed);

        const priorityStats = {
            high: tasks.filter(task => task.priority === 'high').length,
            medium: tasks.filter(task => task.priority === 'medium').length,
            low: tasks.filter(task => task.priority === 'low').length
        };

        return {
            total: tasks.length,
            completed: completedTasks.length,
            pending: pendingTasks.length,
            completedTasks: completedTasks.length,
            today: {
                total: todayTasks.length,
                completed: todayTasks.filter(task => task.completed).length,
                pending: todayTasks.filter(task => !task.completed).length
            },
            byPriority: priorityStats
        };
    }

    // Settings
    setTheme(theme) {
        const data = this.getData();
        data.settings.theme = theme;
        return this.saveData(data);
    }

    getTheme() {
        const data = this.getData();
        return data.settings.theme || 'light';
    }

    // Utility
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    exportUserData() {
        const data = this.getData();
        const currentUser = data.currentUser;
        return {
            user: data.users[currentUser],
            tasks: this.getTasks(),
            badges: this.getBadges(),
            settings: data.settings
        };
    }

    importUserData(userData) {
        const data = this.getData();
        const currentUser = data.currentUser;
        
        if (userData.tasks) {
            // Remove existing tasks for current user
            data.tasks = data.tasks.filter(task => task.userId !== currentUser);
            // Add imported tasks
            userData.tasks.forEach(task => {
                data.tasks.push({ ...task, userId: currentUser });
            });
        }

        if (userData.badges) {
            // Remove existing badges for current user
            data.badges = data.badges.filter(badge => badge.userId !== currentUser);
            // Add imported badges
            userData.badges.forEach(badge => {
                data.badges.push({ ...badge, userId: currentUser });
            });
        }

        if (userData.settings) {
            data.settings = { ...data.settings, ...userData.settings };
        }

        return this.saveData(data);
    }

    cleanupOldData(daysToKeep = 90) {
        const data = this.getData();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        // Clean old completed tasks
        data.tasks = data.tasks.filter(task => {
            if (!task.completed) return true;
            const taskDate = new Date(task.completedAt || task.createdAt);
            return taskDate > cutoffDate;
        });

        return this.saveData(data);
    }
}

// Authentication System
class AuthManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.currentSession = null;
        this.init();
    }

    init() {
        // Check for existing session
        const currentUser = this.storage.getCurrentUser();
        if (currentUser) {
            this.currentSession = currentUser;
        }
    }

    hashPassword(password) {
        // Simple hash function for demo purposes
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    register(username, password, displayName) {
        if (!username || !password || !displayName) {
            throw new Error('All fields are required');
        }

        if (username.length < 3) {
            throw new Error('Username must be at least 3 characters');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        const existingUser = this.storage.getUser(username);
        if (existingUser) {
            throw new Error('Username already exists');
        }

        const userData = {
            username,
            displayName,
            passwordHash: this.hashPassword(password)
        };

        const success = this.storage.addUser(userData);
        if (success) {
            return this.login(username, password);
        } else {
            throw new Error('Failed to create account');
        }
    }

    login(username, password) {
        if (!username || !password) {
            throw new Error('Username and password are required');
        }

        const user = this.storage.getUser(username);
        if (!user) {
            throw new Error('Invalid username or password');
        }

        const passwordHash = this.hashPassword(password);
        if (user.passwordHash !== passwordHash) {
            throw new Error('Invalid username or password');
        }

        this.currentSession = username;
        this.storage.setCurrentUser(username);
        return true;
    }

    logout() {
        this.currentSession = null;
        this.storage.setCurrentUser(null);
        return true;
    }

    isLoggedIn() {
        return this.currentSession !== null;
    }

    getCurrentUserData() {
        if (!this.currentSession) return null;
        return this.storage.getUser(this.currentSession);
    }
}

// Task Management System
class TaskManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.currentFilter = { priority: 'all', status: 'all' };
        this.init();
    }

    init() {
        this.renderTasks();
        this.updateStats();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add task form
        const addTaskForm = document.getElementById('addTaskForm');
        if (addTaskForm) {
            addTaskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddTask();
            });
        }

        // Edit task form
        const editTaskForm = document.getElementById('editTaskForm');
        if (editTaskForm) {
            editTaskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditTask();
            });
        }

        // Set default date to today
        const taskDateInput = document.getElementById('taskDate');
        if (taskDateInput) {
            taskDateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    handleAddTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const date = document.getElementById('taskDate').value;
        const startTime = document.getElementById('taskStartTime').value;
        const endTime = document.getElementById('taskEndTime').value;

        if (!title || !date || !startTime || !endTime) {
            alert('Please fill in all required fields');
            return;
        }

        // Validate time
        if (startTime >= endTime) {
            alert('End time must be after start time');
            return;
        }

        const task = {
            title,
            description,
            priority,
            date,
            startTime,
            endTime
        };

        const newTask = this.storage.addTask(task);
        if (newTask) {
            this.renderTasks();
            this.updateStats();
            this.closeAddTaskModal();
            
            // Schedule notifications
            if (window.notificationManager) {
                window.notificationManager.scheduleTaskNotifications(newTask);
            }

            // Update charts
            if (window.chartManager) {
                window.chartManager.updateCharts();
            }

            // Check for badges
            if (window.badgeManager) {
                window.badgeManager.checkAllBadges();
            }
        }
    }

    handleEditTask() {
        const taskId = document.getElementById('editTaskId').value;
        const title = document.getElementById('editTaskTitle').value.trim();
        const description = document.getElementById('editTaskDescription').value.trim();
        const priority = document.getElementById('editTaskPriority').value;
        const date = document.getElementById('editTaskDate').value;
        const startTime = document.getElementById('editTaskStartTime').value;
        const endTime = document.getElementById('editTaskEndTime').value;

        if (!title || !date || !startTime || !endTime) {
            alert('Please fill in all required fields');
            return;
        }

        if (startTime >= endTime) {
            alert('End time must be after start time');
            return;
        }

        const updates = {
            title,
            description,
            priority,
            date,
            startTime,
            endTime
        };

        const updatedTask = this.storage.updateTask(taskId, updates);
        if (updatedTask) {
            this.renderTasks();
            this.updateStats();
            this.closeEditTaskModal();
            
            // Update notifications
            if (window.notificationManager) {
                window.notificationManager.cancelTaskNotifications(taskId);
                window.notificationManager.scheduleTaskNotifications(updatedTask);
            }

            // Update charts
            if (window.chartManager) {
                window.chartManager.updateCharts();
            }
        }
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;

        const tasks = this.getFilteredTasks();
        const rollingWindowTasks = this.getRollingWindowTasks(tasks);

        if (rollingWindowTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus"></i>
                    <h3>No tasks found</h3>
                    <p>Add your first task to get started!</p>
                </div>
            `;
            return;
        }

        // Group tasks by date
        const groupedTasks = this.groupTasksByDate(rollingWindowTasks);
        
        container.innerHTML = Object.keys(groupedTasks)
            .sort()
            .map(date => this.renderDateGroup(date, groupedTasks[date]))
            .join('');
    }

    getRollingWindowTasks(tasks) {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 7);

        return tasks.filter(task => {
            const taskDate = new Date(task.date);
            return taskDate >= startDate && taskDate <= endDate;
        });
    }

    groupTasksByDate(tasks) {
        return tasks.reduce((groups, task) => {
            const date = task.date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(task);
            return groups;
        }, {});
    }

    renderDateGroup(date, tasks) {
        const dateObj = new Date(date);
        const today = new Date().toISOString().split('T')[0];
        const isToday = date === today;
        const isPast = date < today;
        const isFuture = date > today;

        let dateLabel = dateObj.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        if (isToday) dateLabel += ' (Today)';
        else if (isPast) dateLabel += ' (Past)';
        else if (isFuture) dateLabel += ' (Upcoming)';

        const sortedTasks = tasks.sort((a, b) => a.startTime.localeCompare(b.startTime));

        return `
            <div class="date-group">
                <h3 class="date-header ${isToday ? 'today' : isPast ? 'past' : 'future'}">
                    <i class="fas fa-calendar-day"></i>
                    ${dateLabel}
                </h3>
                <div class="date-tasks">
                    ${sortedTasks.map(task => this.createTaskCard(task)).join('')}
                </div>
            </div>
        `;
    }

    createTaskCard(task) {
        const priorityIcon = {
            high: '🔴',
            medium: '🟡',
            low: '🟢'
        };

        const timeRange = `${this.formatTime(task.startTime)} - ${this.formatTime(task.endTime)}`;
        const isOverdue = this.isTaskOverdue(task);

        return `
            <div class="task-card ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" 
                 data-task-id="${task.id}">
                <div class="task-priority ${task.priority}"></div>
                <div class="task-header">
                    <div>
                        <h3 class="task-title">${task.title}</h3>
                        ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                    </div>
                    <span class="priority-badge">${priorityIcon[task.priority]}</span>
                </div>
                <div class="task-meta">
                    <div class="task-date">
                        <i class="fas fa-calendar"></i>
                        <span>${new Date(task.date).toLocaleDateString()}</span>
                    </div>
                    <div class="task-time">
                        <i class="fas fa-clock"></i>
                        <span>${timeRange}</span>
                    </div>
                </div>
                <div class="task-actions">
                    ${!task.completed ? `
                        <button class="task-btn complete-btn" onclick="completeTask('${task.id}')">
                            <i class="fas fa-check"></i> Complete
                        </button>
                    ` : `
                        <span class="completed-badge">
                            <i class="fas fa-check-circle"></i> Completed
                        </span>
                    `}
                    <button class="task-btn edit-btn" onclick="editTask('${task.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="task-btn delete-btn" onclick="deleteTask('${task.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }

    isTaskOverdue(task) {
        if (task.completed) return false;
        const now = new Date();
        const taskEnd = new Date(`${task.date}T${task.endTime}`);
        return taskEnd < now;
    }

    formatTime(time) {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getFilteredTasks() {
        let tasks = this.storage.getTasks();

        // Filter by priority
        if (this.currentFilter.priority !== 'all') {
            tasks = tasks.filter(task => task.priority === this.currentFilter.priority);
        }

        // Filter by status
        if (this.currentFilter.status !== 'all') {
            if (this.currentFilter.status === 'completed') {
                tasks = tasks.filter(task => task.completed);
            } else if (this.currentFilter.status === 'pending') {
                tasks = tasks.filter(task => !task.completed);
            }
        }

        return tasks;
    }

    updateStats() {
        const stats = this.storage.getTaskStats();
        
        document.getElementById('totalTasks').textContent = stats.total;
        document.getElementById('completedTasks').textContent = stats.completed;
        document.getElementById('pendingTasks').textContent = stats.pending;
        document.getElementById('totalBadges').textContent = this.storage.getBadges().length;
    }

    completeTask(taskId) {
        const task = this.storage.completeTask(taskId);
        if (task) {
            this.renderTasks();
            this.updateStats();
            
            // Show completion notification
            if (window.notificationManager) {
                window.notificationManager.showTaskCompletedNotification(task);
            }

            // Update charts
            if (window.chartManager) {
                window.chartManager.updateCharts();
            }

            // Check for badges
            if (window.badgeManager) {
                window.badgeManager.checkAllBadges();
                window.badgeManager.checkDailyCompletionBadge();
            }

            // Cancel notifications for completed task
            if (window.notificationManager) {
                window.notificationManager.cancelTaskNotifications(taskId);
            }
        }
    }

    editTask(taskId) {
        const tasks = this.storage.getTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Populate edit form
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskDescription').value = task.description || '';
        document.getElementById('editTaskPriority').value = task.priority;
        document.getElementById('editTaskDate').value = task.date;
        document.getElementById('editTaskStartTime').value = task.startTime;
        document.getElementById('editTaskEndTime').value = task.endTime;

        // Show modal
        document.getElementById('editTaskModal').style.display = 'block';
    }

    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            const success = this.storage.deleteTask(taskId);
            if (success) {
                this.renderTasks();
                this.updateStats();
                
                // Cancel notifications
                if (window.notificationManager) {
                    window.notificationManager.cancelTaskNotifications(taskId);
                }

                // Update charts
                if (window.chartManager) {
                    window.chartManager.updateCharts();
                }
            }
        }
    }

    setFilter(filterType, value) {
        this.currentFilter[filterType] = value;
        this.renderTasks();
    }

    closeAddTaskModal() {
        document.getElementById('addTaskModal').style.display = 'none';
        document.getElementById('addTaskForm').reset();
        // Reset date to today
        document.getElementById('taskDate').value = new Date().toISOString().split('T')[0];
    }

    closeEditTaskModal() {
        document.getElementById('editTaskModal').style.display = 'none';
        document.getElementById('editTaskForm').reset();
    }
}

// Motivational Quotes System
class QuotesManager {
    constructor() {
        this.quotes = [
            "The only way to do great work is to love what you do. - Steve Jobs",
            "Life is what happens to you while you're busy making other plans. - John Lennon",
            "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
            "It is during our darkest moments that we must focus to see the light. - Aristotle",
            "The only impossible journey is the one you never begin. - Tony Robbins",
            "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
            "The way to get started is to quit talking and begin doing. - Walt Disney",
            "Don't let yesterday take up too much of today. - Will Rogers",
            "You learn more from failure than from success. Don't let it stop you. Failure builds character. - Unknown",
            "It's not whether you get knocked down, it's whether you get up. - Vince Lombardi",
            "If you are working on something that you really care about, you don't have to be pushed. The vision pulls you. - Steve Jobs",
            "People who are crazy enough to think they can change the world, are the ones who do. - Rob Siltanen",
            "Failure will never overtake me if my determination to succeed is strong enough. - Og Mandino",
            "We don't have to be smarter than the rest. We have to be more disciplined than the rest. - Warren Buffett",
            "How wonderful it is that nobody need wait a single moment before starting to improve the world. - Anne Frank",
            "Whether you think you can or you think you can't, you're right. - Henry Ford",
            "The only person you are destined to become is the person you decide to be. - Ralph Waldo Emerson",
            "Go confidently in the direction of your dreams. Live the life you have imagined. - Henry David Thoreau",
            "Believe you can and you're halfway there. - Theodore Roosevelt",
            "The best time to plant a tree was 20 years ago. The second best time is now. - Chinese Proverb"
        ];
        this.init();
    }

    init() {
        this.displayQuote();
    }

    displayQuote() {
        const quoteElement = document.getElementById('quoteText');
        const authorElement = document.getElementById('quoteAuthor');
        
        if (!quoteElement || !authorElement) return;

        const randomQuote = this.getRandomQuote();
        const [text, author] = randomQuote.split(' - ');
        
        quoteElement.textContent = text;
        authorElement.textContent = `- ${author}`;
    }

    getRandomQuote() {
        return this.quotes[Math.floor(Math.random() * this.quotes.length)];
    }
}

// Notification Management System
class NotificationManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.scheduledNotifications = new Map();
        this.permissionGranted = false;
        this.init();
    }

    async init() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            this.permissionGranted = permission === 'granted';
            
            if (this.permissionGranted) {
                console.log('Notification permission granted');
                this.scheduleAllTaskNotifications();
            } else {
                console.log('Notification permission denied');
            }
        }

        if ('serviceWorker' in navigator) {
            this.registerServiceWorker();
        }
    }

    async registerServiceWorker() {
        try {
            const swCode = `
                self.addEventListener('notificationclick', function(event) {
                    event.notification.close();
                    event.waitUntil(
                        clients.openWindow('/')
                    );
                });
            `;
            
            const blob = new Blob([swCode], { type: 'application/javascript' });
            const swUrl = URL.createObjectURL(blob);
            
            await navigator.serviceWorker.register(swUrl);
            console.log('Service Worker registered for notifications');
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }

    showNotification(title, body, icon = '🚀', tag = null) {
        if (!this.permissionGranted) {
            this.showCustomNotification(title, body, icon);
            return;
        }

        const notification = new Notification(title, {
            body: body,
            icon: this.createIconDataUrl(icon),
            tag: tag,
            badge: this.createIconDataUrl('🏅'),
            vibrate: [100, 50, 100],
            requireInteraction: true
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        setTimeout(() => {
            notification.close();
        }, 10000);
    }

    createIconDataUrl(emoji) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 32, 32);
        
        return canvas.toDataURL();
    }

    showCustomNotification(title, body, icon) {
        const notification = document.createElement('div');
        notification.className = 'custom-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-text">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${body}</div>
                </div>
                <button class="notification-close" onclick="this.parentNode.parentNode.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 8000);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);
    }

    scheduleTaskNotifications(task) {
        if (!task || task.completed) return;

        const taskDateTime = new Date(`${task.date}T${task.startTime}`);
        const now = new Date();

        this.cancelTaskNotifications(task.id);

        // Schedule 1 hour before notification
        const oneHourBefore = new Date(taskDateTime.getTime() - 60 * 60 * 1000);
        if (oneHourBefore > now) {
            const timeout1h = setTimeout(() => {
                this.showNotification(
                    '⏰ Task Reminder - 1 Hour',
                    `"${task.title}" starts in 1 hour at ${this.formatTime(task.startTime)}`,
                    '⏰',
                    `task-1h-${task.id}`
                );
            }, oneHourBefore.getTime() - now.getTime());
            
            this.scheduledNotifications.set(`${task.id}-1h`, timeout1h);
        }

        // Schedule 5 minutes before notification
        const fiveMinutesBefore = new Date(taskDateTime.getTime() - 5 * 60 * 1000);
        if (fiveMinutesBefore > now) {
            const timeout5m = setTimeout(() => {
                this.showNotification(
                    '🚨 Task Alert - 5 Minutes!',
                    `"${task.title}" is starting soon! Get ready.`,
                    '🚨',
                    `task-5m-${task.id}`
                );
            }, fiveMinutesBefore.getTime() - now.getTime());
            
            this.scheduledNotifications.set(`${task.id}-5m`, timeout5m);
        }

        // Schedule start time notification
        if (taskDateTime > now) {
            const timeoutStart = setTimeout(() => {
                this.showNotification(
                    '▶️ Task Starting Now!',
                    `"${task.title}" is scheduled to start now.`,
                    '▶️',
                    `task-start-${task.id}`
                );
            }, taskDateTime.getTime() - now.getTime());
            
            this.scheduledNotifications.set(`${task.id}-start`, timeoutStart);
        }
    }

    cancelTaskNotifications(taskId) {
        const keys = [`${taskId}-1h`, `${taskId}-5m`, `${taskId}-start`];
        
        keys.forEach(key => {
            if (this.scheduledNotifications.has(key)) {
                clearTimeout(this.scheduledNotifications.get(key));
                this.scheduledNotifications.delete(key);
            }
        });
    }

    scheduleAllTaskNotifications() {
        const tasks = this.storage.getTasks();
        const incompleteTasks = tasks.filter(task => !task.completed);
        
        this.clearAllNotifications();
        
        incompleteTasks.forEach(task => {
            this.scheduleTaskNotifications(task);
        });
        
        console.log(`Scheduled notifications for ${incompleteTasks.length} tasks`);
    }

    clearAllNotifications() {
        this.scheduledNotifications.forEach(timeout => {
            clearTimeout(timeout);
        });
        this.scheduledNotifications.clear();
    }

    showDailyCompletionNotification() {
        this.showNotification(
            '🎉 Daily Goals Achieved!',
            'Congratulations! You completed all your tasks for today. You earned a new badge!',
            '🏆'
        );
    }

    showBadgeEarnedNotification(badge) {
        this.showNotification(
            '🏅 New Badge Earned!',
            `Achievement unlocked: ${badge.title}`,
            badge.icon
        );
    }

    showTaskCompletedNotification(task) {
        this.showNotification(
            '✅ Task Completed!',
            `Great job completing "${task.title}"!`,
            '✅'
        );
    }

    formatTime(time) {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getNotificationStats() {
        return {
            permissionGranted: this.permissionGranted,
            scheduledCount: this.scheduledNotifications.size,
            isSupported: 'Notification' in window
        };
    }
}

// Chart Management System
class ChartManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.charts = {};
        this.initCharts();
    }

    initCharts() {
        this.createProgressChart();
        this.createPriorityChart();
    }

    createProgressChart() {
        const ctx = document.getElementById('progressChart');
        if (!ctx) return;

        const stats = this.storage.getTaskStats();
        const todayStats = stats.today;

        this.charts.progress = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    data: [todayStats.completed, todayStats.total - todayStats.completed],
                    backgroundColor: [
                        'rgba(78, 205, 196, 0.8)',
                        'rgba(255, 234, 167, 0.8)'
                    ],
                    borderColor: [
                        'rgba(78, 205, 196, 1)',
                        'rgba(255, 234, 167, 1)'
                    ],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 14
                            },
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--text-color').trim()
                        }
                    },
                    title: {
                        display: true,
                        text: `Today's Progress (${todayStats.total} tasks)`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-color').trim(),
                        padding: 20
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    createPriorityChart() {
        const ctx = document.getElementById('priorityChart');
        if (!ctx) return;

        const stats = this.storage.getTaskStats();
        const priorityStats = stats.byPriority;

        this.charts.priority = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['High Priority', 'Medium Priority', 'Low Priority'],
                datasets: [{
                    label: 'Number of Tasks',
                    data: [priorityStats.high, priorityStats.medium, priorityStats.low],
                    backgroundColor: [
                        'rgba(253, 121, 168, 0.8)',
                        'rgba(255, 234, 167, 0.8)',
                        'rgba(78, 205, 196, 0.8)'
                    ],
                    borderColor: [
                        'rgba(253, 121, 168, 1)',
                        'rgba(255, 234, 167, 1)',
                        'rgba(78, 205, 196, 1)'
                    ],
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Tasks by Priority',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-color').trim(),
                        padding: 20
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--text-muted').trim()
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--border-color').trim()
                        }
                    },
                    x: {
                        ticks: {
                            color: getComputedStyle(document.documentElement)
                                .getPropertyValue('--text-muted').trim()
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    updateCharts() {
        const stats = this.storage.getTaskStats();
        
        if (this.charts.progress) {
            const todayStats = stats.today;
            this.charts.progress.data.datasets[0].data = [
                todayStats.completed, 
                todayStats.total - todayStats.completed
            ];
            this.charts.progress.options.plugins.title.text = 
                `Today's Progress (${todayStats.total} tasks)`;
            this.charts.progress.update('active');
        }

        if (this.charts.priority) {
            const priorityStats = stats.byPriority;
            this.charts.priority.data.datasets[0].data = [
                priorityStats.high,
                priorityStats.medium,
                priorityStats.low
            ];
            this.charts.priority.update('active');
        }
    }

    updateChartThemes() {
        const textColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-color').trim();
        const textMuted = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-muted').trim();
        const borderColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--border-color').trim();

        Object.values(this.charts).forEach(chart => {
            if (chart && chart.options) {
                if (chart.options.plugins?.legend?.labels) {
                    chart.options.plugins.legend.labels.color = textColor;
                }
                if (chart.options.plugins?.title) {
                    chart.options.plugins.title.color = textColor;
                }
                
                if (chart.options.scales?.y?.ticks) {
                    chart.options.scales.y.ticks.color = textMuted;
                    chart.options.scales.y.grid.color = borderColor;
                }
                if (chart.options.scales?.x?.ticks) {
                    chart.options.scales.x.ticks.color = textMuted;
                    if (chart.options.scales.x.grid) {
                        chart.options.scales.x.grid.color = borderColor;
                    }
                }
                
                chart.update('none');
            }
        });
    }

    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.resize();
            }
        });
    }
}

// Badge Management System
class BadgeManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.badgeDefinitions = this.initializeBadgeDefinitions();
        this.init();
    }

    initializeBadgeDefinitions() {
        return {
            firstTask: {
                id: 'firstTask',
                title: 'Getting Started',
                description: 'Complete your first task',
                icon: '🎯',
                category: 'milestone',
                condition: (userStats) => userStats.completedTasks >= 1
            },
            dailyCompletion: {
                id: 'dailyCompletion',
                title: 'Daily Champion',
                description: 'Complete all tasks in a single day',
                icon: '🏆',
                category: 'daily',
                condition: (userStats, tasks) => {
                    const today = new Date().toISOString().split('T')[0];
                    const todayTasks = tasks.filter(task => task.date === today);
                    return todayTasks.length > 0 && todayTasks.every(task => task.completed);
                }
            },
            streak3: {
                id: 'streak3',
                title: 'On Fire',
                description: 'Complete all tasks for 3 consecutive days',
                icon: '🔥',
                category: 'streak',
                condition: (userStats, tasks) => this.checkCompletionStreak(tasks, 3)
            },
            streak7: {
                id: 'streak7',
                title: 'Unstoppable',
                description: 'Complete all tasks for 7 consecutive days',
                icon: '⚡',
                category: 'streak',
                condition: (userStats, tasks) => this.checkCompletionStreak(tasks, 7)
            },
            earlyBird: {
                id: 'earlyBird',
                title: 'Early Bird',
                description: 'Complete a task before 7 AM',
                icon: '🐦',
                category: 'time',
                condition: (userStats, tasks) => {
                    return tasks.some(task => {
                        if (!task.completed || !task.completedAt) return false;
                        const completedTime = new Date(task.completedAt);
                        return completedTime.getHours() < 7;
                    });
                }
            },
            nightOwl: {
                id: 'nightOwl',
                title: 'Night Owl',
                description: 'Complete a task after 10 PM',
                icon: '🦉',
                category: 'time',
                condition: (userStats, tasks) => {
                    return tasks.some(task => {
                        if (!task.completed || !task.completedAt) return false;
                        const completedTime = new Date(task.completedAt);
                        return completedTime.getHours() >= 22;
                    });
                }
            },
            taskMaster: {
                id: 'taskMaster',
                title: 'Task Master',
                description: 'Complete 50 tasks total',
                icon: '🎓',
                category: 'milestone',
                condition: (userStats) => userStats.completedTasks >= 50
            },
            prioritizer: {
                id: 'prioritizer',
                title: 'Priority Master',
                description: 'Complete 10 high-priority tasks',
                icon: '🎭',
                category: 'priority',
                condition: (userStats, tasks) => {
                    const highPriorityCompleted = tasks.filter(task => 
                        task.completed && task.priority === 'high'
                    );
                    return highPriorityCompleted.length >= 10;
                }
            },
            organizer: {
                id: 'organizer',
                title: 'Super Organizer',
                description: 'Have 20 tasks scheduled in advance',
                icon: '📋',
                category: 'planning',
                condition: (userStats, tasks) => {
                    const futureTasks = tasks.filter(task => {
                        const taskDate = new Date(task.date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return taskDate > today;
                    });
                    return futureTasks.length >= 20;
                }
            },
            weekendWarrior: {
                id: 'weekendWarrior',
                title: 'Weekend Warrior',
                description: 'Complete tasks on both Saturday and Sunday',
                icon: '🏋️',
                category: 'weekend',
                condition: (userStats, tasks) => {
                    const weekendTasks = tasks.filter(task => {
                        const taskDate = new Date(task.date);
                        const day = taskDate.getDay();
                        return (day === 0 || day === 6) && task.completed;
                    });
                    
                    const saturdayCompleted = weekendTasks.some(task => 
                        new Date(task.date).getDay() === 6
                    );
                    const sundayCompleted = weekendTasks.some(task => 
                        new Date(task.date).getDay() === 0
                    );
                    
                    return saturdayCompleted && sundayCompleted;
                }
            }
        };
    }

    init() {
        this.checkAllBadges();
        this.renderBadges();
    }

    checkCompletionStreak(tasks, requiredDays) {
        const today = new Date();
        let streak = 0;
        
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateString = checkDate.toISOString().split('T')[0];
            
            const dayTasks = tasks.filter(task => task.date === dateString);
            
            if (dayTasks.length === 0) {
                continue;
            }
            
            const allCompleted = dayTasks.every(task => task.completed);
            
            if (allCompleted) {
                streak++;
            } else {
                break;
            }
            
            if (streak >= requiredDays) {
                return true;
            }
        }
        
        return false;
    }

    checkAllBadges() {
        const tasks = this.storage.getTasks();
        const userStats = this.storage.getTaskStats();
        const currentBadges = this.storage.getBadges();
        const currentBadgeIds = currentBadges.map(badge => badge.id);

        Object.values(this.badgeDefinitions).forEach(badgeDef => {
            if (currentBadgeIds.includes(badgeDef.id)) return;

            if (badgeDef.condition(userStats, tasks)) {
                this.awardBadge(badgeDef);
            }
        });
    }

    awardBadge(badgeDefinition) {
        const badge = {
            ...badgeDefinition,
            earnedAt: new Date().toISOString()
        };

        const addedBadge = this.storage.addBadge(badge);
        
        if (addedBadge) {
            if (window.notificationManager) {
                window.notificationManager.showBadgeEarnedNotification(badge);
            }

            this.showBadgeCelebration(badge);
            this.renderBadges();
            
            if (window.taskManager) {
                window.taskManager.updateStats();
            }

            console.log(`Badge earned: ${badge.title}`);
        }
    }

    showBadgeCelebration(badge) {
        const celebration = document.createElement('div');
        celebration.className = 'badge-celebration';
        celebration.innerHTML = `
            <div class="celebration-content">
                <div class="celebration-icon">${badge.icon}</div>
                <div class="celebration-title">New Badge Earned!</div>
                <div class="celebration-badge-title">${badge.title}</div>
                <div class="celebration-description">${badge.description}</div>
            </div>
        `;

        document.body.appendChild(celebration);

        setTimeout(() => {
            celebration.classList.add('show');
        }, 10);

        setTimeout(() => {
            if (celebration.parentNode) {
                celebration.remove();
            }
        }, 4000);
    }

    checkDailyCompletionBadge() {
        const tasks = this.storage.getTasks();
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = tasks.filter(task => task.date === today);
        
        if (todayTasks.length > 0 && todayTasks.every(task => task.completed)) {
            const currentBadges = this.storage.getBadges();
            const dailyBadge = this.badgeDefinitions.dailyCompletion;
            
            const todayBadge = currentBadges.find(badge => 
                badge.id === 'dailyCompletion' && 
                badge.earnedAt.split('T')[0] === today
            );

            if (!todayBadge) {
                this.awardBadge(dailyBadge);
                
                if (window.notificationManager) {
                    window.notificationManager.showDailyCompletionNotification();
                }
            }
        }
    }

    renderBadges() {
        const badgesContainer = document.getElementById('badgesContainer');
        if (!badgesContainer) return;

        const userBadges = this.storage.getBadges();
        
        if (userBadges.length === 0) {
            badgesContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <h3>No badges yet</h3>
                    <p>Complete tasks to earn your first badge!</p>
                </div>
            `;
            return;
        }

        userBadges.sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));

        badgesContainer.innerHTML = userBadges.map(badge => 
            this.createBadgeCard(badge)
        ).join('');
    }

    createBadgeCard(badge) {
        const earnedDate = new Date(badge.earnedAt);
        const isRecent = Date.now() - earnedDate.getTime() < 24 * 60 * 60 * 1000;

        return `
            <div class="badge-item ${isRecent ? 'recent' : ''}" data-badge-id="${badge.id}">
                <div class="badge-icon">${badge.icon}</div>
                <div class="badge-title">${badge.title}</div>
                <div class="badge-description">${badge.description}</div>
                <div class="badge-date">
                    Earned ${earnedDate.toLocaleDateString()}
                </div>
            </div>
        `;
    }
}

// Main Application Controller
class MissionMonitorApp {
    constructor() {
        this.initialized = false;
        this.currentTheme = 'light';
        this.init();
    }

    async init() {
        try {
            this.showLoadingScreen();

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeApp());
            } else {
                await this.initializeApp();
            }
        } catch (error) {
            console.error('Application initialization error:', error);
            this.hideLoadingScreen();
        }
    }

    async initializeApp() {
        try {
            this.initializeTheme();
            await this.checkAuthenticationStatus();
            await this.initializeManagers();
            this.setupEventListeners();
            this.hideLoadingScreen();
            this.initialized = true;
            console.log('Mission Monitor App initialized successfully');
        } catch (error) {
            console.error('Error during app initialization:', error);
            this.hideLoadingScreen();
        }
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 1000);
        }
    }

    async checkAuthenticationStatus() {
        if (window.auth && window.auth.isLoggedIn()) {
            this.showMainApp();
        } else {
            this.showAuthSection();
        }
    }

    showMainApp() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        this.initializeMainAppComponents();
    }

    showAuthSection() {
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('authSection').style.display = 'block';
    }

    initializeMainAppComponents() {
        this.updateUserGreeting();

        if (window.quotesManager) {
            window.quotesManager.init();
        }

        if (window.taskManager) {
            window.taskManager.init();
        }

        if (window.badgeManager) {
            window.badgeManager.init();
        }

        if (window.chartManager) {
            window.chartManager.initCharts();
        }

        if (window.notificationManager) {
            window.notificationManager.scheduleAllTaskNotifications();
        }
    }

    async initializeManagers() {
        let retries = 0;
        const maxRetries = 10;

        while (retries < maxRetries) {
            if (window.storage && window.auth && window.taskManager && 
                window.quotesManager && window.notificationManager) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        if (retries >= maxRetries) {
            throw new Error('Failed to initialize all managers');
        }
    }

    initializeTheme() {
        const savedTheme = window.storage ? window.storage.getTheme() : 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        const themeToggle = document.querySelector('.theme-toggle i');
        if (themeToggle) {
            themeToggle.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }

        if (window.storage) {
            window.storage.setTheme(theme);
        }

        document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));

        setTimeout(() => {
            if (window.chartManager) {
                window.chartManager.updateChartThemes();
            }
        }, 100);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    updateUserGreeting() {
        const currentUserElement = document.getElementById('currentUser');
        if (currentUserElement && window.auth) {
            const userData = window.auth.getCurrentUserData();
            if (userData) {
                currentUserElement.textContent = userData.displayName || userData.username;
            }
        }
    }

    setupEventListeners() {
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        window.addEventListener('focus', () => {
            if (window.notificationManager && this.initialized) {
                window.notificationManager.scheduleAllTaskNotifications();
            }
        });

        window.addEventListener('resize', () => {
            if (window.chartManager) {
                window.chartManager.resizeCharts();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.initialized) {
                this.refreshAppData();
            }
        });

        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    handleKeyboardShortcuts(e) {
        if (document.getElementById('mainApp').style.display === 'none') return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            if (typeof showAddTaskModal === 'function') {
                showAddTaskModal();
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            this.toggleTheme();
        }

        if (e.key === 'Escape') {
            this.closeAllModals();
        }
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        });
    }

    refreshAppData() {
        if (!this.initialized) return;

        try {
            if (window.taskManager) {
                window.taskManager.renderTasks();
                window.taskManager.updateStats();
            }

            if (window.chartManager) {
                window.chartManager.updateCharts();
            }

            if (window.badgeManager) {
                window.badgeManager.checkAllBadges();
                window.badgeManager.renderBadges();
            }

            if (window.quotesManager) {
                window.quotesManager.displayQuote();
            }
        } catch (error) {
            console.error('Error refreshing app data:', error);
        }
    }
}

// Global Variables
let storage, auth, taskManager, quotesManager, notificationManager, chartManager, badgeManager, missionMonitorApp;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    storage = new StorageManager();
    auth = new AuthManager(storage);
    taskManager = new TaskManager(storage);
    quotesManager = new QuotesManager();
    notificationManager = new NotificationManager(storage);
    chartManager = new ChartManager(storage);
    badgeManager = new BadgeManager(storage);

    // Make available globally
    window.storage = storage;
    window.auth = auth;
    window.taskManager = taskManager;
    window.quotesManager = quotesManager;
    window.notificationManager = notificationManager;
    window.chartManager = chartManager;
    window.badgeManager = badgeManager;

    // Initialize main app
    missionMonitorApp = new MissionMonitorApp();
    window.missionMonitorApp = missionMonitorApp;

    // Setup authentication forms
    setupAuthForms();
});

// Authentication Functions
function setupAuthForms() {
    const loginForm = document.getElementById('loginFormElement');
    const signupForm = document.getElementById('signupFormElement');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        auth.login(username, password);
        missionMonitorApp.showMainApp();
    } catch (error) {
        alert(error.message);
    }
}

function handleSignup(e) {
    e.preventDefault();
    
    const username = document.getElementById('signupUsername').value.trim();
    const displayName = document.getElementById('signupDisplayName').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        auth.register(username, password, displayName);
        missionMonitorApp.showMainApp();
    } catch (error) {
        alert(error.message);
    }
}

function showLoginForm() {
    document.getElementById('signupForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
}

function showSignupForm() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('signupForm').classList.add('active');
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.logout();
        location.reload();
    }
}

// Task Functions
function showAddTaskModal() {
    document.getElementById('addTaskModal').style.display = 'block';
    // Set default date to today
    document.getElementById('taskDate').value = new Date().toISOString().split('T')[0];
}

function closeAddTaskModal() {
    taskManager.closeAddTaskModal();
}

function closeEditTaskModal() {
    taskManager.closeEditTaskModal();
}

function completeTask(taskId) {
    taskManager.completeTask(taskId);
}

function editTask(taskId) {
    taskManager.editTask(taskId);
}

function deleteTask(taskId) {
    taskManager.deleteTask(taskId);
}

function filterTasks() {
    const priorityFilter = document.getElementById('priorityFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    taskManager.setFilter('priority', priorityFilter);
    taskManager.setFilter('status', statusFilter);
}

// Theme Functions
function toggleTheme() {
    if (missionMonitorApp) {
        missionMonitorApp.toggleTheme();
    }
}

// Modal Functions
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Click outside modal to close
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// Handle errors
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});

// Add CSS for date groups
const additionalStyles = `
.date-group {
    margin-bottom: 2rem;
}

.date-header {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    border-radius: var(--border-radius);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.date-header.today {
    background: var(--success-gradient);
    color: white;
}

.date-header.past {
    background: var(--bg-tertiary);
    color: var(--text-muted);
}

.date-header.future {
    background: var(--primary-gradient);
    color: white;
}

.date-tasks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--spacing-lg);
}

.task-card.overdue {
    border-left: 4px solid var(--error-color);
    background: rgba(255, 107, 107, 0.05);
}

.completed-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--success-color);
    font-weight: 500;
    font-size: 0.9rem;
}

.priority-badge {
    font-size: 1.2rem;
}

@media (max-width: 768px) {
    .date-tasks {
        grid-template-columns: 1fr;
    }
}
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);