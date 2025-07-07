
const mysql=require('mysql2/promise');


const dbConfig={
    host:'sql3.freesqldatabase.com',
    user:'sql3788708',
    password:'YLq5zEs9NP',
    database:'sql3788708'
}
const pool = mysql.createPool(dbConfig);


 
module.exports ={pool};
