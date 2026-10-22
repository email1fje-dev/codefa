window.runCode = code => new Promise(resolve => {
  const workerCode = `self.onmessage = ({data}) => {
    const logs = [];
    const originalLog = console.log;
    try {
      console.log = (...values) => logs.push(values.join(' '));
      new Function(data)();
      console.log = originalLog;
      self.postMessage({ok:true, output:logs.join('\\n')});
    } catch (error) {
      self.postMessage({ok:false, output:String(error && error.message || 'خطای اجرا')});
    }
  };`;
  const blob = new Blob([workerCode], {type:'text/javascript'});
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  const timer = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); resolve({ok:false,output:'زمان اجرا بیشتر از ۳ ثانیه شد.'}); }, 3000);
  worker.onmessage = event => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve(event.data); };
  worker.onerror = () => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve({ok:false,output:'اجرای کد ناموفق بود.'}); };
  worker.postMessage(String(code));
});