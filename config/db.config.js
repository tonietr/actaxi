module.exports = {
    HOST: "localhost",
    USER: "actaxi_admin",
    PASSWORD: "NirvanaCanada4745891!",
    DB: "actaxi_TripData",
    dialect: "mysql",
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
}