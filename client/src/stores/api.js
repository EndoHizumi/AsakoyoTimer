// API utility functions

const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

// Schedule API
export const scheduleApi = {
    getAll: () => apiRequest('/schedules'),
    
    create: (data) => apiRequest('/schedules', {
        method: 'POST',
        body: data
    }),
    
    get: (id) => apiRequest(`/schedules/${id}`),
    
    update: (id, data) => apiRequest(`/schedules/${id}`, {
        method: 'PUT',
        body: data
    }),
    
    delete: (id) => apiRequest(`/schedules/${id}`, {
        method: 'DELETE'
    }),
    
    refresh: () => apiRequest('/schedules/refresh', {
        method: 'POST'
    })
};

// Device API
export const deviceApi = {
    getAll: () => apiRequest('/devices'),
    
    scan: () => apiRequest('/devices/scan', {
        method: 'POST'
    }),
    
    update: (id, data) => apiRequest(`/devices/${id}`, {
        method: 'PUT',
        body: data
    }),
    
    test: (id) => apiRequest(`/devices/${id}/test`, {
        method: 'POST'
    })
};

// Cast API
export const castApi = {
    start: (videoId, deviceId) => apiRequest('/cast/start', {
        method: 'POST',
        body: { video_id: videoId, device_id: deviceId }
    }),
    
    stop: () => apiRequest('/cast/stop', {
        method: 'POST'
    }),
    
    getStatus: () => apiRequest('/cast/status')
};

// YouTube API
export const youtubeApi = {
    searchChannels: (query, maxResults = 10) => 
        apiRequest(`/youtube/search?q=${encodeURIComponent(query)}&type=channel&maxResults=${maxResults}`),
    
    getChannelInfo: (channelId) => apiRequest(`/youtube/channel/${channelId}`),
    
    checkChannelLive: (channelId) => apiRequest(`/youtube/channel/${channelId}/live`),
    
    getUpcomingStreams: (channelId) => apiRequest(`/youtube/channel/${channelId}/upcoming`)
};

// System API
export const systemApi = {
    getStatus: () => apiRequest('/status'),
    getLogs: (limit = 50) => apiRequest(`/logs?limit=${limit}`),
    getHealth: () => apiRequest('/health')
};

// Favorites API
export const favoritesApi = {
    getAll: () => apiRequest('/favorites'),
    
    add: (channelData) => apiRequest('/favorites', {
        method: 'POST',
        body: channelData
    }),
    
    remove: (channelId) => apiRequest(`/favorites/${channelId}`, {
        method: 'DELETE'
    }),
    
    getRecent: (limit = 10) => apiRequest(`/recent-channels?limit=${limit}`)
};

export default {
    schedule: scheduleApi,
    device: deviceApi,
    cast: castApi,
    youtube: youtubeApi,
    system: systemApi,
    favorites: favoritesApi
};