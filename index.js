require('dotenv').config();
const express = require('express');
const { WebClient } = require('@slack/web-api');

// ---------------------------------------------------------------------------
// Nominal-branded rocket GIF — generated at startup in pure JavaScript
// ---------------------------------------------------------------------------
function _lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eofCode   = clearCode + 1;
  let codeSize    = minCodeSize + 1;
  let nextCode    = eofCode + 1;
  const output = [];
  let buf = 0, bits = 0;
  const emit = (code) => {
    buf |= (code << bits); bits += codeSize;
    while (bits >= 8) { output.push(buf & 0xFF); buf >>= 8; bits -= 8; }
  };
  const table = new Map();
  let prefix = -1;
  emit(clearCode);
  for (let i = 0; i < pixels.length; i++) {
    const px = pixels[i];
    if (prefix === -1) { prefix = px; continue; }
    const key = (prefix << 8) | px;
    if (table.has(key)) {
      prefix = table.get(key);
    } else {
      emit(prefix);
      if (nextCode < 4096) {
        table.set(key, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        emit(clearCode); table.clear(); nextCode = eofCode + 1; codeSize = minCodeSize + 1;
      }
      prefix = px;
    }
  }
  if (prefix !== -1) emit(prefix);
  emit(eofCode);
  if (bits > 0) output.push(buf & 0xFF);
  return Buffer.from(output);
}

