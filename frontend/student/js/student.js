import { API_BASE, authHeaders, handleApiError, formatDate, formatTime } from '../../shared/utils/helpers.js';

// Common functions for student pages
const studentToken = localStorage.getItem('studentToken');
const studentId = localStorage.getItem('studentId');

// Check authentication
if (!studentToken && !window.location.pathname.endsWith('index.html')) {
    window.location.href = 'index.html';
}

// Dashboard functions
export async function loadDashboardData() {
    try {
        // Load today's mood
        const today = new Date().toISOString().split('T')[0];
        const moodRes = await fetch(`${API_BASE}/mood?date=${today}`, {
            headers: authHeaders(studentToken)
        });
        
        if (moodRes.ok) {
            const moodData = await moodRes.json();
            if (moodData.length > 0) {
                const moodValue = moodData[0].mood;
                const moodIcons = ['😢', '😞', '😐', '😊', '😄'];
                document.getElementById('today-mood').textContent = moodIcons[moodValue - 1];
            }
        }
    }}

// Helper function
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}