(function(){
  const noop=()=>{}; const store={};
  const area=()=>({
    get:(k,cb)=>{const r={};const keys=k==null?Object.keys(store):(Array.isArray(k)?k:(typeof k==='string'?[k]:Object.keys(k)));
      for(const key of keys) if(key in store) r[key]=store[key];
      if(cb)cb(r); return Promise.resolve(r);},
    set:(o,cb)=>{Object.assign(store,o); if(cb)cb(); return Promise.resolve();},
    remove:(k,cb)=>{(Array.isArray(k)?k:[k]).forEach(x=>delete store[x]); if(cb)cb(); return Promise.resolve();},
    clear:(cb)=>{for(const k of Object.keys(store))delete store[k]; if(cb)cb(); return Promise.resolve();},
    onChanged:{addListener:noop,removeListener:noop},
  });
  window.chrome={
    runtime:{id:'stub',getURL:p=>p,sendMessage:(m,cb)=>{if(cb)cb({ok:true});return Promise.resolve({ok:true});},
      onMessage:{addListener:f=>(window.__msgL=window.__msgL||[]).push(f),removeListener:noop},
      onConnect:{addListener:noop},connect:()=>({postMessage:noop,onMessage:{addListener:noop},onDisconnect:{addListener:noop},disconnect:noop}),
      lastError:null,getManifest:()=>({version:'36.5.0'})},
    storage:{local:area(),sync:area(),session:area(),onChanged:{addListener:noop,removeListener:noop}},
    tabs:{query:(q,cb)=>{const r=[{id:1,url:'https://example.com',title:'Example',active:true}];if(cb)cb(r);return Promise.resolve(r);},
      sendMessage:(i,m,cb)=>{if(cb)cb();return Promise.resolve();},onUpdated:{addListener:noop},onActivated:{addListener:noop},
      onRemoved:{addListener:noop},create:noop,update:noop,
      get:(id,cb)=>{const t={id,url:'https://example.com',title:'Example'};if(cb)cb(t);return Promise.resolve(t);}},
    windows:{getCurrent:cb=>{const w={id:1};if(cb)cb(w);return Promise.resolve(w);},onFocusChanged:{addListener:noop},create:noop,WINDOW_ID_NONE:-1},
    sidePanel:{setOptions:()=>Promise.resolve(),setPanelBehavior:()=>Promise.resolve()},
    permissions:{contains:(p,cb)=>{if(cb)cb(true);return Promise.resolve(true);},request:(p,cb)=>{if(cb)cb(true);return Promise.resolve(true);},
      onAdded:{addListener:noop},onRemoved:{addListener:noop}},
    i18n:{getUILanguage:()=>'en',getMessage:()=>''},
    commands:{onCommand:{addListener:noop},getAll:cb=>{if(cb)cb([]);return Promise.resolve([]);}},
    contextMenus:{onClicked:{addListener:noop}},action:{onClicked:{addListener:noop}},
    scripting:{executeScript:()=>Promise.resolve([])},downloads:{onChanged:{addListener:noop}},
    alarms:{onAlarm:{addListener:noop},create:noop,clear:noop},
  };
  window.browser=window.chrome;
  window.__panelErrors=[];
  window.addEventListener('error',e=>window.__panelErrors.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
  window.addEventListener('unhandledrejection',e=>window.__panelErrors.push('promise: '+(e.reason&&e.reason.message||e.reason)));
})();