function _subBlocks(data) {
  const parts = []; let pos = 0;
  while (pos < data.length) {
    const len = Math.min(255, data.length - pos);
    parts.push(Buffer.from([len]));
    parts.push(data.slice(pos, pos + len));
    pos += len;
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

const _u16 = (n) => Buffer.from([n & 0xFF, (n >> 8) & 0xFF]);
const _GIF_W = 540, _GIF_H = 160;
const _COLORS = [[0,0,0],[65,155,85],[30,80,45],[10,30,18],[210,215,225],[160,165,180],[75,170,250],[255,200,40],[255,130,20],[255,255,255],[120,120,130]];
while (_COLORS.length < 256) _COLORS.push([0,0,0]);

function _buildPalette() {
  const buf = Buffer.alloc(256*3);
  for (let i=0;i<256;i++){buf[i*3]=_COLORS[i][0];buf[i*3+1]=_COLORS[i][1];buf[i*3+2]=_COLORS[i][2];}
  return buf;
}
function _newFrame(){return new Uint8Array(_GIF_W*_GIF_H);}
function _px(frame,x,y,c){if(x>=0&&x<_GIF_W&&y>=0&&y<_GIF_H)frame[y*_GIF_W+x]=c;}
function _fillRect(frame,x0,y0,x1,y1,c){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)_px(frame,x,y,c);}

function _drawRocket(frame,cx,cy){
  for(let dy=0;dy<10;dy++){const hw=Math.round(dy*3/10);const ny=cy-9-10+dy;for(let dx=-hw;dx<=hw;dx++)_px(frame,cx+dx,ny,5);}
  _fillRect(frame,cx-3,cy-9,cx+3,cy+6,4);
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(dx*dx+dy*dy<=9)_px(frame,cx+dx,cy-1+dy,6);
  for(let i=0;i<6;i++)_px(frame,cx-3-i,cy+7-i+4,5);
  for(let i=0;i<6;i++)_px(frame,cx+3+i,cy+7-i+4,5);
  for(let dy=0;dy<9;dy++){const hw=Math.max(0,3-Math.round(dy*3/9));const col=dy<4?7:8;for(let dx=-hw;dx<=hw;dx++)_px(frame,cx+dx,cy+7+dy,col);}
}
function _drawGrid(frame){
  for(const fy of[0.25,0.5,0.75]){const y=Math.round(_GIF_H*fy);for(let x=0;x<_GIF_W;x++)if(!frame[y*_GIF_W+x])frame[y*_GIF_W+x]=3;}
  for(const fx of[0.25,0.5,0.75]){const x=Math.round(_GIF_W*fx);for(let y=0;y<_GIF_H;y++)if(!frame[y*_GIF_W+x])frame[y*_GIF_W+x]=3;}
}
function _drawTrail(frame,cx,cy){
  const trailTop=cy+16;
  for(let dy=0;dy<55;dy++){const ty=trailTop+dy;if(ty<0||ty>=_GIF_H)continue;const fade=1-dy/55;const c=fade>0.55?1:fade>0.2?2:3;_px(frame,cx,ty,c);_px(frame,cx-1,ty,c);if(dy<30)_px(frame,cx+1,ty,c);}
}
const _FONT={N:[0b1111111,0b0100000,0b0010000,0b0001000,0b1111111],O:[0b0111110,0b1000001,0b1000001,0b1000001,0b0111110],M:[0b1111111,0b1000000,0b0111110,0b1000000,0b1111111],I:[0b1000001,0b1000001,0b1111111,0b1000001,0b1000001],A:[0b0111111,0b1001000,0b1001000,0b1001000,0b0111111],L:[0b1111111,0b0000001,0b0000001,0b0000001,0b0000001]};
function _drawText(frame,text,sx,sy,c){let x=sx;for(const ch of text){const cols=_FONT[ch];if(!cols){x+=6;continue;}for(let ci=0;ci<cols.length;ci++)for(let row=0;row<7;row++)if(cols[ci]&(1<<(6-row)))_px(frame,x+ci,sy+row,c);x+=7;}}
const _ROCKETS=[[Math.round(_GIF_W*0.12)+10,0.00],[Math.round(_GIF_W*0.35)+10,0.50],[Math.round(_GIF_W*0.58)+10,0.25],[Math.round(_GIF_W*0.79)+10,0.75]];
const _TOTAL_FRAMES=30;
function _buildGifFrame(f){const frame=_newFrame();_drawGrid(frame);for(const[cx,stagger]of _ROCKETS){const p=((f/_TOTAL_FRAMES)+stagger)%1.0;const cy=Math.round((_GIF_H+60)-p*(_GIF_H+130));_drawTrail(frame,cx,cy);if(cy>-30&&cy<_GIF_H+30)_drawRocket(frame,cx,cy);}  _drawText(frame,'NOMINAL',_GIF_W-58,_GIF_H-12,1);return frame;}
function _generateHireGif(){const palette=_buildPalette();const minCS=8;const delayCs=6;const parts=[];parts.push(Buffer.from('GIF89a'));parts.push(_u16(_GIF_W));parts.push(_u16(_GIF_H));parts.push(Buffer.from([0xF7,0x00,0x00]));parts.push(palette);parts.push(Buffer.from([0x21,0xFF,0x0B,...Buffer.from('NETSCAPE2.0'),0x03,0x01,0x00,0x00,0x00]));for(let f=0;f<_TOTAL_FRAMES;f++){const pixels=_buildGifFrame(f);parts.push(Buffer.from([0x21,0xF9,0x04,0x00,delayCs&0xFF,(delayCs>>8)&0xFF,0x00,0x00]));parts.push(Buffer.from([0x2C]));parts.push(_u16(0));parts.push(_u16(0));parts.push(_u16(_GIF_W));parts.push(_u16(_GIF_H));parts.push(Buffer.from([0x00]));parts.push(Buffer.from([minCS]));parts.push(_subBlocks(_lzwEncode(pixels,minCS)));}parts.push(Buffer.from([0x3B]));return Buffer.concat(parts);}

const HIRE_GIF=_generateHireGif();
console.log('[hire-bot] GIF generated:',Math.round(HIRE_GIF.length/1024),'KB');

const app=express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));

const slack=new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL=process.env.SLACK_CHANNEL||'#new-hires';
const WEBHOOK_SECRET=process.env.WEBHOOK_SECRET;
const GEM_API_KEY=process.env.GEM_API_KEY;
const GEM_API_BASE='https://api.gem.com/ats/v0';
const POLL_INTERVAL_MS=10*60*1000;

const announcedAppIds=new Set();
let lastCheckedAt=new Date();

