// auth.js - Frontend Authentication

const API_BASE_URL = 'http://localhost:3000/api';

// Student login
export const studentLogin = async (studentId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      localStorage.setItem('studentToken', data.token);
      localStorage.setItem('studentId', studentId);
      return data.token;
    } else {
      throw new Error(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Student logout
export const studentLogout = async () => {
  try {
    const token = localStorage.getItem('studentToken');
    
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    localStorage.removeItem('studentToken');
    localStorage.removeItem('studentId');
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// Check authentication
export const checkAuth = async () => {
  const token = localStorage.getItem('studentToken');
  const studentId = localStorage.getItem('studentId');
  
  if (!token || !studentId) {
    window.location.href = 'login.html';
    return false;
  }
  
  try {
    // Verify token with backend
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      localStorage.removeItem('studentToken');
      localStorage.removeItem('studentId');
      window.location.href = 'login.html';
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    localStorage.removeItem('studentToken');
    localStorage.removeItem('studentId');
    window.location.href = 'login.html';
    return false;
  }
};