function Db(){
    const mysql=require('mysql');
    const sysConfig=require('../server_config.json');
    const sql=mysql.createConnection(sysConfig.DB_CONFIG);
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
    sql.connect((err)=>{
        // if(err)
        // handleSQLErr(err);
    });
    return new Promise((reslove,reject)=>{
        sql.query(sqld,paraArray,(err,result,fields)=>{
            if(err) reject(err);
            reslove(result,fields);
        });
    })
}
}
module.exports=Db