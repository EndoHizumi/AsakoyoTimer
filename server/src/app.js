const path = require('path');
// 複数の.envファイルの場所を試す
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config(); // カレントディレクトリの.env
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Services
const Database = require('./models/Database');
const YouTubeService = require('./services/YouTubeService');
const ChromeCastService = require('./services/ChromeCastService');
const ScheduleService = require('./services/ScheduleService');
const WebSocketManager = require('./services/WebSocketManager');

// Controllers
const createApiRoutes = require('./controllers/api');

class AutoCastServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.wsPort = process.env.WS_PORT || 3001;
        
        // Services
        this.database = null;
        this.youtubeService = null;
        this.chromecastService = null;
        this.scheduleService = null;
        this.wsManager = null;
        
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('Initializing AutoCast server...');

            // Database initialization
            this.database = new Database();
            await this.database.connect();

            // YouTube API service
            const youtubeApiKey = process.env.YOUTUBE_API_KEY;
            console.log('YOUTUBE_API_KEY loaded:', youtubeApiKey ? `${youtubeApiKey.substring(0, 10)}...` : 'NOT FOUND');
            if (!youtubeApiKey) {
                console.warn('YOUTUBE_API_KEY not found in environment variables');
            }
            this.youtubeService = new YouTubeService(youtubeApiKey);

            // WebSocket manager
            this.wsManager = new WebSocketManager(this.wsPort);
            this.wsManager.initialize();

            // ChromeCast service
            this.chromecastService = new ChromeCastService(this.database, this.wsManager);

            // Schedule service
            this.scheduleService = new ScheduleService(
                this.database,
                this.youtubeService,
                this.chromecastService,
                this.wsManager
            );
            await this.scheduleService.initialize();

            // Setup WebSocket event handlers
            this.setupWebSocketEventHandlers();

            // Express app setup
            this.setupExpress();

            this.isInitialized = true;
            console.log('AutoCast server initialized successfully');
        } catch (error) {
            console.error('Server initialization failed:', error);
            throw error;
        }
    }

    getHelmetConfig(securityMode) {
        switch (securityMode) {
            case 'strict':
                return {
                    contentSecurityPolicy: {
                        directives: {
                            "default-src": ["'self'"],
                            "script-src": ["'self'"],
                            "style-src": ["'self'", "https://fonts.googleapis.com"],
                            "font-src": ["'self'", "https://fonts.gstatic.com"],
                            "connect-src": ["'self'", "wss:"],
                            "img-src": ["'self'", "data:"],
                            "object-src": ["'none'"],
                            "frame-ancestors": ["'none'"]
                        }
                    }
                };

            case 'production':
                return {
                    contentSecurityPolicy: {
                        directives: {
                            "default-src": ["'self'"],
                            "script-src": ["'self'", "'unsafe-eval'"],
                            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                            "font-src": ["'self'", "https://fonts.gstatic.com"],
                            "connect-src": ["'self'", "ws:", "wss:"],
                            "img-src": ["'self'", "data:", "https:"],
                            "object-src": ["'none'"],
                            "frame-ancestors": ["'none'"]
                        }
                    },
                    crossOriginResourcePolicy: { policy: "same-origin" }
                };

            case 'local':
            default:
                return {
                    contentSecurityPolicy: false, // ローカル環境では無効化
                    crossOriginEmbedderPolicy: false,
                    crossOriginResourcePolicy: { policy: "cross-origin" }
                };
        }
    }

    setupExpress() {
        // Security middleware
        const securityMode = process.env.SECURITY_MODE || 'local';
        const helmetConfig = this.getHelmetConfig(securityMode);
        this.app.use(helmet(helmetConfig));
        
        // CORS configuration
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' ? true : ['http://localhost:5173', 'http://localhost:3000'],
            credentials: true
        }));

        // Body parsing middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Static files (for production build)
        const clientPath = path.join(__dirname, '../../client/dist');
        this.app.use(express.static(clientPath));

        // API routes
        this.app.use('/api', createApiRoutes(
            this.database,
            this.youtubeService,
            this.chromecastService,
            this.scheduleService,
            this.wsManager
        ));

        // YouTube redirect endpoint for Chromecast
        this.app.get('/youtube-redirect/:videoId', (req, res) => {
            const { videoId } = req.params;
            const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
            
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Redirecting to YouTube...</title>
    <meta http-equiv="refresh" content="0; url=${youtubeUrl}">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .loading { font-size: 18px; color: #666; }
    </style>
</head>
<body>
    <div class="loading">Redirecting to YouTube...</div>
    <script>
        setTimeout(function() {
            window.location.href = '${youtubeUrl}';
        }, 1000);
    </script>
</body>
</html>`;
            
            res.send(html);
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date(),
                uptime: process.uptime(),
                version: require('../../package.json').version || '1.0.0'
            });
        });

        // Catch-all handler: send back React's index.html file for SPA routing
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(clientPath, 'index.html'));
        });

        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('Express error:', err);
            res.status(500).json({
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
            });
        });
    }

    setupWebSocketEventHandlers() {
        this.wsManager.setEventHandlers({
            manual_cast_request: async (data) => {
                try {
                    const { video_id, device_id } = data;
                    if (video_id && device_id) {
                        const result = await this.chromecastService.startCast(video_id, device_id);
                        this.wsManager.broadcast({
                            type: 'manual_cast_success',
                            data: result
                        });
                    }
                } catch (error) {
                    this.wsManager.broadcastError({
                        message: 'Manual cast failed',
                        details: error.message
                    });
                }
            },

            stop_cast_request: async (data) => {
                try {
                    const result = await this.chromecastService.stopCast('manual');
                    this.wsManager.broadcast({
                        type: 'cast_stop_success',
                        data: result
                    });
                } catch (error) {
                    this.wsManager.broadcastError({
                        message: 'Cast stop failed',
                        details: error.message
                    });
                }
            },

            status_request: async (ws) => {
                try {
                    const status = {
                        schedule: this.scheduleService.getScheduleStatus(),
                        cast: this.chromecastService.getCastStatus(),
                        websocket: this.wsManager.getStatus(),
                        nextSchedule: await this.scheduleService.getNextSchedule()
                    };

                    this.wsManager.sendToClient(ws, {
                        type: 'status_response',
                        data: status
                    });
                } catch (error) {
                    this.wsManager.sendToClient(ws, {
                        type: 'error',
                        data: { message: 'Status request failed', details: error.message }
                    });
                }
            },

            scan_devices_request: async (data) => {
                try {
                    const devices = await this.chromecastService.scanAndSaveDevices();
                    this.wsManager.broadcastDevicesFound(devices);
                } catch (error) {
                    this.wsManager.broadcastError({
                        message: 'Device scan failed',
                        details: error.message
                    });
                }
            }
        });
    }

    async start() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`AutoCast server started on port ${this.port}`);
                    console.log(`WebSocket server running on port ${this.wsPort}`);
                    console.log(`Web interface: http://localhost:${this.port}`);
                    resolve();
                }
            });
        });
    }

    async stop() {
        console.log('Stopping AutoCast server...');

        // Stop schedule service
        if (this.scheduleService) {
            this.scheduleService.stopAllJobs();
        }

        // Stop ChromeCast service
        if (this.chromecastService) {
            this.chromecastService.cleanup();
        }

        // Close WebSocket server
        if (this.wsManager) {
            this.wsManager.close();
        }

        // Close database connection
        if (this.database) {
            this.database.close();
        }

        // Close HTTP server
        if (this.server) {
            this.server.close();
        }

        console.log('AutoCast server stopped');
    }

    getStatus() {
        return {
            isInitialized: this.isInitialized,
            port: this.port,
            wsPort: this.wsPort,
            uptime: process.uptime()
        };
    }
}

// Application entry point
async function main() {
    const server = new AutoCastServer();

    // Graceful shutdown handlers
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });

    process.on('uncaughtException', (error) => {
        console.error('Uncaught exception:', error);
        server.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled rejection at:', promise, 'reason:', reason);
        server.stop().then(() => process.exit(1));
    });

    try {
        await server.start();
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the application if this file is run directly
if (require.main === module) {
    main();
}

module.exports = AutoCastServer;