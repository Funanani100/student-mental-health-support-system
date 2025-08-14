// appointments.js - Frontend Appointment Management

const API_BASE_URL = 'http://localhost:3000/api';

// Book appointment
export const bookAppointment = async (appointmentData) => {
  try {
    const token = localStorage.getItem('studentToken');
    const studentId = localStorage.getItem('studentId');
    
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ...appointmentData, studentId })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return data;
    } else {
      throw new Error(data.error || 'Failed to book appointment');
    }
  } catch (error) {
    console.error('Booking error:', error);
    throw error;
  }
};

// Get appointments
export const getAppointments = async () => {
  try {
    const token = localStorage.getItem('studentToken');
    const studentId = localStorage.getItem('studentId');
    
    const response = await fetch(`${API_BASE_URL}/appointments?studentId=${studentId}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return data;
    } else {
      throw new Error(data.error || 'Failed to fetch appointments');
    }
  } catch (error) {
    console.error('Appointment fetch error:', error);
    throw error;
  }
};

// Update appointment
export const updateAppointment = async (appointmentId, updateData) => {
  try {
    const token = localStorage.getItem('studentToken');
    
    const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return data;
    } else {
      throw new Error(data.error || 'Failed to update appointment');
    }
  } catch (error) {
    console.error('Update error:', error);
    throw error;
  }
};

// Cancel appointment
export const cancelAppointment = async (appointmentId) => {
  try {
    const token = localStorage.getItem('studentToken');
    
    const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return { message: 'Appointment cancelled' };
    } else {
      const data = await response.json();
      throw new Error(data.error || 'Failed to cancel appointment');
    }
  } catch (error) {
    console.error('Cancellation error:', error);
    throw error;
  }
};