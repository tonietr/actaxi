const { JWK, JWE } = require('node-jose');
const CompanyData = require('./company.data')
var crypto = require('crypto')
const { createSecretKey } = require('crypto');
const UUID = require('uuid');
const SHARED_KEY = require('./company.data').sharedKey
const PUBLIC_KEY = require('./company.data').publicKey
const jwt = require('jsonwebtoken')

const encrypt = async (raw, format = 'compact', contentAlg = "A256GCM", alg = "RSA-OAEP") => {
    const publicKey = await JWK.asKey(PUBLIC_KEY, "pem");
    const buffer = Buffer.from(JSON.stringify(raw))
    const encrypted = await JWE.createEncrypt({
        format: format,
        contentAlg: contentAlg,
        fields: {
            alg: alg
        }
    }, publicKey).update(buffer).final();
    return encrypted
}

module.exports.generateJWToken = async() => {
    //Registered claims
    const iss = CompanyData.issuer
    const sub = CompanyData.sub
    const uuid = CompanyData.uuid
    //Private claims
    
    const ptnum = CompanyData.PTNo
    const created = new Date().toISOString()
    var crypto = require("crypto");
    const osv = crypto.randomBytes(5).toString('hex');
    console.log("OSV", osv)
    const payload = {
        iss: iss,
        sub: sub,
        uuid: uuid,
        ptnum: ptnum,
        created: created,
        osv : osv
    }

    const signedJWT = jwt.sign(payload, SHARED_KEY, {
        algorithm: 'HS256'
    })
    const publicKey = await JWK.asKey(PUBLIC_KEY, "pem");
    jwt.verify(signedJWT, SHARED_KEY, function(err, decoded) {
        console.log(decoded) // bar
        if (err) console.log(err)
      });
          // // const jwe = await new jose.EncryptJWT({ 'urn:example:claim': true })
    // //     .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" })
    // //     .setAudience(token)
    // //     .encrypt(PUBLIC_KEY)
    console.log(signedJWT)
    // // console.log(jwe)
    // return jwt
    const encryptedJWT = await encrypt(signedJWT)
    
    return encryptedJWT
}