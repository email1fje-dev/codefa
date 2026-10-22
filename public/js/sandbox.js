(() => {
  const status = document.getElementById('status');
  const outputEl = document.getElementById('output');
  const previewEl = document.getElementById('preview');
  let pyodidePromise = null;
  const originalFetch = window.fetch.bind(window);
  let output = '';
  const MAX_OUTPUT = 100 * 1024;
  const errorFa = {
    SyntaxError:'ساختار دستور درست نیست؛ پرانتز و دونقطه‌ها را بررسی کن.',
    IndentationError:'تورفتگی خط‌ها درست نیست؛ داخل بلوک‌ها از فاصله‌های یکسان استفاده کن.',
    NameError:'این نام تعریف نشده است؛ املای متغیر را بررسی کن.',
    TypeError:'نوع داده برای این عملیات مناسب نیست.',
    ValueError:'مقدار برای این عملیات مناسب نیست.',
    ZeroDivisionError:'تقسیم بر صفر مجاز نیست.',
    IndexError:'شماره خانه خارج از محدوده لیست است.',
    KeyError:'این کلید در دیکشنری وجود ندارد.',
    AttributeError:'این شیء چنین ویژگی یا متدی ندارد.',
    ModuleNotFoundError:'این کتابخانه در این پلی‌گراند موجود نیست؛ فقط کتابخانه استاندارد پشتیبانی می‌شود.',
    RecursionError:'تابع بیش از حد خودش را فراخوانی کرده است.',
    EOFError:'برای input() در کادر ورودی مقدار بنویس.',
    ReferenceError:'نام متغیر یا تابع پیدا نشد.',
    RangeError:'مقدار خارج از محدوده مجاز است.'
  };
  function bounded(s) { s=String(s??''); if(s.length>MAX_OUTPUT)return s.slice(0,MAX_OUTPUT)+'\n\nخروجی خیلی طولانی بود و بریده شد.'; return s; }
  function tell(type, data={}) { parent.postMessage({channel:'codefa-sandbox',type,...data}, '*'); }
  function blockNetwork() {
    const denied = () => Promise.reject(new Error('در محیط ایزوله دسترسی شبکه غیرفعال است.'));
    try { window.fetch = denied; } catch {}
    try { window.XMLHttpRequest = class { constructor(){throw new Error('دسترسی شبکه در محیط ایزوله غیرفعال است.')} }; } catch {}
    try { window.WebSocket = class { constructor(){throw new Error('دسترسی شبکه در محیط ایزوله غیرفعال است.')} }; } catch {}
    try { window.EventSource = class { constructor(){throw new Error('دسترسی شبکه در محیط ایزوله غیرفعال است.')} }; } catch {}
  }
  async function loadPython(msg) {
    if(pyodidePromise)return pyodidePromise;
    pyodidePromise=(async()=>{
      tell('progress',{requestId:msg.requestId,message:'در حال آماده‌سازی Python...'});
      status.textContent='در حال آماده‌سازی Python...';
      window.fetch = originalFetch;
      const mod=await import('/vendor/pyodide/pyodide.mjs');
      const py=await mod.loadPyodide({indexURL:'/vendor/pyodide/'});
      blockNetwork();
      py.setStdout({batched:s=>{output+=String(s)+'\n';output=bounded(output)}});
      py.setStderr({batched:s=>{output+='[خطا] '+String(s)+'\n';output=bounded(output)}});
      tell('progress',{requestId:msg.requestId,message:'Python آماده است.'});
      return py;
    })();
    return pyodidePromise;
  }
  function pythonError(err) {
    const raw=String(err?.message||err||'خطای ناشناخته');
    let type=''; for(const k of Object.keys(errorFa))if(raw.includes(k)){type=k;break}
    const line=Number((raw.match(/line (\d+)/i)||raw.match(/<exec>:(\d+)/)||[])[1]||0);
    return {raw,explanation:errorFa[type]||'کد را خط‌به‌خط بررسی کن و نام‌ها و نوع داده‌ها را دوباره ببین.',line};
  }
  function jsError(err) {
    const raw=String(err?.stack||err?.message||err||'خطای ناشناخته');
    const type=String(err?.name||'Error');
    const line=Math.max(0,Number((raw.match(/<anonymous>:(\d+):(\d+)/)||raw.match(/line (\d+)/i)||[])[1]||0)-2);
    return {raw,explanation:errorFa[type]||'کد را از نظر پرانتزها، نام متغیرها و نوع داده‌ها بررسی کن.',line};
  }
  let pythonWorker=null,pythonBusy=false,pythonWorkerUrl=null,pythonTimer=null;
function runPython(msg){
 if(pythonBusy){tell('result',{requestId:msg.requestId,ok:false,output:'',error:{raw:'Python در حال اجرای یک برنامه دیگر است.',explanation:'صبر کن تا اجرای فعلی تمام شود.',line:0}});return;}
 pythonBusy=true;
 if(!pythonWorker){const blob=new Blob(["import { loadPyodide } from '__CODEFA_PYODIDE_MODULE__';\nlet py = null;\nconst errorFa = {SyntaxError:'ساختار دستور درست نیست؛ پرانتز و دونقطه‌ها را بررسی کن.',IndentationError:'تورفتگی خط‌ها درست نیست؛ داخل بلوک‌ها از فاصله‌های یکسان استفاده کن.',NameError:'این نام تعریف نشده است؛ املای متغیر را بررسی کن.',TypeError:'نوع داده برای این عملیات مناسب نیست.',ValueError:'مقدار واردشده برای این تبدیل یا عملیات مناسب نیست.',ZeroDivisionError:'تقسیم بر صفر مجاز نیست.',IndexError:'شماره خانه خارج از محدوده لیست است.',KeyError:'این کلید در دیکشنری وجود ندارد.',AttributeError:'این شیء چنین ویژگی یا متدی ندارد.',ModuleNotFoundError:'این کتابخانه در این پلی‌گراند موجود نیست؛ فقط کتابخانه استاندارد پشتیبانی می‌شود.',RecursionError:'تابع بیش از حد خودش را فراخوانی کرده است.',EOFError:'برای input() در کادر ورودی مقدار بنویس.'};\nfunction pyError(e){const raw=String(e && e.message || e || 'خطای ناشناخته');let type=Object.keys(errorFa).find(k=>raw.includes(k))||'';const m=raw.match(/line ([0-9]+)/i);return {raw,explanation:errorFa[type]||'کد را خط‌به‌خط بررسی کن و نام‌ها و نوع داده‌ها را دوباره ببین.',line:Number(m&&m[1]||0)};}\nfunction bounded(value){let s=String(value||'');if(s.length>102400)s=s.slice(0,102360)+String.fromCharCode(10)+'خروجی خیلی طولانی بود';return s;}\nself.onmessage = async function(event) {\n const m=event.data||{};\n try {\n  if(!py){\n   self.postMessage({type:'progress',requestId:m.requestId,message:'در حال آماده‌سازی Python...'});\n   py=await loadPyodide({indexURL:m.indexURL});\n   try{self.fetch=()=>Promise.reject(new Error('در محیط ایزوله دسترسی شبکه غیرفعال است.'));self.WebSocket=class{constructor(){throw new Error('دسترسی شبکه غیرفعال است.')}};self.EventSource=class{constructor(){throw new Error('دسترسی شبکه غیرفعال است.')}};}catch{}\n  }\n  self.postMessage({type:'progress',requestId:m.requestId,message:'Python آماده است.'});\n  let output='',truncated=false;\n  const addOutput=(value)=>{if(truncated)return;output+=String(value)+String.fromCharCode(10);if(output.length>102400){output=output.slice(0,102350)+String.fromCharCode(10)+'خروجی خیلی طولانی بود';truncated=true;}};\n  py.setStdout({batched:addOutput});\n  py.setStderr({batched:s=>addOutput('[خطا] '+s)});\n  const inputs=String(m.stdin||'').replaceAll(String.fromCharCode(13),'').split(String.fromCharCode(10));\n  py.globals.set('__codefa_input_json',JSON.stringify(inputs));\n  py.globals.set('__codefa_user_code',String(m.code||''));\n  const prelude=[\n   'import builtins, json',\n   '__codefa_inputs = json.loads(__codefa_input_json)',\n   '__codefa_input_index = 0',\n   'def __codefa_input(prompt=\"\"):',\n   '    global __codefa_input_index',\n   '    if prompt: print(prompt, end=\"\")',\n   '    if __codefa_input_index >= len(__codefa_inputs) or (__codefa_input_index == len(__codefa_inputs)-1 and __codefa_inputs[-1] == \"\"):',\n   '        raise EOFError(\"برای input() در کادر ورودی مقدار بنویس.\")',\n   '    value = __codefa_inputs[__codefa_input_index]',\n   '    __codefa_input_index += 1',\n   '    return value',\n   'builtins.input = __codefa_input'\n  ].join(String.fromCharCode(10));\n  let steps=[];\n  try{\n   if(m.trace){\n    const traceCode=[\n     'import sys, builtins',\n     '__codefa_steps = []',\n     '__codefa_output = []',\n     '__codefa_original_print = builtins.print',\n     'def __codefa_print(*args, **kwargs):',\n     '    __codefa_output.append(\" \".join(str(x) for x in args) + chr(10))',\n     '    __codefa_original_print(*args, **kwargs)',\n     'builtins.print = __codefa_print',\n     'def __codefa_trace(frame, event, arg):',\n     '    if event == \"line\" and frame.f_code.co_filename == \"<user>\":',\n     '        loc = {}',\n     '        for k, v in list(frame.f_locals.items())[:20]:',\n     '            try: value = repr(v)',\n     '            except: value = \"<unavailable>\"',\n     '            loc[str(k)] = str(value)[:80]',\n     '        __codefa_steps.append({\"line\":frame.f_lineno,\"vars\":loc,\"output\":\"\".join(__codefa_output)[:100000]})',\n     '        if len(__codefa_steps) >= 300: raise RuntimeError(\"به سقف ۳۰۰ قدم رسیدیم؛ اجرای قدم‌به‌قدم متوقف شد.\")',\n     '    return __codefa_trace',\n     'sys.settrace(__codefa_trace)',\n     'try:',\n     '    exec(compile(__codefa_user_code, \"<user>\", \"exec\"), {\"__name__\":\"__main__\"})',\n     'finally:',\n     '    sys.settrace(None)'\n    ].join(String.fromCharCode(10));\n    try{await py.runPythonAsync(prelude+String.fromCharCode(10)+traceCode)}catch(e){const proxy=py.globals.get('__codefa_steps');if(proxy){try{steps=Array.from(proxy.toJs({dict_converter:Object.fromEntries}));}catch{}}throw e;}\n    const proxy=py.globals.get('__codefa_steps');if(proxy){try{steps=Array.from(proxy.toJs({dict_converter:Object.fromEntries}));}catch{}}\n   } else {\n    await py.runPythonAsync(prelude+String.fromCharCode(10)+\"exec(compile(__codefa_user_code, '<user>', 'exec'), {'__name__':'__main__'})\");\n   }\n   self.postMessage({type:'result',requestId:m.requestId,ok:true,output:bounded(output),steps});\n  } catch(e) {\n   const err=pyError(e);\n   if(!steps.length){try{const proxy=py.globals.get('__codefa_steps');if(proxy)steps=Array.from(proxy.toJs({dict_converter:Object.fromEntries}));}catch{}}\n   self.postMessage({type:'result',requestId:m.requestId,ok:false,output:bounded(output),error:err,steps});\n  }\n};".replace('__CODEFA_PYODIDE_MODULE__',new URL('/vendor/pyodide/pyodide.mjs',location.href).href)],{type:'text/javascript'});pythonWorkerUrl=URL.createObjectURL(blob);pythonWorker=new Worker(pythonWorkerUrl,{type:'module'});}
 const worker=pythonWorker;const timeout=Math.max(1,Math.min(15,Number(msg.timeoutSeconds)||8));
 const stopForTimeout=()=>{try{worker.terminate()}catch{}if(pythonWorker===worker){pythonWorker=null;pythonBusy=false;if(pythonWorkerUrl)URL.revokeObjectURL(pythonWorkerUrl);pythonWorkerUrl=null;}tell('result',{requestId:msg.requestId,ok:false,output:'',error:{raw:'TimeoutError',explanation:'برنامه بیش از حد طول کشید (احتمالاً حلقه‌ی بی‌نهایت).',line:0}});};
 clearTimeout(pythonTimer);pythonTimer=setTimeout(stopForTimeout,60000);
 worker.onmessage=e=>{const d=e.data||{};if(d.type==='progress'){clearTimeout(pythonTimer);pythonTimer=setTimeout(stopForTimeout,d.message&&d.message.includes('آماده‌سازی')?60000:timeout*1000);tell('progress',{requestId:msg.requestId,message:d.message||'در حال آماده‌سازی Python...'});return;}if(d.type==='result'){clearTimeout(pythonTimer);pythonBusy=false;tell('result',d);}};
 worker.onerror=e=>{clearTimeout(pythonTimer);pythonBusy=false;try{worker.terminate()}catch{}pythonWorker=null;if(pythonWorkerUrl)URL.revokeObjectURL(pythonWorkerUrl);pythonWorkerUrl=null;tell('result',{requestId:msg.requestId,ok:false,output:'',error:{raw:String(e.message||'Worker error'),explanation:'محیط Python با خطا روبه‌رو شد؛ دوباره تلاش کن.',line:0}});};
 worker.postMessage({...msg,timeoutSeconds:timeout,indexURL:new URL('/vendor/pyodide/',location.href).href});
}
function runJavaScript(msg){
 const timeout=Math.max(1,Math.min(15,Number(msg.timeoutSeconds)||3));
 const blob=new Blob(["self.onmessage=function(event){\n const m=event.data||{},logs=[];\n const errorFa={ReferenceError:'نام متغیر یا تابع پیدا نشد.',TypeError:'این عملیات روی این نوع داده ممکن نیست.',SyntaxError:'ساختار کد جاوااسکریپت درست نیست.',RangeError:'مقدار خارج از محدوده مجاز است.'};\n const bounded=s=>{s=String(s||'');return s.length>102400?s.slice(0,102350)+String.fromCharCode(10)+'خروجی خیلی طولانی بود':s};\n const fakeConsole={log:(...a)=>logs.push(a.map(String).join(' ')),info:(...a)=>logs.push('[اطلاعات] '+a.map(String).join(' ')),warn:(...a)=>logs.push('[هشدار] '+a.map(String).join(' ')),error:(...a)=>logs.push('[خطا] '+a.map(String).join(' ')),clear:()=>{logs.length=0}};\n try{\n  self.fetch=()=>Promise.reject(new Error('در محیط ایزوله دسترسی شبکه غیرفعال است.'));\n  self.WebSocket=class{constructor(){throw new Error('دسترسی شبکه غیرفعال است.')}};\n  const start=Date.now();new Function('console','\"use strict\";'+String.fromCharCode(10)+String(m.code||''))(fakeConsole);\n  self.postMessage({type:'result',requestId:m.requestId,ok:true,output:bounded(logs.join(String.fromCharCode(10))||'اجرا شد؛ خروجی‌ای چاپ نشد.'),runtime:Date.now()-start});\n }catch(e){const raw=String(e&&e.stack||e&&e.message||e),type=String(e&&e.name||'Error'),lineMatch=raw.match(/<anonymous>:([0-9]+):([0-9]+)/);self.postMessage({type:'result',requestId:m.requestId,ok:false,output:bounded(logs.join(String.fromCharCode(10))),error:{raw,explanation:errorFa[type]||'کد را از نظر پرانتزها، نام متغیرها و نوع داده‌ها بررسی کن.',line:Math.max(0,Number(lineMatch&&lineMatch[1]||0)-2)}});}\n};"],{type:'text/javascript'});const url=URL.createObjectURL(blob);const worker=new Worker(url);
 let finished=false;const timer=setTimeout(()=>{if(finished)return;finished=true;worker.terminate();URL.revokeObjectURL(url);tell('result',{requestId:msg.requestId,ok:false,output:'',error:{raw:'TimeoutError',explanation:'برنامه بیش از حد طول کشید (احتمالاً حلقه‌ی بی‌نهایت).',line:0}});},timeout*1000);
 worker.onmessage=e=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);tell('result',e.data||{requestId:msg.requestId,ok:false,output:'',error:{raw:'خطای اجرا',explanation:'کد را بررسی کن.',line:0}});};
 worker.onerror=e=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);tell('result',{requestId:msg.requestId,ok:false,output:'',error:{raw:String(e.message||'Worker error'),explanation:'اجرای کد جاوااسکریپت ناموفق بود.',line:0}});};
 worker.postMessage({...msg,code:String(msg.code||''),timeoutSeconds:timeout});
}
function runWeb(msg) {
    try {
      const files=msg.files||{};
      previewEl.innerHTML='';
      const style=document.createElement('style');style.textContent=String(files.css||'');previewEl.appendChild(style);
      const frame=document.createElement('div');frame.className='user-web-content';const parsed=new DOMParser().parseFromString(String(files.html||'<p>کد HTML را بنویس.</p>'),'text/html');frame.innerHTML=parsed.body.innerHTML;previewEl.appendChild(frame);
      const logs=[];let logSize=0,logsCut=false;const pushLog=s=>{if(logsCut)return;const v=String(s),room=102300-logSize;if(v.length>room){logs.push(v.slice(0,Math.max(0,room)));logs.push('خروجی خیلی طولانی بود');logSize=102400;logsCut=true;return;}logs.push(v);logSize+=v.length;};const fakeConsole={log:(...a)=>pushLog(a.map(String).join(' ')),info:(...a)=>pushLog('[اطلاعات] '+a.map(String).join(' ')),warn:(...a)=>pushLog('[هشدار] '+a.map(String).join(' ')),error:(...a)=>pushLog('[خطا] '+a.map(String).join(' '))};
      const start=performance.now();const deadline=Date.now()+3000;let webCode=String(files.js||'').replace(/while\s*\(([\s\S]*?)\)\s*\{/g,function(_,condition){return 'while('+condition+'){if(Date.now()>__codefaDeadline)throw new Error("برنامه بیش از حد طول کشید (احتمالاً حلقه‌ی بی‌نهایت).");'}).replace(/for\s*\(([\s\S]*?)\)\s*\{/g,function(_,condition){return 'for('+condition+'){if(Date.now()>__codefaDeadline)throw new Error("برنامه بیش از حد طول کشید (احتمالاً حلقه‌ی بی‌نهایت).");'}).replace(/do\s*\{/g,'do{if(Date.now()>__codefaDeadline)throw new Error("برنامه بیش از حد طول کشید (احتمالاً حلقه‌ی بی‌نهایت).");');if(webCode.trim())new Function('console','root','__codefaDeadline','setTimeout','setInterval','requestAnimationFrame','"use strict";'+String.fromCharCode(10)+webCode)(fakeConsole,frame,deadline,()=>{throw new Error('تایمرها در پیش‌نمایش ایزوله غیرفعال‌اند.')},()=>{throw new Error('تایمرها در پیش‌نمایش ایزوله غیرفعال‌اند.')},()=>{throw new Error('تایمرها در پیش‌نمایش ایزوله غیرفعال‌اند.')});
      const checkResults=(msg.checks||[]).slice(0,50).map(check=>{try{const nodes=Array.from(frame.querySelectorAll(String(check.selector||'*')));let pass=check.exists===false?nodes.length===0:nodes.length>=(Number(check.count_min)||(check.exists===true?1:0));if(check.text_contains!=null)pass=pass&&nodes.some(n=>n.textContent.includes(String(check.text_contains)));if(check.attribute&&nodes[0])pass=pass&&nodes[0].getAttribute(String(check.attribute.name))===String(check.attribute.value);if(check.style&&nodes[0])for(const [prop,val] of Object.entries(check.style))pass=pass&&getComputedStyle(nodes[0]).getPropertyValue(prop).trim()===String(val);return {selector:String(check.selector||''),pass};}catch{return {selector:String(check.selector||''),pass:false}}}); tell('result',{requestId:msg.requestId,ok:true,output:bounded(logs.join('\\n')||'پیش‌نمایش وب به‌روزرسانی شد.'),runtime:Math.round(performance.now()-start),preview:true,checks:checkResults});
    } catch(e){tell('result',{requestId:msg.requestId,ok:false,output:'',error:jsError(e)});}
  }
  window.addEventListener('message', async event=>{
    if(event.source!==parent || event.origin==='null')return;
    const m=event.data;
    if(!m||m.channel!=='codefa-parent'||m.type!=='run'||!['python','javascript','web'].includes(m.language))return;
    if(typeof m.code!=='string'&&m.language!=='web')return;
    if(m.language==='python')await runPython(m);
    else if(m.language==='javascript')runJavaScript(m);
    else runWeb(m);
  });
  blockNetwork();
  status.textContent='محیط ایزوله آماده است؛ اجرای کد فقط با درخواست کاربر انجام می‌شود.';
  tell('ready',{message:'محیط ایزوله آماده است.'});
})();