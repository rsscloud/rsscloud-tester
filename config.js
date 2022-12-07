require('dotenv').config();

module.exports = {
    domain: process.env.DOMAIN || 'localhost',
    port: process.env.PORT || 3000,
    extport: process.env.EXTPORT || 3000,
}
