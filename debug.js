require('dotenv').config();
const {Client} = require('@notionhq/client');
const notion=new Client({auth: process.env.NOTION_API_KEY});
// monkey-patch
const orig = notion.executeSingleRequest.bind(notion);
notion.executeSingleRequest = async (opts)=>{
  const url = notion.buildRequestUrl(opts.path, opts.query);
  console.error('REQ URL', url.toString());
  console.error('REQ method', opts.method);
  console.error('REQ body', JSON.stringify(opts.body));
  return orig(opts);
};
(async()=>{
  try{
    const res=await notion.request({path:'databases/'+process.env.SPRINT_DB_ID+'/query',method:'post',body:{}});
    console.log('res',res);
  }catch(e){
    console.error('err',e);
  }
})();
