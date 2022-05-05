module.exports.PTNo = "70125",
module.exports.NSCNo = "200036542"
module.exports.SvcTypCd = "TAXI",
module.exports.VehRegJur = "BC",
module.exports.DriversLicJur = "BC",
module.exports.TripTypeCd = "CNVTL"
module.exports.DEFAULT_VEHICLE_ASSIGNMENT_LAT = 49.146961;
module.exports.DEFAULT_VEHICLE_ASSIGNMENT_LNG = -123.937782;


module.exports.issuer = "Nirvana Canada"
module.exports.sub = "TripData"
module.exports.uuid = "320d4143-24b4-47a1-878b-89905f4dacea"
module.exports.sharedKey = "3eff2d76654543949d85f928a3cf9a"
module.exports.publicKey = '-----BEGIN PUBLIC KEY-----MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCpJNTqrymj4HxtpFbG0F1la95J5Gw4k02HPkvoLPcZHJklbJzSxxCIHFZvXgTcAz4YTW/Q++WqR0ANC3lGzEz000LFARkHzjdmKq9cD4v+BiyNeOhdxQZRWTqUOFYh2zeVvKvQPTSEkTY8hv8vuexSdKCC13CQU/Z8O1IKFg+47QIDAQAB-----END PUBLIC KEY-----'
//Chose Jan 5 because prior Jan 5 no driver's shift info available
module.exports.startDate =  new Date("2022-04-20T00:00:00.000Z").toISOString()

var date = new Date();
date.setDate(date.getDate() - 8);
module.exports.endDate = new Date("2022-04-20T00:00:00.000Z").toISOString()