async function gemFetch(path){const res=await fetch(`${GEM_API_BASE}${path}`,{headers:{'X-API-Key':GEM_API_KEY,'Content-Type':'application/json'}});if(!res.ok){const body=await res.text();throw new Error(`Gem API ${res.status} on ${path}: ${body}`);}return res.json();}

async function pollGemForHires(){
  if(!GEM_API_KEY)return{skipped:true};
  const after=lastCheckedAt.toISOString();const newLastChecked=new Date();
  const apps=await gemFetch(`/applications?status=hired&last_activity_after=${encodeURIComponent(after)}&per_page=100`);
  let announced=0;
  for(const app of apps){
    if(announcedAppIds.has(app.id))continue;
    let candidateName='Unknown Candidate';
    try{const candidate=await gemFetch(`/candidates/${app.candidate_id}`);candidateName=candidate.name||[candidate.first_name,candidate.last_name].filter(Boolean).join(' ')||candidateName;}catch(_){}
    const job=(app.jobs||[])[0]||{};
    const role=job.name||job.title||'Unknown Role';
    const location=job.location||job.office||'TBD';
    const rec=app.recruiter||app.coordinator||{};
    const recruiterName=rec.name||rec.email||'Unknown Recruiter';
    try{
      await slack.chat.postMessage({channel:CHANNEL,text:`:rocket: New hire alert! Welcome ${candidateName} as ${role}!`,blocks:buildHireBlocks({candidateName,role,location,recruiter:recruiterName})});
      announcedAppIds.add(app.id);announced++;
      console.log(`[hire-bot] Announced ${candidateName} (${role}) via Gem poll`);
    }catch(err){console.error(`[hire-bot] Slack error for ${candidateName}:`,err.message);}
  }
  lastCheckedAt=newLastChecked;
  console.log(`[hire-bot] Gem poll complete — ${announced} new hire(s) announced.`);
  return{announced,total:apps.length};
}

function buildHireBlocks({candidateName,role,location,recruiter}){
  return[
    {type:'image',image_url:'https://hire-bot-032u.onrender.com/hire-gif',alt_text:'Nominal rockets launching'},
    {type:'section',text:{type:'mrkdwn',text:':rocket: *We have a new hire!*'}},
    {type:'section',text:{type:'mrkdwn',text:`Please join us in welcoming *${candidateName}* to the team! :wave:`}},
    {type:'section',fields:[{type:'mrkdwn',text:`*NAME*\n${candidateName}`},{type:'mrkdwn',text:`*ROLE*\n${role}`},{type:'mrkdwn',text:`*LOCATION*\n${location}`},{type:'mrkdwn',text:`*RECRUITER*\n${recruiter}`}]},
    {type:'divider'}
  ];
}

app.post('/new-hire',async(req,res)=>{
  const incomingSecret=req.headers['x-webhook-secret']||req.body.secret;
  if(WEBHOOK_SECRET&&incomingSecret!==WEBHOOK_SECRET)return res.status(401).json({error:'Invalid or missing secret.'});
  const{candidateName,role,location,recruiter,channel:channelOverride}=req.body;
  if(!candidateName||!role)return res.status(400).json({error:'candidateName and role are required.'});
  try{
    await slack.chat.postMessage({channel:channelOverride||CHANNEL,text:`:rocket: New hire alert! Welcome ${candidateName} as ${role}!`,blocks:buildHireBlocks({candidateName,role,location:location||'TBD',recruiter:recruiter||'Unknown'})});
    console.log(`[hire-bot] Announced ${candidateName} (${role}) via /new-hire`);
    res.json({ok:true,message:`Announcement posted to ${channelOverride||CHANNEL}!`});
  }catch(err){console.error('[hire-bot] Slack error:',err.message);res.status(500).json({error:err.message});}
});

