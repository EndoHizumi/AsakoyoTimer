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
            console.log(`Checking live/upcoming stream for channel: ${channelId}`);
            
            // Method 1: search.list with eventType live
            const searchResponse = await this.youtube.search.list({
                channelId: channelId,
                eventType: 'live',
                type: 'video',
                part: 'snippet',
                maxResults: 10,
                order: 'date'
            });

            console.log(`Live search API response: ${searchResponse.data.items.length} items found`);
            
            if (searchResponse.data.items.length > 0) {
                for (const video of searchResponse.data.items) {
                    console.log(`Found live video: ${video.snippet.title} (${video.id.videoId})`);
                    
                    // Double-check if it's actually live
                    const videoDetails = await this.getVideoInfo(video.id.videoId);
                    if (videoDetails && videoDetails.isLive) {
                        console.log(`Confirmed live: ${videoDetails.title}`);
                        return {
                            videoId: video.id.videoId,
                            title: video.snippet.title,
                            thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
                            channelTitle: video.snippet.channelTitle,
                            publishedAt: video.snippet.publishedAt,
                            status: 'live'
                        };
                    }
                }
            }

            // Method 2: Check for upcoming streams (配信待機状態)
            console.log('No live streams found, checking for upcoming streams...');
            const upcomingStreams = await this.checkChannelUpcomingStreams(channelId);
            
            if (upcomingStreams.length > 0) {
                // 最も近い配信予定を選択
                const nextStream = upcomingStreams[0];
                console.log(`Found upcoming stream: ${nextStream.title}`);
                return {
                    videoId: nextStream.videoId,
                    title: nextStream.title,
                    thumbnail: nextStream.thumbnail,
                    channelTitle: nextStream.channelTitle,
                    publishedAt: nextStream.scheduledStartTime,
                    status: 'upcoming',
                    scheduledStartTime: nextStream.scheduledStartTime
                };
            }

            // Method 3: Check channel's recent videos for live content
            console.log('No upcoming streams found, checking recent videos...');
            const recentResponse = await this.youtube.search.list({
                channelId: channelId,
                type: 'video',
                part: 'snippet',
                maxResults: 20,
                order: 'date'
            });

            console.log(`Recent videos check: ${recentResponse.data.items.length} items found`);
            
            for (const video of recentResponse.data.items) {
                if (video.snippet.liveBroadcastContent === 'live' || video.snippet.liveBroadcastContent === 'upcoming') {
                    console.log(`Found ${video.snippet.liveBroadcastContent} broadcast: ${video.snippet.title}`);
                    return {
                        videoId: video.id.videoId,
                        title: video.snippet.title,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
                        channelTitle: video.snippet.channelTitle,
                        publishedAt: video.snippet.publishedAt,
                        status: video.snippet.liveBroadcastContent
                    };
                }
            }

            console.log('No live or upcoming streams detected');
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
            // まず最新の動画を取得
            const response = await this.youtube.search.list({
                channelId: channelId,
                type: 'video',
                part: 'snippet',
                maxResults: 20,
                order: 'date'
            });

            // upcoming状態の動画をフィルタ
            const upcomingVideos = response.data.items.filter(video => 
                video.snippet.liveBroadcastContent === 'upcoming'
            );

            // 詳細情報を取得して正確な開始予定時刻を取得
            const detailedVideos = await Promise.all(
                upcomingVideos.map(async (video) => {
                    try {
                        const videoDetails = await this.getVideoInfo(video.id.videoId);
                        return {
                            videoId: video.id.videoId,
                            title: video.snippet.title,
                            thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
                            channelTitle: video.snippet.channelTitle,
                            scheduledStartTime: videoDetails?.liveStreamingDetails?.scheduledStartTime || video.snippet.publishedAt
                        };
                    } catch (err) {
                        console.error(`Failed to get details for video ${video.id.videoId}:`, err.message);
                        return {
                            videoId: video.id.videoId,
                            title: video.snippet.title,
                            thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
                            channelTitle: video.snippet.channelTitle,
                            scheduledStartTime: video.snippet.publishedAt
                        };
                    }
                })
            );


            return detailedVideos;
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