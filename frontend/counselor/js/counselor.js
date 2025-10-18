// Counselor Dashboard JavaScript
class CounselorDashboard {
    constructor() {
        this.counselorId = null;
        this.counselorName = null;
        this.currentStudent = null;
        this.socket = null;
        this.students = new Map();
        this.appointments = [];
        this.alerts = [];
        
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.loadInitialData();
        this.setupSocketConnection();
    }

    async checkAuth() {
        const token = localStorage.getItem('counselorToken');
        if (!token) {
            window.location.href = '../student/index.html';
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/counselor/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Not authenticated');
            }

            const data = await response.json();
            this.counselorId = data.id;
            this.counselorName = data.name;
            document.getElementById('counselorName').textContent = this.counselorName;
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    }

    setupEventListeners() {
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Chat
        document.getElementById('sendMessage').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Navigation
        document.getElementById('appointmentsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.scrollToAppointments();
        });

        document.getElementById('analyticsLink').addEventListener('click', (e) => {
            e.preventDefault();
            // Future analytics page
            alert('Analytics dashboard coming soon!');
        });
    }

    setupSocketConnection() {
        this.socket = io('http://localhost:3000', {
            auth: {
                token: localStorage.getItem('counselorToken'),
                role: 'counselor'
            }
        });

        this.socket.on('connect', () => {
            console.log('Connected as counselor');
            this.joinCounselorRoom();
        });

        this.socket.on('student-message', (data) => {
            this.handleIncomingMessage(data);
        });

        this.socket.on('emergency-alert', (data) => {
            this.handleEmergencyAlert(data);
        });

        this.socket.on('mood-alert', (data) => {
            this.handleMoodAlert(data);
        });

        this.socket.on('new-appointment', (data) => {
            this.handleNewAppointment(data);
        });
    }

    joinCounselorRoom() {
        this.socket.emit('join-counselor', { counselorId: this.counselorId });
    }

    async loadInitialData() {
        await Promise.all([
            this.loadStudents(),
            this.loadAppointments(),
            this.loadAlerts()
        ]);
        this.updateStats();
    }

    async loadStudents() {
        try {
            const response = await fetch('http://localhost:3000/api/counselor/students', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('counselorToken')}`
                }
            });

            if (response.ok) {
                const students = await response.json();
                this.students.clear();
                students.forEach(student => {
                    this.students.set(student.id, student);
                });
                this.renderStudentsList();
            }
        } catch (error) {
            console.error('Failed to load students:', error);
        }
    }

    async loadAppointments() {
        try {
            const response = await fetch('http://localhost:3000/api/counselor/appointments', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('counselorToken')}`
                }
            });

            if (response.ok) {
                this.appointments = await response.json();
                this.renderAppointments();
            }
        } catch (error) {
            console.error('Failed to load appointments:', error);
        }
    }

    async loadAlerts() {
        try {
            const response = await fetch('http://localhost:3000/api/counselor/alerts', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('counselorToken')}`
                }
            });

            if (response.ok) {
                this.alerts = await response.json();
                this.renderAlerts();
            }
        } catch (error) {
            console.error('Failed to load alerts:', error);
        }
    }

    renderStudentsList() {
        const container = document.getElementById('studentsList');
        container.innerHTML = '';

        if (this.students.size === 0) {
            container.innerHTML = '<div class="no-students">No active students</div>';
            return;
        }

        this.students.forEach((student, studentId) => {
            const studentEl = document.createElement('div');
            studentEl.className = `student-item ${student.unread ? 'unread' : ''} ${this.currentStudent === studentId ? 'active' : ''}`;
            studentEl.innerHTML = `
                <div class="student-header">
                    <div class="student-name">${student.name || `Student ${studentId}`}</div>
                    ${student.unread ? '<div class="unread-badge">!</div>' : ''}
                </div>
                <div class="last-message">${student.lastMessage || 'No messages yet'}</div>
                <div class="message-time">${student.lastMessageTime || ''}</div>
            `;

            studentEl.addEventListener('click', () => this.selectStudent(studentId));
            container.appendChild(studentEl);
        });
    }

    renderAppointments() {
        const container = document.getElementById('appointmentsList');
        container.innerHTML = '';

        const today = new Date().toDateString();
        const todayAppointments = this.appointments.filter(apt => 
            new Date(apt.datetime).toDateString() === today && apt.status === 'scheduled'
        );

        if (todayAppointments.length === 0) {
            container.innerHTML = '<div class="no-appointments">No appointments today</div>';
            return;
        }

        todayAppointments.forEach(appointment => {
            const aptEl = document.createElement('div');
            aptEl.className = 'appointment-item';
            
            const date = new Date(appointment.datetime);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            aptEl.innerHTML = `
                <div>
                    <div class="appointment-time">${timeStr}</div>
                    <div class="appointment-student">Student ${appointment.studentId}</div>
                </div>
                <div class="appointment-actions">
                    <button class="btn btn-success btn-sm" onclick="dashboard.confirmAppointment('${appointment.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="dashboard.rescheduleAppointment('${appointment.id}')">
                        <i class="fas fa-clock"></i>
                    </button>
                </div>
            `;

            container.appendChild(aptEl);
        });
    }

    renderAlerts() {
        const container = document.getElementById('alertsList');
        container.innerHTML = '';

        if (this.alerts.length === 0) {
            container.innerHTML = '<div class="no-alerts">No recent alerts</div>';
            return;
        }

        this.alerts.slice(0, 5).forEach(alert => {
            const alertEl = document.createElement('div');
            alertEl.className = `alert-item ${alert.type}`;
            alertEl.innerHTML = `
                <div class="alert-info">
                    <strong>Student ${alert.studentId}</strong>
                    <div class="alert-type">${alert.type.toUpperCase()} Alert</div>
                    <div class="alert-message">${alert.metadata}</div>
                    <div class="alert-time">${new Date(alert.created_at).toLocaleTimeString()}</div>
                </div>
            `;

            alertEl.addEventListener('click', () => {
                this.selectStudent(alert.studentId);
                this.showAlert(alert);
            });

            container.appendChild(alertEl);
        });
    }

    selectStudent(studentId) {
        this.currentStudent = studentId;
        const student = this.students.get(studentId);
        
        if (!student) return;

        // Update UI
        document.getElementById('currentChatStudent').textContent = student.name || `Student ${studentId}`;
        document.getElementById('studentIdDisplay').textContent = studentId;
        document.getElementById('studentAvatar').textContent = studentId.charAt(0);
        document.getElementById('studentInfo').style.display = 'flex';
        document.getElementById('chatInput').style.display = 'flex';
        
        // Clear no selection message
        document.getElementById('chatMessages').innerHTML = '';
        
        // Mark as read
        if (student.unread) {
            student.unread = false;
            this.renderStudentsList();
        }

        // Load chat history
        this.loadChatHistory(studentId);
    }

    async loadChatHistory(studentId) {
        try {
            const response = await fetch(`http://localhost:3000/api/counselor/chats/${studentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('counselorToken')}`
                }
            });

            if (response.ok) {
                const messages = await response.json();
                this.renderChatMessages(messages);
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    }

    renderChatMessages(messages) {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';

        messages.forEach(message => {
            this.addMessageToChat(message, message.sender === 'counselor' ? 'sent' : 'received');
        });
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();

        if (!message || !this.currentStudent) return;

        try {
            const response = await fetch('http://localhost:3000/api/counselor/chats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('counselorToken')}`
                },
                body: JSON.stringify({
                    studentId: this.currentStudent,
                    message: message
                })
            });

            if (response.ok) {
                const sentMessage = await response.json();
                this.addMessageToChat(sentMessage, 'sent');
                input.value = '';

                // Emit via socket
                this.socket.emit('counselor-message', {
                    studentId: this.currentStudent,
                    counselorId: this.counselorId,
                    message: message
                });
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    addMessageToChat(message, type) {
        const container = document.getElementById('chatMessages');
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        
        const time = new Date(message.timestamp || new Date()).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit' 
        });

        messageEl.innerHTML = `
            ${type === 'received' ? `<div class="message-sender">Student ${message.studentId}</div>` : ''}
            <div class="message-text">${message.message}</div>
            <div class="message-time">${time}</div>
        `;

        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    handleIncomingMessage(data) {
        const { studentId, message, emergency } = data;
        
        // Update student data
        if (!this.students.has(studentId)) {
            this.students.set(studentId, {
                id: studentId,
                name: `Student ${studentId}`,
                lastMessage: message,
                lastMessageTime: 'Just now',
                unread: true
            });
        } else {
            const student = this.students.get(studentId);
            student.lastMessage = message;
            student.lastMessageTime = 'Just now';
            student.unread = true;
        }

        // Show emergency badge if emergency
        if (emergency && this.currentStudent === studentId) {
            document.getElementById('emergencyBadge').style.display = 'block';
        }

        // Add to chat if currently selected
        if (this.currentStudent === studentId) {
            this.addMessageToChat(data, 'received');
            // Mark as read
            const student = this.students.get(studentId);
            student.unread = false;
        }

        // Show alert for new messages
        if (!this.currentStudent || this.currentStudent !== studentId) {
            this.showNotification(`New message from Student ${studentId}`, message);
        }

        this.renderStudentsList();
        this.updateStats();
    }

    handleEmergencyAlert(data) {
        const { studentId, studentName, message } = data;
        
        // Show urgent alert banner
        this.showAlertBanner(`EMERGENCY: ${studentName} needs immediate assistance`);
        
        // Add to alerts
        this.alerts.unshift({
            studentId,
            type: 'emergency',
            metadata: message,
            created_at: new Date().toISOString()
        });

        this.renderAlerts();
        this.updateStats();
    }

    handleMoodAlert(data) {
        const { studentId, studentName, mood } = data;
        
        // Add to alerts
        this.alerts.unshift({
            studentId,
            type: 'mood',
            metadata: `Reported ${mood} mood (${this.getMoodDescription(mood)})`,
            created_at: new Date().toISOString()
        });

        this.showNotification(`Mood Alert: ${studentName}`, `Reported ${mood} mood`);
        this.renderAlerts();
        this.updateStats();
    }

    handleNewAppointment(data) {
        const { studentId, studentName, appointment } = data;
        
        this.appointments.push({
            id: appointment.id,
            studentId,
            datetime: appointment.datetime,
            status: 'scheduled'
        });

        this.showNotification(`New Appointment: ${studentName}`, 
            `Scheduled for ${new Date(appointment.datetime).toLocaleString()}`);
        
        this.renderAppointments();
        this.updateStats();
    }

    getMoodDescription(mood) {
        const moods = {
            'happy': 'Happy 😊',
            'calm': 'Calm 😌', 
            'sad': 'Sad 😔',
            'anxious': 'Anxious 😰',
            'tired': 'Tired 😴',
            'excited': 'Excited 🥳',
            'angry': 'Angry 😡'
        };
        return moods[mood] || mood;
    }

    showAlertBanner(message) {
        const banner = document.getElementById('alertBanner');
        const alertMessage = document.getElementById('alertMessage');
        
        alertMessage.textContent = message;
        banner.style.display = 'block';

        // Auto-hide after 10 seconds
        setTimeout(() => {
            banner.style.display = 'none';
        }, 10000);
    }

    showNotification(title, message) {
        // Simple notification - could be enhanced with a proper notification system
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: message });
        }
        
        // Also log to console for debugging
        console.log(`Notification: ${title} - ${message}`);
    }

    updateStats() {
        // Update statistics
        const activeChats = Array.from(this.students.values()).filter(s => s.unread).length;
        const pendingAppointments = this.appointments.filter(a => a.status === 'scheduled').length;
        const emergencyAlerts = this.alerts.filter(a => a.type === 'emergency').length;
        const moodAlerts = this.alerts.filter(a => a.type === 'mood').length;

        document.getElementById('activeChats').textContent = activeChats;
        document.getElementById('pendingAppointments').textContent = pendingAppointments;
        document.getElementById('emergencyAlerts').textContent = emergencyAlerts;
        document.getElementById('moodAlerts').textContent = moodAlerts;
    }

    async confirmAppointment(appointmentId) {
        try {
            const response = await fetch(`http://localhost:3000/api/counselor/appointments/${appointmentId}/confirm`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('counselorToken')}`
                }
            });

            if (response.ok) {
                this.loadAppointments();
                this.showNotification('Appointment Confirmed', 'Appointment has been confirmed');
            }
        } catch (error) {
            console.error('Failed to confirm appointment:', error);
        }
    }

    async rescheduleAppointment(appointmentId) {
        const newTime = prompt('Enter new date and time (YYYY-MM-DDTHH:MM):');
        if (!newTime) return;

        try {
            const response = await fetch(`http://localhost:3000/api/counselor/appointments/${appointmentId}/reschedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('counselorToken')}`
                },
                body: JSON.stringify({ datetime: newTime })
            });

            if (response.ok) {
                this.loadAppointments();
                this.showNotification('Appointment Rescheduled', 'Appointment has been rescheduled');
            }
        } catch (error) {
            console.error('Failed to reschedule appointment:', error);
        }
    }

    scrollToAppointments() {
        document.getElementById('appointmentsList').scrollIntoView({ behavior: 'smooth' });
    }

    logout() {
        localStorage.removeItem('counselorToken');
        window.location.href = '../student/index.html';
    }
}

// Request notification permission
if ('Notification' in window) {
    Notification.requestPermission();
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new CounselorDashboard();
});