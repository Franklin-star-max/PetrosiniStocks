// Authentication System
class AuthSystem {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('petrosini_users')) || this.createDefaultUsers();
        this.currentUser = null;
        this.init();
    }

    init() {
        console.log('Auth system initializing...');
        
        // Check if user is already logged in
        const savedUser = localStorage.getItem('petrosini_current_user');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                console.log('User already logged in:', this.currentUser.name);
                
                // If we're on login page, redirect to inventory
                if (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('login.html')) {
                    console.log('Redirecting to inventory...');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 100);
                }
                return;
            } catch (e) {
                console.error('Error parsing saved user:', e);
                localStorage.removeItem('petrosini_current_user');
            }
        }

        // Setup login form if on login page
        if (document.getElementById('loginForm')) {
            console.log('Setting up login form...');
            this.setupLoginForm();
        }
    }

    createDefaultUsers() {
    console.log('Creating default users...');
    const defaultUsers = [
        {
            id: 1,
            username: 'admin',
            password: 'petrosini2024',
            name: 'Administrator',
            role: 'admin'
        },
        {
            id: 2,
            username: 'chibuike',
            password: 'Chibuike123',
            name: 'Chibuike',
            role: 'staff'
        },
        {
            id: 3,
            username: 'chigozie',
            password: 'Chigozie123',
            name: 'Chigozie',
            role: 'staff'
        }
    ];
    
    localStorage.setItem('petrosini_users', JSON.stringify(defaultUsers));
    return defaultUsers;
}
    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
            console.log('Login form event listener added');
        }
    }

    login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        console.log('Login attempt for user:', username);

        const user = this.users.find(u => u.username === username && u.password === password);
        
        if (user) {
            console.log('Login successful for:', user.name);
            this.currentUser = user;
            localStorage.setItem('petrosini_current_user', JSON.stringify(user));
            this.showNotification('Login successful! Redirecting...', 'success');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            console.log('Login failed for:', username);
            this.showNotification('Invalid username or password', 'error');
        }
    }

    logout() {
        console.log('Logging out user:', this.currentUser?.name);
        this.currentUser = null;
        localStorage.removeItem('petrosini_current_user');
        window.location.href = 'login.html';
    }

    checkAuth() {
        if (!this.currentUser) {
            const savedUser = localStorage.getItem('petrosini_current_user');
            if (!savedUser) {
                console.log('No user found, redirecting to login');
                window.location.href = 'login.html';
                return false;
            }
            try {
                this.currentUser = JSON.parse(savedUser);
            } catch (e) {
                console.error('Error parsing user data:', e);
                window.location.href = 'login.html';
                return false;
            }
        }
        return true;
    }

    showNotification(message, type = 'success') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type === 'error' ? 'error' : ''}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    getCurrentUser() {
        return this.currentUser;
    }

    hasPermission(requiredRole) {
        return true;
    }
}

// Create global instance
const auth = new AuthSystem();