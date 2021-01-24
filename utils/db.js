function Db(){
    const mysql=require('mysql');
    const sql=mysql.createConnection({
    host:'localhost',
    user:'root',
    password:'',
    database:'easymeeting'
});
sql.connect((err)=>{
    if(err)
    handleSQLErr(err);
});
function handleSQLErr(err){
    console.log('[erro] SQL error:',err);
}
this.handleSQLErr=function(err){
    handleSQLErr(err);
};
this.connect=function(){
    sql.connect((err)=>{
        if(err)
        handleSQLErr(err);
    });
}
this.query=function(sqld,paraArray){
    return new Promise((reslove,reject)=>{
        sql.query(sqld,paraArray,(err,result,fields)=>{
            if(err) reject(err);
            reslove(result,fields);
        });
    })
}
}
module.exports=Db