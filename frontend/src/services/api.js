import { auth } from '../firebase';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const getAuthHeaders = async (isForm = false) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const base = {
    'Authorization': `Bearer ${token}`
  };
  return isForm ? base : { 'Content-Type': 'application/json', ...base };
};

export const api = {
  // Resume Upload
  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/resume/upload`, {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: formData
    });
    
    if (!response.ok) throw new Error('Resume upload failed');
    return response.json();
  },

  // Start Interview
  startInterview: async (userId, interviewType, difficulty, resumeData, customRole = null, candidateName = null, yearsExperience = null) => {
    const response = await fetch(`${API_URL}/interview/start`, {
      method: 'POST',
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders()
    });
    
    if (!response.ok) throw new Error('Failed to get next question');
    return response.json();
  },

  // Complete Interview
  completeInterview: async (sessionId) => {
    const response = await fetch(`${API_URL}/interview/complete?session_id=${sessionId}`, {
      method: 'POST',
      headers: await getAuthHeaders()
    });
    
    if (!response.ok) throw new Error('Failed to complete interview');
    return response.json();
  },

  // Interview History
  getInterviewHistory: async (limit = 20) => {
    const response = await fetch(`${API_URL}/interview/history?limit=${limit}`, {
      method: 'GET',
      headers: await getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to fetch interview history');
    return response.json();
  },

  deleteInterview: async (sessionId) => {
    const response = await fetch(`${API_URL}/interview/history/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to delete interview');
    return response.json();
  },

  deleteAccountData: async () => {
    const response = await fetch(`${API_URL}/interview/account/purge`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete account data');
    return response.json();
  }
};