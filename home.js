'use strict';
const REPO='panicsell/auto-web-home',REF='routing',AAD=new TextEncoder().encode('leaderflow-auto-home-v1');
const $=id=>document.getElementById(id);
let route=null,busy=false,lastCheck=0,key=null;
function bytes(s){return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}
function offline(title,description){route=null;$('title').textContent=title;$('description').textContent=description;$('dot').className='';$('open').className='primary disabled';$('open').removeAttribute('href');$('open').setAttribute('aria-disabled','true');}
async function readEnvelope(api){
 const nonce=Date.now().toString(36);
 const url=api?`https://api.github.com/repos/${REPO}/contents/route.json?ref=${REF}&t=${nonce}`:`https://raw.githubusercontent.com/${REPO}/${REF}/route.json?t=${nonce}`;
 const response=await fetch(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('연결 정보 조회 대기');
 const data=await response.json();
 return api?JSON.parse(new TextDecoder().decode(bytes(data.content.replaceAll('\n','')))):data;
}
async function refresh(api=true){
 if(busy||!key)return;busy=true;$('refresh').disabled=true;
 try{
  let envelope;
  try{envelope=await readEnvelope(api);}catch(e){if(!api)throw e;envelope=await readEnvelope(false);}
  if(envelope.version!==1)throw Error('접속 정보 버전 오류');
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:AAD},key,bytes(envelope.ciphertext));
  const value=JSON.parse(new TextDecoder().decode(raw));
  if(value.state!=='active'){offline('실행 중인 오토 대기','오토에서 계좌 연결과 관리권 대조가 끝나면 여기에 표시됩니다.');return;}
  const now=Math.floor(Date.now()/1000);
  if(value.version!==1||!Number.isInteger(value.revision)||value.revision<0||!Number.isFinite(value.issued)||!Number.isFinite(value.expires)||value.expires-value.issued>120||value.issued>now+30||value.expires<=now){offline('연결 정보 갱신 대기','이전 PC로 연결하지 않습니다. 새 오토 실행·인계 완료 후 다시 확인하세요.');return;}
  const target=new URL(value.origin);
  if(target.protocol!=='https:'||!target.hostname.endsWith('.ts.net')||target.username||target.password||target.port||target.pathname!=='/'||target.search||target.hash||!/^[a-f0-9]{64}$/.test(value.ticket))throw Error('개인 VPN 주소 검증 실패');
  route=value;$('title').textContent='연결 준비 완료';$('description').textContent='현재 계좌 관리 PC · '+value.name;$('dot').className='active';
  $('open').href=value.origin+'/entry?owner='+value.ticket+'&revision='+value.revision;
  $('open').className='primary';$('open').setAttribute('aria-disabled','false');
  $('detail').textContent='계좌 관리권 확인 · '+new Date(value.issued*1000).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'});
 }catch(e){offline('연결 정보를 확인할 수 없습니다','개인 고정 주소가 맞는지 확인하고 잠시 후 다시 시도하세요.');$('detail').textContent='접속 정보를 임의의 PC로 대체하지 않습니다.';}
 finally{busy=false;lastCheck=Date.now();$('refresh').disabled=false;}
}
$('refresh').onclick=()=>{if(Date.now()-lastCheck>3000)refresh(true);};
$('open').onclick=e=>{if(!route||route.expires<=Date.now()/1000){e.preventDefault();offline('연결 정보 갱신 대기','다시 확인을 눌러 현재 PC를 확인하세요.');refresh(true);}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastCheck>15000)refresh(false);});
setInterval(()=>{if(route&&route.expires<=Date.now()/1000)offline('연결 정보 갱신 대기','현재 관리 PC를 다시 확인하고 있습니다.');if(!document.hidden&&Date.now()-lastCheck>30000)refresh(false);},1000);
(async()=>{
 try{
  const text=new URLSearchParams(location.hash.slice(1)).get('k')||'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(text))throw Error('missing key');
  key=await crypto.subtle.importKey('raw',bytes(text),'AES-GCM',false,['decrypt']);await refresh(true);
 }catch{offline('개인 고정 주소로 열어주세요','오토의 “고정 접속 → 휴대폰 고정 주소 복사”에서 받은 주소를 즐겨찾기에 저장하세요.');$('refresh').disabled=true;}
})();
