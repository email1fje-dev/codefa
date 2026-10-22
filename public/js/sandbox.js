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
  async function loadPython() {
    if(pyodidePromise)return pyodidePromise;
    pyodidePromise=(async()=>{
      tell('progress',{message:'در حال آماده‌سازی Python...'});
      status.textContent='در حال آماده‌سازی Python...';
      window.fetch = originalFetch;
      const mod=await import('/vendor/pyodide/pyodide.mjs');
      const py=await mod.loadPyodide({indexURL:'/vendor/pyodide/'});
      blockNetwork();
      py.setStdout({batched:s=>{output+=String(s)+'\n';output=bounded(output)}});
      py.setStderr({batched:s=>{output+='[خطا] '+String(s)+'\n';output=bounded(output)}});
      tell('progress',{message:'Python آماده است.'});
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
    const line=Number((raw.match(/<anonymous>:(\d+):(\d+)/)||raw.match(/line (\d+)/i)||[])[1]||0);
    return {raw,explanation:errorFa[type]||'کد را از نظر پرانتزها، نام متغیرها و نوع داده‌ها بررسی کن.',line};
  }
  async function runPython(msg) {
    const py=await loadPython();
    output='';
    const inputs=String(msg.stdin||'').replace(/\r/g,'').split('\n'); let inputIndex=0;
    py.globals.set('__codefa_input_json',JSON.stringify(inputs));
    const prelude=`import builtins, json
__codefa_inputs = json.loads(__codefa_input_json)
__codefa_input_index = 0
def __codefa_input(prompt=''):
    global __codefa_input_index
    if prompt:
        print(prompt, end='')
    if __codefa_input_index >= len(__codefa_inputs) or (__codefa_input_index == len(__codefa_inputs)-1 and __codefa_inputs[-1] == ''):
        raise EOFError('برای input() در کادر ورودی مقدار بنویس.')
    value = __codefa_inputs[__codefa_input_index]
    __codefa_input_index += 1
    return value
builtins.input = __codefa_input
`;
    if(msg.trace) {
      const tracePrelude=`import sys
__codefa_steps=[]
def __codefa_trace(frame,event,arg):
    if event=='line' and frame.f_code.co_filename=='<exec>':
        loc={}
        for k,v in list(frame.f_locals.items())[:20]:
            try: val=repr(v)
            except: val='<unavailable>'
            loc[str(k)]=str(val)[:80]
        __codefa_steps.append({'line':frame.f_lineno,'vars':loc})
        if len(__codefa_steps)>=300:
            raise RuntimeError('به سقف ۳۰۰ قدم رسیدیم؛ اجرای قدم‌به‌قدم متوقف شد.')
    return __codefa_trace
sys.settrace(__codefa_trace)
try:
    exec(compile(__codefa_user_code, '<exec>', 'exec'), {'__name__':'__main__'})
finally:
    sys.settrace(None)
`;
      py.globals.set('__codefa_user_code',String(msg.code||''));
      try { await py.runPythonAsync(prelude+tracePrelude); const steps=py.globals.get('__codefa_steps'); const jsSteps=steps?steps.toJs({dict_converter:Object.fromEntries}):[]; tell('result',{ok:true,output:bounded(output),steps:Array.from(jsSteps).slice(0,300)}); }
      catch(e){tell('result',{ok:false,output:bounded(output),error:pythonError(e)});}
      return;
    }
    try { await py.runPythonAsync(prelude+String(msg.code||'')); tell('result',{ok:true,output:bounded(output)}); }
    catch(e){tell('result',{ok:false,output:bounded(output),error:pythonError(e)});}
  }
  function runJavaScript(msg) {
    output='';
    const logs=[];
    const fakeConsole={log:(...a)=>logs.push(a.map(String).join(' ')),info:(...a)=>logs.push('[اطلاعات] '+a.map(String).join(' ')),warn:(...a)=>logs.push('[هشدار] '+a.map(String).join(' ')),error:(...a)=>logs.push('[خطا] '+a.map(String).join(' ')),clear:()=>{logs.length=0}};
    try {
      const start=performance.now();
      const fn=new Function('console', '"use strict";\n'+String(msg.code||''));
      fn(fakeConsole);
      tell('result',{ok:true,output:bounded(logs.join('\n')||'اجرا شد؛ خروجی‌ای چاپ نشد.'),runtime:Math.round(performance.now()-start)});
    } catch(e){tell('result',{ok:false,output:bounded(logs.join('\n')),error:jsError(e)});}
  }
  function runWeb(msg) {
    try {
      const files=msg.files||{};
      previewEl.innerHTML='';
      const style=document.createElement('style');style.textContent=String(files.css||'');previewEl.appendChild(style);
      const frame=document.createElement('div');frame.className='user-web-content';frame.innerHTML=String(files.html||'<p>کد HTML را بنویس.</p>');previewEl.appendChild(frame);
      const logs=[];const fakeConsole={log:(...a)=>logs.push(a.map(String).join(' ')),info:(...a)=>logs.push('[اطلاعات] '+a.map(String).join(' ')),warn:(...a)=>logs.push('[هشدار] '+a.map(String).join(' ')),error:(...a)=>logs.push('[خطا] '+a.map(String).join(' '))};
      const start=performance.now();
      if(String(files.js||'').trim())new Function('console','root','"use strict";\n'+String(files.js))(fakeConsole,frame);
      tell('result',{ok:true,output:bounded(logs.join('\n')||'پیش‌نمایش وب به‌روزرسانی شد.'),runtime:Math.round(performance.now()-start),preview:true});
    } catch(e){tell('result',{ok:false,output:'',error:jsError(e)});}
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