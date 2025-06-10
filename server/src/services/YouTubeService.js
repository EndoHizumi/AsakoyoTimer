const { google } = require('googleapis');

class YouTubeService {
    constructor(apiKey) {
        this.youtube = google.youtube({
            version: 'v3',
            auth: apiKey
        });
        this.apiKey = apiKey;
    }

    async checkChannelLive(channelId) {
        try {
            console.log(`Checking live stream for channel: ${channelId}`);
            
            // Method 1: search.list with eventType
            const searchResponse = await this.youtube.search.list({
                channelId: channelId,
                eventType: 'live',
                type: 'video',
                part: 'snippet',
                maxResults: 10,
                order: 'date'
            });

            console.log(`Search API response: ${searchResponse.data.items.length} items found`);
            
            if (searchResponse.data.items.length > 0) {
                for (const video of searchResponse.data.items) {
                    console.log(`Found video: ${video.snippet.title} (${video.id.videoId})`);
                    
                    // Double-check if it's actually live
                    const videoDetails = await this.getVideoInfo(video.id.videoId);
                    if (videoDetails && videoDetails.isLive) {
                        console.log(`Confirmed live: ${videoDetails.title}`);
                        return {
                            videoId: video.id.videoId,
                            title: video.snippet.title,
                            thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
                            channelTitle: video.snippet.channelTitle,
                            publishedAt: video.snippet.publishedAt
                        };
                    }
                }
            }

            // Method 2: Check channel's recent videos for live content
            console.log('No live streams found via search, checking recent videos...');
            const recentResponse = await this.youtube.search.list({
                channelId: channelId,
                type: 'video',
                part: 'snippet',
                maxResults: 20,
                order: 'date'
            });

            console.log(`Recent videos check: ${recentResponse.data.items.length} items found`);
            
            for (const video of recentResponse.data.items) {
                if (video.snippet.liveBroadcastContent === 'live') {
                    console.log(`Found live broadcast: ${video.snippet.title}`);
                    return {
                        videoId: video.id.videoId,
                        title: video.snippet.title,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
                        channelTitle: video.snippet.channelTitle,
                        publishedAt: video.snippet.publishedAt
                    };
                }
            }

            console.log('No live streams detected');
            return null;
        } catch (error) {
            console.error('YouTube API error in checkChannelLive:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                errors: error.errors
            });
            throw error;
        }
    }

    async searchChannels(query, maxResults = 10) {
        try {
            const response = await this.youtube.search.list({
                q: query,
                type: 'channel',
                part: 'snippet',
                maxResults: maxResults
            });

            return response.data.items.map(item => ({
                channelId: item.id.channelId,
                name: item.snippet.title,
                thumbnail: item.snippet.thumbnails.default.url,
                description: item.snippet.description
            }));
        } catch (error) {
            console.error('YouTube API error in searchChannels:', error);
            throw error;
        }
    }

    async getChannelInfo(channelId) {
        try {
            const response = await this.youtube.channels.list({
                id: channelId,
                part: 'snippet,statistics',
                maxResults: 1
            });

            if (response.data.items.length > 0) {
                const channel = response.data.items[0];
                return {
                    channelId: channel.id,
                    name: channel.snippet.title,
                    description: channel.snippet.description,
                    thumbnail: channel.snippet.thumbnails.medium.url,
                    subscriberCount: channel.statistics.subscriberCount,
                    videoCount: channel.statistics.videoCount,
                    viewCount: channel.statistics.viewCount
                };
            }
            return null;
        } catch (error) {
            console.error('YouTube API error in getChannelInfo:', error);
            throw error;
        }
    }

    async getVideoInfo(videoId) {
        try {
            const response = await this.youtube.videos.list({
                id: videoId,
                part: 'snippet,liveStreamingDetails',
                maxResults: 1
            });

            if (response.data.items.length > 0) {
                const video = response.data.items[0];
                return {
                    videoId: video.id,
                    title: video.snippet.title,
                    description: video.snippet.description,
                    thumbnail: video.snippet.thumbnails.medium.url,
                    channelId: video.snippet.channelId,
                    channelTitle: video.snippet.channelTitle,
                    publishedAt: video.snippet.publishedAt,
                    isLive: video.snippet.liveBroadcastContent === 'live',
                    liveStreamingDetails: video.liveStreamingDetails
                };
            }
            return null;
        } catch (error) {
            console.error('YouTube API error in getVideoInfo:', error);
            throw error;
        }
    }

    async checkChannelUpcomingStreams(channelId) {
        try {
            const response = await this.youtube.search.list({
                channelId: channelId,
                eventType: 'upcoming',
                type: 'video',
                part: 'snippet',
                maxResults: 10,
                order: 'date'
            });

            return response.data.items.map(video => ({
                videoId: video.id.videoId,
                title: video.snippet.title,
                thumbnail: video.snippet.thumbnails.medium.url,
                channelTitle: video.snippet.channelTitle,
                scheduledStartTime: video.snippet.publishedAt
            }));
        } catch (error) {
            console.error('YouTube API error in checkChannelUpcomingStreams:', error);
            throw error;
        }
    }

    validateApiKey() {
        return this.apiKey && this.apiKey.length > 0;
    }

    async testConnection() {
        try {
            // 簡単なテスト用のAPIコール
            const response = await this.youtube.search.list({
                q: 'test',
                type: 'video',
                part: 'snippet',
                maxResults: 1
            });
            return response.status === 200;
        } catch (error) {
            console.error('YouTube API connection test failed:', error);
            return false;
        }
    }
}

module.exports = YouTubeService;