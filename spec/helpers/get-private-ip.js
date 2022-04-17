/**
 * @fileoverview Utility function to get the private IP of the current machine.
 */

const os = require('os')

/**
 * Gets the private IP of the current machine.
 * @returns {string}
 */
function getPrivateIp () {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter(int => !int.internal && int.family === 'IPv4')
    .map(int => int.address)

  // Return the first one.
  return ips[0]
}

module.exports = getPrivateIp
