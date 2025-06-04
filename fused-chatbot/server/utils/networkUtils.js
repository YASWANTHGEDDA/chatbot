const os = require('os');

/**
 * Get all local IP addresses
 * @returns {string[]} Array of local IP addresses
 */
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    // Iterate through network interfaces
    Object.keys(interfaces).forEach((interfaceName) => {
        interfaces[interfaceName].forEach((iface) => {
            // Skip internal and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        });
    });

    return addresses;
}

module.exports = {
    getLocalIPs
}; 