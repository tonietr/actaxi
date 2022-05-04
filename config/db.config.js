//Devs
// module.exports = {
//     HOST: "localhost",
//     USER: "actaxi_admin",
//     PASSWORD: "NirvanaCanada4745891!",
//     DB: "actaxi_TripData",
//     dialect: "mysql",
//     pool: {
//         max: 5,
//         min: 0,
//         acquire: 30000,
//         idle: 10000
//     }
// }

//Production
module.exports = {
    HOST: "db-mysql-tor1-88116-do-user-11504853-0.b.db.ondigitalocean.com",
    USER: "doadmin",
    PASSWORD: "AVNS_pJMVwxozpKHCxQi",
    DB: "actaxi_TripData",
    dialect: "mysql",
    port: 25060,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 30000
    }
}
