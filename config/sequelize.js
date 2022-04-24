const { Sequelize } = require('sequelize');
const dbConfig = require('./db.config')
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    operatorsAliases: false,
    pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle
    }
});
const TripData = require('../models/TripData')(sequelize, Sequelize)

module.exports = {
    sequelize,
    TripData
}
