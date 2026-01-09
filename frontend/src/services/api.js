const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const API_TOKEN = process.env.REACT_APP_API_TOKEN || 'dev-token-change-in-production';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_TOKEN}`
};

export const api = {
  // Resume Upload
  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/resume/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      body: formData
    });
    
    if (!response.ok) throw new Error('Resume upload failed');
    return response.json();
  },

  // Start Interview
  startInterview: async (userId, interviewType, difficulty, resumeData, customRole = null, candidateName = null, yearsExperience = null) => {
    const response = await fetch(`${API_URL}/interview/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: userId,
        interview_type: interviewType,
        difficulty,
        custom_role: customRole,
        resume_data: resumeData,
        candidate_name: candidateName,
        years_experience: yearsExperience
      })
    });
    
    if (!response.ok) throw new Error('Failed to start interview');
    return response.json();
  },

  // Submit Response
  submitResponse: async (sessionId, questionIndex, response, responseTime) => {
    const res = await fetch(`${API_URL}/interview/submit-response`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_id: sessionId,
        question_index: questionIndex,
        response,
        response_time_seconds: responseTime
      })
    });
    
    if (!res.ok) throw new Error('Failed to submit response');
    return res.json();
  },

  // Submit Code (DSA)
  submitCode: async (sessionId, questionId, language, code) => {
    const response = await fetch(`${API_URL}/interview/submit-code`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_id: sessionId,
        question_id: questionId,
        language,
        code
      })
    });
    
    if (!response.ok) throw new Error('Code execution failed');
    return response.json();
  },

  // Get Next Question
  getNextQuestion: async (sessionId) => {
    const response = await fetch(`${API_URL}/interview/next-question?session_id=${sessionId}`, {
      method: 'POST',
      headers
    });
    
    if (!response.ok) throw new Error('Failed to get next question');
    return response.json();
  },

  // Complete Interview
  completeInterview: async (sessionId) => {
    const response = await fetch(`${API_URL}/interview/complete?session_id=${sessionId}`, {
      method: 'POST',
      headers
    });
    
    if (!response.ok) throw new Error('Failed to complete interview');
    return response.json();
  },

  // Interview History
  getInterviewHistory: async (userId, limit = 20) => {
    const response = await fetch(`${API_URL}/interview/history?user_id=${encodeURIComponent(userId)}&limit=${limit}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) throw new Error('Failed to fetch interview history');
    return response.json();
  },

  deleteInterview: async (sessionId, userId) => {
    const response = await fetch(`${API_URL}/interview/history/${encodeURIComponent(sessionId)}?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) throw new Error('Failed to delete interview');
    return response.json();
  }
};