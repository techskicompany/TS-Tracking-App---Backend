
const mysql=require('mysql2/promise');


const dbConfig={
    host:'sql3.freesqldatabase.com',
    user:'sql3787306',
    password:'YLq5zEs9NP',
    database:'sql3787306'
}
const pool = mysql.createPool(dbConfig);


 
module.exports ={pool};