app.post('/slash-hired',async(req,res)=>{
  const incomingSecret=req.headers['x-webhook-secret']||req.query.secret;
  if(WEBHOOK_SECRET&&incomingSecret!==WEBHOOK_SECRET)return res.status(401).json({error:'Invalid or missing secret.'});
  const text=(req.body.text||'').trim();
  const parts=text.split(',').map(s=>s.trim());
  const candidateName=parts[0]||'Unknown Candidate';
  const role=parts[1]||'Unknown Role';
  const location=parts[2]||'TBD';
  const recruiter=parts[3]||'Unknown Recruiter';
  try{
    await slack.chat.postMessage({channel:CHANNEL,text:`:rocket: New hire alert! Welcome ${candidateName} as ${role}!`,blocks:buildHireBlocks({candidateName,role,location,recruiter})});
    console.log(`[hire-bot] Announced ${candidateName} (${role}) via /slash-hired`);
    res.json({response_type:'in_channel',text:`Announced ${candidateName} in ${CHANNEL}!`});
  }catch(err){console.error('[hire-bot] Slack error:',err.message);res.status(500).json({error:err.message});}
});

app.post('/gem-webhook',async(req,res)=>{
  const incomingSecret=req.headers['x-webhook-secret']||req.query.secret;
  if(WEBHOOK_SECRET&&incomingSecret!==WEBHOOK_SECRET)return res.status(401).json({error:'Invalid or missing secret.'});
  const{event,candidate,job,stage,recruiter}=req.body;
  const stageName=stage?.name||'';
  if(!stageName.toLowerCase().includes('hired'))return res.json({ok:true,message:`Stage "${stageName}" ignored — not a hire event.`});
  const candidateName=candidate?.name||[candidate?.first_name,candidate?.last_name].filter(Boolean).join(' ')||'Unknown Candidate';
  const role=job?.name||'Unknown Role';
  const location=job?.office||job?.location||'TBD';
  const recruiterName=recruiter?.name||recruiter?.email||'Unknown Recruiter';
  try{
    await slack.chat.postMessage({channel:CHANNEL,text:`:rocket: New hire alert! Welcome ${candidateName} as ${role}!`,blocks:buildHireBlocks({candidateName,role,location,recruiter:recruiterName})});
    console.log(`[hire-bot] Announced ${candidateName} (${role}) via Gem webhook`);
    res.json({ok:true,message:`Announcement posted to ${CHANNEL}!`});
  }catch(err){console.error('[hire-bot] Slack error:',err.message);res.status(500).json({error:err.message});}
});

app.get('/poll-gem',async(req,res)=>{
  const incomingSecret=req.headers['x-webhook-secret']||req.query.secret;
  if(WEBHOOK_SECRET&&incomingSecret!==WEBHOOK_SECRET)return res.status(401).json({error:'Invalid or missing secret.'});
  try{const result=await pollGemForHires();res.json({ok:true,...result});}catch(err){res.status(500).json({error:err.message});}
});

app.post('/test',async(req,res)=>{
  const{candidateName='Rory Milne',role='Account Executive',location='UK',recruiter='Alex'}=req.body;
  try{
    await slack.chat.postMessage({channel:'#x-test',text:`:rocket: New hire alert! Welcome ${candidateName} as ${role}!`,blocks:buildHireBlocks({candidateName,role,location,recruiter})});
    res.json({ok:true,message:'Test posted to #x-test'});
  }catch(err){res.status(500).json({error:err.message});}
});

app.get('/hire-gif',(_req,res)=>{
  res.setHeader('Content-Type','image/gif');
  res.setHeader('Cache-Control','public, max-age=86400');
  res.send(HIRE_GIF);
});

app.get('/',(_req,res)=>res.json({status:'ok',service:'hire-bot',channel:CHANNEL}));

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
  console.log(`[hire-bot] Running on port ${PORT}`);
  console.log(`[hire-bot] Announcing to: ${CHANNEL}`);
  if(GEM_API_KEY){setInterval(pollGemForHires,POLL_INTERVAL_MS);console.log(`[hire-bot] Gem ATS polling enabled (every ${POLL_INTERVAL_MS/60000} min)`);}
  else console.log('[hire-bot] GEM_API_KEY not set — Gem polling disabled');
});
