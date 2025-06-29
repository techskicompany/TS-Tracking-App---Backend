const http = require('http');
const Socket = require('socket.io');
const express= require('express');
const cors = require('cors');
const { connectOptions } = require('./use_mqtt.js');
const mqtt = require('mqtt');


const {pool} = require('./connect.js')

var isServerRunning= false;

const app=express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app)
const io = new Socket.Server(server,{cors:{origin:'*'}});

app.use(cors())
app.use(express.json())

// Login Route
app.post("/login",async (req,res)=>{
  const {email,password}=req.body;
  try {
    const [rows]= await pool.query('SELECT * FROM customers WHERE email=?',[email]);
    if(rows.length===0){
      return res.status(404).json({loginState:false,message:"User not found"});
    }
    const user = rows[0];
    const isMatch = password===user.password ? true : false;
    if(!isMatch){
      return res.status(401).json({loginState:false,message:"Invalid Password"});
    }
    const [devices] = await pool.query('SELECT * FROM customer_devices WHERE customer_id=?',[user.id]);
 
    
    
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


    const deviceStates = new Map();
    devices.forEach(device=>{

      const id =device.device_id;
      const topic = '/techski/tracking/'+id+'/location'
      const qos = 0;

      client.on('connect', () => {
        console.log('Socket Connected')
        client.subscribe(topic, { qos }, (error) => {
          if (error) {
            // console.log('subscribe error')
            return
          }
          console.log('Subscribe to topic '+topic)
        })
      })

      client.on('message', (topic, payload) => {
        const deviceId= topic.split("/")[3];
        console.log("message from topic: ",topic);
        const data = JSON.parse(payload.toString());
        if(data.lat && data.lng){
          deviceStates.set(deviceId,{
            lat:data.lat,
            lng:data.lng,
            last_seen: new Date()
          })
          setInterval(()=>{
            deviceStates.forEach((data,deviceId)=>{
              updateDeviceLocation(deviceId,data)
            })
          },60*1000)

          setInterval(()=>{
            deviceStates.forEach((data,deviceId)=>{
              saveLocationHistory(deviceId,data)
            })
          },120*1000)
        }        
        
        if(!isServerRunning){
          server.listen(PORT,()=>{
            isServerRunning=true;
            console.log("API running at "+PORT);
          });
        }
    
        io.emit('tracking_data_'+deviceId, JSON.stringify(data));
      });
    })

    res.json({loginState:true,message:"Login successfully",user:{id:user.id,devices:devices}})
  } catch (error) {
    res.status(500).json({loginState:false,message:"Server Error "+error});
  }
})

// Add Device Route
app.post("/new-device",async (req,res)=>{
  const {userId,device_name,device_uiid,device_type}=req.body;
   
  try {
    if(userId==null||device_name==null||device_uiid==null||device_type==null){
      return res.status(401).json({loginState:false,message:"Missing Fields"});
    }
    const [device] = await pool.query("SELECT * FROM devices WHERE device_uiid=?",[device_uiid]);
    
    if(device.length===0){
      return res.status(404).json({addedState:false,message:"Device uiid not found"});
    }
    const [customer_device] = await pool.query("SELECT * FROM customer_devices WHERE device_id=?",[device[0].id]);
    if(customer_device.length!==0){
      return res.status(401).json({addedState:false,message:"Device is exist"});
    }
    const [result]= await pool.query('INSERT INTO customer_devices (customer_id,device_id,device_name,device_type) VALUES (?,?,?,?)',[userId,device[0].id,device_name,device_type])
    
    if(result.affectedRows===1){
      return res.json({addedState:true,message:"Device added successfully"});
    }
  } catch (error) {
    res.status(500).json({addedState:false,message:"Server Error "+error});    
  }
})

// Delete Device Route
app.post("/delete-device",async (req,res)=>{
  const {device_id}=req.body;
  
  try {
    if(device_id==null){
      return res.status(401).json({message:"Missing Fields"});
    }

    const [device] = await pool.query("SELECT * FROM customer_devices WHERE device_id=?",[device_id]);

    if(device.length===0){
      return res.status(404).json({message:"Device not found"});
    }
    
    await pool.query("DELETE FROM customer_devices WHERE device_id=?",[device_id]);
    return res.json({message:"Device deleted successfully"})

  } catch (error) {
    res.status(500).json({addedState:false,message:"Server Error "+error});    
  }
})
// Getting device data
app.post("/device",async (req,res)=>{
  const {device_data,data_type}=req.body;
  var devices;
  try {
    if(device_data==null || data_type==null){
      return res.status(401).json({loginState:false,message:"Missing Fields"});
    }
    if(data_type=="id"){
      [devices] = await pool.query("SELECT * FROM devices WHERE id=?",[device_data]);
    }else if(data_type=="uiid"){
      [devices] = await pool.query("SELECT * FROM devices WHERE device_uiid=?",[device_data]);
    }
    if(devices.length===0){
      return res.status(404).json({message:"Device not found"});
    }
    return res.json({device:devices[0]});

  } catch (error) {
    res.status(500).json({addedState:false,message:"Server Error "+error});    
  }
})

// Getting Device Hsitory  
app.post("/device-history",async (req,res)=>{
  const {device_id}=req.body;
  try {
    if(device_id==null){
      return res.status(401).json({message:"Missing Fields"});
    }
   
    [history] = await pool.query("SELECT * FROM geolocation_history WHERE device_id=?",[device_id]);
    
    return res.json({location_history:history});

  } catch (error) {
    res.status(500).json({message:"Server Error "+error});    
  }
})

/**
 * Socket.IO Connection
 */
io.on('connection',(socket)=>{
  // console.log("Client connected:",socket.id);  
})





server.listen(PORT,()=>{
  isServerRunning=true;
  console.log("Server running at "+PORT);
  
})


async function updateDeviceLocation(deviceId,data){
  
  pool.query("UPDATE devices SET current_latitude= ?,current_longitude= ? , last_seen= ?  WHERE id=?",[data.lat,data.lng,formatDateTime(data.last_seen),deviceId]);
  
  console.log("Device updated");
  
}
async function saveLocationHistory(deviceId,data){
  pool.query('INSERT INTO geolocation_history (device_id,latitude,longitude) VALUES (?,?,?)',[deviceId,data.lat,data.lng]);
}
function formatDateTime(date){
  return date.toISOString().slice(0,19).replace('T',' ');
}
