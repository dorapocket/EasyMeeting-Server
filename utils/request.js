function Request(){
    const request=require('request');

    this.postSync=function(url,dataobj){
        return new Promise((reslove,reject)=>{
            request.post({
                timeout:5000,
                url:url,
                json:false,
                body:JSON.stringify(dataobj)
            },function(err,response,body){
                if(err){
                    console.log('[erro] Request '+url+' error',err);
                    reject(err);
                }else{
                    reslove(response);
                }
            });
        });
    }
    this.post=function(url,dataobj,cb){
        request.post({
            url:url,
            json:false,
            body:JSON.stringify(dataobj)
        },cb);
        return;
    }
    this.getSync=function(url,dataobj){
        return new Promise((reslove,reject)=>{
            request.get({
                timeout:5000,
                url:url,
                qs:dataobj
            },function(err,response,body){
                if(err){
                    console.log('[erro] Request '+url+' error',err);
                    reject(err);
                }else{
                    reslove(response);
                }
            });
        });
    }
    this.get=function(url,dataobj,cb){
        request.get({
            timeout:5000,
            url:url,
            qs:dataobj
        },cb);
        return;
    }
}
module.exports=Request;