const net = require('net');
const os = require('os');

class NetworkScanner {
    static getLocalNetworkRange() {
        const interfaces = os.networkInterfaces();
        const ranges = [];
        
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    const parts = iface.address.split('.');
                    const baseIp = `${parts[0]}.${parts[1]}.${parts[2]}`;
                    ranges.push(baseIp);
                }
            }
        }
        
        return ranges;
    }

    static async scanPort(ip, port, timeout = 1000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            
            const onError = () => {
                socket.destroy();
                resolve(false);
            };
            
            socket.setTimeout(timeout);
            socket.on('error', onError);
            socket.on('timeout', onError);
            
            socket.connect(port, ip, () => {
                socket.end();
                resolve(true);
            });
        });
    }

    static async scanChromecastDevices() {
        const ranges = this.getLocalNetworkRange();
        const devices = [];
        const scanPromises = [];
        
        for (const baseIp of ranges) {
            // 192.168.1.1 から 192.168.1.254 までスキャン
            for (let i = 1; i <= 254; i++) {
                const ip = `${baseIp}.${i}`;
                
                scanPromises.push(
                    this.scanPort(ip, 8009).then(isOpen => {
                        if (isOpen) {
                            devices.push({
                                name: `ChromeCast-${ip.split('.').pop()}`,
                                ip_address: ip,
                                port: 8009,
                                host: ip
                            });
                        }
                    })
                );
            }
        }
        
        await Promise.all(scanPromises);
        return devices;
    }

    static async quickScan() {
        console.log('Scanning for ChromeCast devices...');
        const devices = await this.scanChromecastDevices();
        console.log(`Found ${devices.length} potential ChromeCast devices`);
        return devices;
    }
}

module.exports = NetworkScanner;