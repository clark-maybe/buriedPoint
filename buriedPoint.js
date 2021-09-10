//buriedPoint
// version - 0.0.1

// 初始化 - buriedPoint.init 接收 obj 进行参数配置
// 默认模式 - 启动所有监控，日志将缓存至本地
// 配置模式 - 依据配置进行设置
// 终端标识 - id 用来标记当前由谁发起 会携带在报文中
// 上报方式 - 默认采取 空闲模式 进行上报，即业务系统无请求时，日志上报才会进行
// 上报时间间隔 - reportTimeInterval 单位 秒 默认 5秒
// 错误消息每隔 2.5 秒 聚合一次，降低请求频次，上报失败后，错误日志将落地在本地缓存
// 上报接口路径 - path 跨域问题需自行解决，默认 POST JSON 方式上报
// 监控类型：【js执行错误，点击日志，请求日志，请求错误日志，终端信息，资源加载时间，资源加载失败日志】

//禁止直接访问实际实现方法，统一通过暴露方法调用

var buriedPoint = (function(){


  function init(params){

    if(JSON.stringify(infoStorage.config_info) !== '{}'){
      return new Error('buriedPoint 已初始化，无法进行重复配置');
    }

    if(params && Object.prototype.toString.call(params) === '[object Object]'){
        //配置模式启动
        params.pattern = 'config';
        infoStorage.save('config_info', params);
        capture.start_all();
        request.init_all();
        infoQueue.loop();//开启上报
    }else{
        //默认模式启动
        infoStorage.save('config_info', { pattern: 'default' });
        capture.start_all();
        request.init_all();
        infoQueue.loop();//开启上报
    }

  }


  function capture_execution_error(){
      window.onerror = function(message, source, lineno, colno, error){
        var info = { timeStep: new Date(), type: message, source: source, lineno: lineno, colno: colno, error: error }
        infoStorage.save('error_info', info);
      }
  }

  function capture_request_exception(){

  }

  function capture_start_all(params){
    for(var key in capture){
      if(key === 'start_all'){ continue; }
      capture[key](params);
    }
  }

  function capture_terminal_info(){
    var info = {
      resolving_power: screen.width + "*" + screen.height,
      operating_system: detectOS(),
      is_mobile_terminal: /(iPhone|iPad|iPod|iOS|Android)/i.test(navigator.userAgent),
      browser_core: judgeCore()
    }
    infoStorage.save('terminal_info', info);

    function detectOS() {
      var sUserAgent = navigator.userAgent;
      var isWin = (navigator.platform == "Win32") || (navigator.platform == "Windows");
      var isMac = (navigator.platform == "Mac68K") || (navigator.platform == "MacPPC") || (navigator.platform == "Macintosh") || (navigator.platform == "MacIntel");
      if (isMac) return "Mac";
      var iPhone = sUserAgent.indexOf("iPhone") > -1 || sUserAgent.indexOf("iPhone") > -1;
      if (iPhone) return "iPhone";
      var isUnix = (navigator.platform == "X11") && !isWin && !isMac;
      if (isUnix) return "Unix";
      var isLinux = (String(navigator.platform).indexOf("Linux") > -1);
      var bIsAndroid = sUserAgent.toLowerCase().match(/android/i) == "android";
      if (isLinux) {
        if(bIsAndroid) return "Android";
        else return "Linux";
      }
      if (isWin) {
        var isWin2K = sUserAgent.indexOf("Windows NT 5.0") > -1 || sUserAgent.indexOf("Windows 2000") > -1;
        if (isWin2K) return "Win2000";
        var isWinXP = sUserAgent.indexOf("Windows NT 5.1") > -1 ||
          sUserAgent.indexOf("Windows XP") > -1;
        if (isWinXP) return "WinXP";
        var isWin2003 = sUserAgent.indexOf("Windows NT 5.2") > -1 || sUserAgent.indexOf("Windows 2003") > -1;
        if (isWin2003) return "Win2003";
        var isWinVista= sUserAgent.indexOf("Windows NT 6.0") > -1 || sUserAgent.indexOf("Windows Vista") > -1;
        if (isWinVista) return "WinVista";
        var isWin7 = sUserAgent.indexOf("Windows NT 6.1") > -1 || sUserAgent.indexOf("Windows 7") > -1;
        if (isWin7) return "Win7";
        var isWin8 = sUserAgent.indexOf("Windows NT 6.2") > -1 || sUserAgent.indexOf("Windows 8") > -1;
        if (isWin8) return "Win8";
        var isWin81 = sUserAgent.indexOf("Windows NT 6.3") > -1 || sUserAgent.indexOf("Windows 8.1") > -1;
        if (isWin81) return "Win8.1";
        var isWin10 = sUserAgent.indexOf("Windows NT 10.0") > -1 || sUserAgent.indexOf("Windows 10") > -1;
        if (isWin10) return "Win10";
      }
      return "other";
    }

    function judgeCore(){
      var ua = navigator.userAgent;
      if(ua.indexOf('Trident') > -1) return 'IE';
      if(ua.indexOf('Presto') > -1) return 'Opera';
      if(ua.indexOf('AppleWebKit') > -1) return 'WebKit';
      if(ua.indexOf('Gecko') > -1 && ua.indexOf('KHTML') == -1) return 'Firfox';
      if(ua.indexOf('MicroMessenger') > -1) return 'weixin';
      if(ua.match(/\sQQ/i) == " qq") return 'qq';
      return 'other';
    }
  }

  function capture_loading_often(){

  }

  function capture_click_info(){
      var body = document.body;
      body.onclick = function(e){
        console.log(e);
      }
  }

  function queue_push(info){

    //是否携带 端 信息 - 默认携带
    info = Object.assign(info, infoStorage.terminal_info);

    //将终端标识塞入报文中
    infoStorage.config_info.id && (info.id = infoStorage.config_info.id);

    infoQueue.queue.push(info);
  }

  function queue_loop(){
    //消息发送器
    queue_loop.t = setInterval(function(){
        request.fetch();
      }, infoStorage.config_info.reportTimeInterval ? infoStorage.config_info.reportTimeInterval * 1000 : 5000);

    //消息收集器
    queue_loop.t1 = setInterval(function(){

      var size = infoStorage.error_info.length;
      var param = {
        list: utils.deepCopy(infoStorage.error_info)
      }

      //todo 这里暂时清除，后续需要落到本地缓存
      infoStorage.error_info = [];

      size && infoQueue.push(param);
    }, 2400);
  }

  function utils_deep_copy(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function queue_shutdown(){
    clearInterval(queue_loop.t);
    clearInterval(queue_loop.t1);
    queue_loop.t = null;
    queue_loop.t1 = null;
  }

  function infoStorage_push(type, info){
    if(type === 'terminal_info' || type === 'loading_info' || type === 'config_info'){
      infoStorage[type] = Object.assign(infoStorage[type], info);
    }else{
      infoStorage[type].push(info);
    }
  }

  function request_cover_fetch(params){
      var oldFetch = window.fetch;
      var newFetch = function(url, options, isBuriedPoint){

        var info = {
          url: url,
          timeStep: new Date(),
          options: options
        }
        !isBuriedPoint && (infoQueue.isWait = false);
        !isBuriedPoint && infoStorage.save('request_info', info);

        return oldFetch(url, options);
      }

      window.fetch = newFetch;
  }

  function request_fetch(){
    var param = infoQueue.queue.shift();
    if(!infoQueue.isWait){ return void 0; }
    if(!infoStorage.config_info.pattern === 'default'){ return void 0; }
    if(!infoStorage.config_info.path){ return console.error('尚未配置上报地址'); }
    if(!param){ return void 0; }

    fetch(infoStorage.config_info.path, {
      method: 'POST',
      body: JSON.stringify(param)
    }, true)
  }

  function request_init_all(params){
    for(var key in request){
      if(key === 'init_all' || key === 'fetch'){ continue; }
      request[key](params);
    }
  }


  //请求模块
  var request = {
    cover_fetch: request_cover_fetch,//复写 fetch 实现

    fetch: request_fetch,//内部 fetch 请求
    init_all: request_init_all//初始化所有请求模块
  }

  //捕获模块
  var capture = {

    execution_error: capture_execution_error,//执行错误
    request_exception: capture_request_exception,//请求异常
    loading_often: capture_loading_often,//加载时常
    terminal_info: capture_terminal_info,//终端信息获取
    click_info: capture_click_info,//点击信息获取

    start_all: capture_start_all//启动所有监控
  }

  //信息存储模块
  var infoStorage = {

    error_info: [],//错误信息存储
    loading_info: {},//加载信息存储
    terminal_info: {},//终端信息存储
    request_info: [],//请求信息存储
    config_info: {},//配置模式信息存储
    click_info: [],//点击信息存储

    save: infoStorage_push//向信息存储模块存储消息
  }

  //消息推送队列
  var infoQueue = {

    queue: [],//待执行队列
    isWait: true,//是否可以进行上报(空闲模式标识，通过此识别是否在空闲模式，并上报信息)

    push: queue_push,//队列推入方法
    shutdown: queue_shutdown,//停止队列执行
    loop: queue_loop//队列执行器
  };

  //工具模块
  var utils = {
    deepCopy: utils_deep_copy
  }

  return {
    init: init,
    errorInfo: infoStorage.error_info,
    terminalInfo: infoStorage.terminal_info,
    requestInfo: infoStorage.request_info
  }

})();