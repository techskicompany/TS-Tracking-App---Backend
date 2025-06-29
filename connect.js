
const mysql=require('mysql2/promise');
const { connectOptions } = require('./use_mqtt.js');
const mqtt = require('mqtt');



const dbConfig={
    host:'sql3.freesqldatabase.com',
    user:'sql3787306',
    password:'YLq5zEs9NP',
    database:'sql3787306'
}
const pool = mysql.createPool(dbConfig);


/**
 * MQTT Broker options
 */
const clientId = 'tech_ski_tracking_' + Math.random().toString(16).substring(2, 8)
const options = {
clientId,
clean: true,
connectTimeout: 4000,
username: 'emqx_test',
password: 'emqx_test',
reconnectPeriod: 1000,
}

const { protocol, host, port } = connectOptions

let connectUrl = `${protocol}://${host}:${port}`
if (['ws', 'wss'].includes(protocol)) {
connectUrl += '/mqtt'
}
/**
 * MQTT Broker connection
 */
const client = mqtt.connect(connectUrl, options)

 
module.exports ={pool,client};
