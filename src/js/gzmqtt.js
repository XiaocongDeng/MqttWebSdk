var gzmqtt = function(){
	var client;		//mqtt 客服端
	var deviceList ={} ;	//消息list
	var srcid ="" ;	//web唯一标识	
	var deviceinfo ={};
	function DeleteDeviceList() {
		//delete deviceList.srcid;
		delete deviceList.deviceID;
		delete deviceList.clientTopic;
		delete deviceList.sessionid;
		delete deviceList.pulltopic;
		delete deviceList.pushtopic;
		delete deviceList.msgid;
		delete deviceList.status;
		
		//deviceList.splice(i,1);
		return ;
	};
	function UninitSettingParam() {
		//client = "";
		DeleteDeviceList();
		//srcid = "";
		return ;
	};
	// Valid properties are: timeout userName password willMessage keepAliveInterval cleanSession useSSL invocationContext onSuccess onFailure hosts ports mqttVersion
	function CreateMqttClient(serverIp, serverPort) {
		Srcid();
		deviceList.serverip = serverIp;
		deviceList.serverport = serverPort;
		deviceList.clientstatus = false;
		if(client == "" || "undefined" === typeof client) {
			client = new Paho.MQTT.Client(serverIp, Number(serverPort), "");
		}
		client.onConnectionLost = onConnectionLost;
		client.onMessageArrived = onMessageArrived;
		client.onConnected = onConnected;
		var options = {
			invocationContext: { host:serverIp, port:serverPort},//,clientId:srcid //clientId不
			timeout: 20,
			keepAliveInterval: 10,//60
			onFailure: onFail,
			onSuccess:onConnected,
			useSSL:deviceList.sslflag
		};
		//console.log( options );
		client.connect(options);
	};
	//断连回调
	function onConnectionLost(responseObject) {
		console.log("onConnectionLost [errorcode: "+responseObject.errorCode+' error msg : '+responseObject.errorMessage+' ]');
		if (responseObject.errorCode !== 0) {
			console.log("Connection Lost. [Error Message: "+ responseObject.errorMessage+ "]");
			deviceList.status = "offline";
			deviceList.clientstatus = false;
			if(("" != deviceList.disconnectcallbackfun) && ("undefined" !== typeof deviceList.disconnectcallbackfun)) {
				deviceList.disconnectcallbackfun(responseObject.errorMessage);
			}else {
				console.log("error to set Connection lost callback function , Without this function !");
			}
		}
	};
	//消息回调
	function onMessageArrived(message) {
		console.log("msg == "+message.payloadString + ', dest topic == '+message.destinationName);
		var obj = JSON.parse(message.payloadString);
		if ((obj.cmd == "willbye") || (obj.cmd == "Hello")) {
			deviceList.msgcallbackfun("",obj);
			return ;
		}else if(obj.cmd == "login") {
			if ((null != obj.data)  && (obj.status == 200 || obj.statecode == 200)){
				console.log("login");
				PushAlarmSubscribe();//告警推送
				CleanKeepaliveInterva();
				SetKeepAliveInterval();
				
				deviceList.sessionid = obj.data.sessionid;
				deviceList.status = "online";
			}
		}else if(obj.cmd == "loginout" || obj.cmd == "operation") {
			CleanKeepaliveInterva();
			UnsubscribeFun(deviceList.clientTopic);
			UnsubscribeFun(deviceList.pushtopic);
			PushAlarmUnsubscribe();
			deviceList.status = "offline";
			deviceList.clientstatus = false;
			client.disconnect();/*主动断开mqtt服务器的连接，为什么要主动断开？*/
			deviceList.msgcallbackfun("", obj);
			return ;
		}
		
		if (("" != deviceList) && ("undefined" !== typeof deviceList) && ("pushdevicestatus" != obj.cmd)){
			deviceList.msgcallbackfun(deviceList.deviceID, obj);
		}
		return ;
	};
	/*连接成功回调*/
	function onConnected(reconnect) {
		console.log("Client Has now connected [host: "+reconnect.invocationContext.host+" port: "+reconnect.invocationContext.port+ "] !");
		if("undefined" !== typeof deviceList.clientTopic) {
			SubscribeFun(deviceList.clientTopic);
		}
		if("undefined" !== typeof deviceList.pushtopic) {
			SubscribeFun(deviceList.pushtopic);
		}
		deviceList.clientstatus = true;
		console.log(JSON.stringify(deviceList));
		if(("" != deviceList.connectcallbackfun) && ("undefined" !== typeof deviceList.connectcallbackfun)) {
			deviceList.connectcallbackfun();
		} else {
			console.log("error to set connection success callback function , Without this function !");
		}
		
		return ;
	};
	//连接失败
	function onFail(context) {			
		console.log("Failed to connect. [Error Message: "+ context.errorMessage+"]");
		FailedManageFun();
		deviceList.status = "offline";
		deviceList.clientstatus = false;
		return ;
	};
	function FailedManageFun() {
		PushAlarmUnsubscribe();
		UninitSettingParam();
	};

	function Logout() {
		SendMqttMsg( JSON.stringify(GroupRestApi("loginout","request",null)) );
		deviceList.status = "offline";
		FailedManageFun();
	};
	function SubscribeFun(topic) {
		if("undefined" !== typeof client || "" == client) {
			client.subscribe(topic);
		} else {
			console.log("subscribe failed [Error Message: Client not created] !");
		}
	}
	function UnsubscribeFun(topic) {
		if(typeof topic === "undefined") {
			return ;
		}
		if("undefined" !== typeof client || "" == client) {
			client.unsubscribe(topic);
		} else {
			console.log("unsubscribe failed [Error Message: Client not created] !");
		}
	};
	function InitDeviceList(deviceID,username) {
		if("" == srcid) {
			console.log("Login to the device failed [Error Message: Client ID allocation failed] !");return ;
		}
		deviceList.srcid = srcid;
		deviceList.deviceID = deviceID;
		deviceList.clientTopic = "gzipcweb/device/cli" + srcid + "/pullmsg";
		deviceList.sessionid = "null";
		deviceList.pulltopic = "topic/"+deviceID+"/pullmsg";
		deviceList.pushtopic = "topic/"+deviceID+"/pushmsg";
		deviceList.msgid = deviceID;
		deviceList.status = "offline";
		console.log(JSON.stringify(deviceList));
	}
	function AddDevices(deviceID, username, password) {
		//console.log(deviceList.clientstatus);
		InitDeviceList(deviceID,username);
		if(deviceList.clientstatus == true) {
			SubscribeFun(deviceList.clientTopic);
			SubscribeFun(deviceList.pushtopic);
			Login(username, password);
		}else if(deviceList.clientstatus == false){//断开mqtt服务器
			CreateMqttClient(deviceList.serverip, deviceList.serverport);
			setTimeout(function(){ Login(username, password); }, 500);
		}
		return srcid;
	};
	function Login(usename, password) {
		var data = {
			"username":usename,
			"password":password
		}
		SendMqttMsg(JSON.stringify(GroupRestApi("login", "request", data)));	
		return ;
	};
	function GroupRestApi(cmd, method, data, handle) {
		var msg= {
			"cmd": cmd,
			"method": method, 
			"msgid": deviceList.msgid,
			"sessionid":deviceList.sessionid,
			"topic": deviceList.clientTopic
		};
		if(null != data){
			msg.data = data;
		}
		return msg;
	};
	//push
	function SendMqttMsg(msg) {
		var message = new Paho.MQTT.Message(msg);  
		message.destinationName = deviceList.pulltopic;  
		client.send(message);  
		console.log("send topic:"+ deviceList.pulltopic + ', ' + "send message:"+msg);
		SetMsgId("0123456");//设会默认的sessionid
		return ;
	};
	function _KeepAlive() {
		SendMqttMsg(  JSON.stringify( GroupRestApi("keepalive","request",null) )  ); 
	};
	function PushAlarmSubscribe() {//订阅告警推送
		if(("undefined" !== typeof client.subscribe) && ("" != deviceList.deviceID) && ("undefined" !== typeof deviceList.deviceID) && ("" != srcid)) {
			client.subscribe("topic/"+deviceList.deviceID+"/alarm/pushmsg");
		} else {
			console.log("push alarm subscribe error [Error Message: Device ID is empty] !");
		}
		return;
	};

	function PushAlarmUnsubscribe() {//取消告警推送
		if(("undefined" !== typeof client.subscribe) && ("" != deviceList.deviceID) && ("undefined" !== typeof deviceList.deviceID) && ("" != srcid)) {
			client.unsubscribe("topic/"+deviceList.deviceID+"/alarm/pushmsg");
		} else {
			console.log("push alarm unsubscribe error [Error Message: Device ID is empty] !");
		}
		return;
	};
	//web唯一标识符
	function Srcid() {
		var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		if("" == srcid || " " == srcid || "undefined" === typeof srcid) {
			for (var i = 0; i < 8; i++) {
				srcid += possible.charAt(Math.floor(Math.random() * possible.length));
			}
		}
	};
	
	function _config(conf) {
		if("undefined" !== typeof conf) {
			if("undefined" !== typeof conf.onSuccess) {
				deviceList.connectcallbackfun = conf.onSuccess;
			} else {
				console.log("Connection success callback function setting failed [Error Message: Without this function] !");
			}
			if("undefined" !== typeof conf.onMessageArrived) {
				deviceList.msgcallbackfun = conf.onMessageArrived;
			} else {
				console.log("Message callback function setting failed [Error Message: Without this function] !");
			}
			if("undefined" !== typeof conf.onConnectionLost) {
				deviceList.disconnectcallbackfun = conf.onConnectionLost;
			} else {
				console.log("Connection Lost callback function setting failed [Error Message: Without this function] !");
			}
			if("undefined" !== typeof conf.sslflag) {
				deviceList.sslflag = conf.sslflag;
			} else {
				deviceList.sslflag = false;
			}
		} else {
			console.log("Set callback error [Error Message: Parameter is not defined] !");
		}
	};
	
	function SetKeepAliveInterval() {
		if(typeof deviceList.keepaliveintervalfalg === "undefined" || deviceList.keepaliveintervalfalg == "") {//第一次
			if(typeof deviceList.keepaliveinterval === "undefined" || typeof deviceList.keepaliveenable === "undefined") {
				_KeepAliveParam("default");
			}
			console.log(deviceList.keepaliveinterval);
			deviceList.keepaliveintervalfalg = setInterval(function() {//设置心跳
				if(typeof deviceList.status === "undefined" || typeof deviceList.clientstatus === "undefined") {//设备状态、mqtt服务器状态
					CleanKeepaliveInterva();
					return false;
				}
				_KeepAlive();
			}, parseInt(deviceList.keepaliveinterval)*1000);
		} else {//重新登录
			
		}
	};
	
	function CleanKeepaliveInterva() {
		if(typeof deviceList.keepaliveintervalfalg !== "undefined") {
			clearInterval(deviceList.keepaliveintervalfalg);
		}
		deviceList.keepaliveintervalfalg = "";
		return true;
	}
	
	function SetMsgId(msgid) {
		deviceList.msgid = msgid;
	};
	
	function _KeepAliveParam(conf) {
		if(typeof conf !== "undefined") {
			if(typeof conf.keepaliveinterval !== "undefined") {
				if(conf.keepaliveinterval<60*4 && conf.keepaliveinterval > 60*1) {//60*
					deviceList.keepaliveinterval = conf.keepaliveinterval;
				} else {
					console.log("Parameter setting failed [Error Message: Keepalive interval parameter is set incorrectly, only 60 to 240 can be set] !");
					deviceList.keepaliveinterval = 60;
				}
			} else {
				deviceList.keepaliveinterval = 60;
			}
			if(typeof conf.keepaliveenable !== "undefined") {
				if(conf.keepaliveenable == true || conf.keepaliveenable == false) {
					deviceList.keepaliveenable = conf.keepaliveenable;
				} else {
					console.log("Parameter setting failed [Error Message: Keepalive enable parameter is set incorrectly, only true and false can be set] !");
					deviceList.keepaliveenable = true;
				}
			} else {
				deviceList.keepaliveenable = true;
			}
		} else {
			console.log("Parameter setting failed [Error Message: Keepalive Parameter is not defined] !");
		}
	}

	return {
		InitClient : function (conf) {
			if(typeof conf.host === "undefined") {
				console.log("create client failed [Error Message: Host not found] ！");return false;
			}
			if(typeof conf.port === "undefined" || conf.port <= 0 || conf.port > 655535) {
				conf.port = 8083;//8084
			}
			_KeepAliveParam(conf);
			_config(conf);
			CreateMqttClient(conf.host, conf.port);
			
		},
		LoginDevice : function(deviceID, usename, password) {
			var reg = /[^\a-\z\A-\Z0-9]/g;
			console.log(deviceID.length);
			if((reg.test(usename)!=true) && (reg.test(password)!=true) && (usename.length < 32) && (password.length < 32) && (deviceID.length < 32)){
				AddDevices(deviceID, usename, password);
			}else {
				return 440;
			}
			return true;
		},
		LogoutDevice : function() {
			CleanKeepaliveInterva();
			Logout();
		},
		SetCallbackFunc : function(callbackList) {
			if(deviceList.status == "online") {
				if(("undefined" !== typeof callbackList.connectcallbackfun) && ("" != callbackList.connectcallbackfun)) {
					deviceList.connectcallbackfun = callbackList.connectcallbackfun;
				}
				if(("undefined" !== typeof callbackList.disconnectcallbackfun) && ("" != callbackList.disconnectcallbackfun)) {
					deviceList.disconnectcallbackfun = callbackList.disconnectcallbackfun;
				}
				if(("undefined" !== typeof callbackList.msgcallbackfun) && ("" != callbackList.msgcallbackfun)) {
					deviceList.msgcallbackfun = callbackList.msgcallbackfun;
				}
				return true;
			} else {
				console.log("set callback falied [Error Message: logged into the device] !");
			}
		},
		SetMessageId : function(msgid) {
			SetMsgId(msgid);
		},
		SetKeepAliveParam : function(conf) {
			_KeepAliveParam(conf);
		},
		GetDeviceStatus : function() {
			return deviceList.status;
		},
		GetClientStatus : function() {
			return deviceList.clientstatus;
		},
		SubscribeTopic : function(topic) {
			SubscribeFun(topic);
		},
		UnsubscribeTopic : function(topic) {
			UnsubscribeFun(topic);
		},
		PushAlarmEnabled : function() {
			PushAlarmSubscribe();
		},
		PushAlarmDisabled : function () {
			PushAlarmUnsubscribe();
		},
		ModifyUsrInfo : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("modifyuserinfo","request", data) )  ); 
		},
		SetHttpClientInfo : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("sethttpclientinfo","request", data) )  ); 
		},
		GetDeviceInfo : function (){
			SendMqttMsg(  JSON.stringify( GroupRestApi("getdeviceinfo","request",null) )  ); 
		},
		SetDeviceInfo : function (data){
			SendMqttMsg(  JSON.stringify( GroupRestApi("setdeviceinfo","request", data) )  ); 
		},
		GetNtpParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getntpparam","request", null) )  ); 
		},
		SetNtpParam : function (data) {
			SendMqttMsg(  requestMsg = JSON.stringify( GroupRestApi("setntpparam","request", data) )  ); 
		},
		GetCurrentTime : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getcurrenttime","request", null) )  ); 
		},
		SetCurrentTime : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setcurrenttime","request", data) )  ); 
		},
		GetUserInfo : function (){
			SendMqttMsg(  JSON.stringify( GroupRestApi("getuserinfo","request", null) )  ); 
		},
		AddUser : function (data){
			SendMqttMsg(  JSON.stringify( GroupRestApi("adduser","request", data) )  ); 
		},
		ModifyUserInfo : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("modifyuserinfo","request", data) )  ); 
		},
		DelUser : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("deluser","request", data) )  ); 
		},
		GetVideoEncodeParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getvideoencodeparam","request", data) )  ); 
		},
		SetVideoEncodeParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setvideoencodeparam","request", data) )  ); 
		},
		GetVideoEncodeCab : function (data){
			SendMqttMsg(  JSON.stringify( GroupRestApi("getvideoencodecab","request", data) )  ); 
		},
		GetAudioEncodeParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getaudioencodeparam","request", null) )  ); 
		},
		GetImagParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getimagparam","request", null) )  ); 
		},
		SetImagParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setimagparam","request", data) )  ); 
		},
		GetImagCab : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getimagcab","request", null) )  ); 
		},
		GetOsdParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getosdparam","request", null) )  ); 
		},
		SetOsdParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setosdparam","request", data) )  ); 
		},
		GetSnapParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getsnapparam","request",null) )  ); 
		},
		SetSnapParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setsnapparam","request",data) )  ); 
		},
//		Snap : function () {
//			SendMqttMsg(  JSON.stringify( GroupRestApi("snap","request",null) )  ); 
//		},
//		GetYuvData : function () {
//			SendMqttMsg(  JSON.stringify( GroupRestApi("getyuvdata","request",null) )  ); 
//		},
		GetMotionDetectionParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getmotiondetectparam","request",null) )  ); 
		},
		SetMotionDetectionParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setmotiondetectparam","request",data) )  ); 
		},
		PullAlarm : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("pullalarm","request",null) )  ); 
		},
		GetPtzMoveCab : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getptzmovecab","request",null) )  ); 
		},
		SetPtzMove : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setptzmove","request",data) )  ); 
		},
		SetPtzHomePoint : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setptzhomepoint","request",null) )  ); 
		},
		SetManualRecord : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setmanualrecord","request",data) )  ); 
		},
		VideoQueryRequest : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getrecordinginfo","request",data) )  ); 
		},
		GetRecordParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getrecordparam","request",null) )  ); 
		},
		SetRecordParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setrecordparam","request",data) )  ); 
		},
		GetAlarmLinkageParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getalarmparam","request",null) )  ); 
		},
		SetAlarmLinkageParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setalarmparam","request",data) )  ); 
		},
		GetNetWorkInfo : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getnetworkinfo","request",null) )  ); 
		},
		GetCurrentWifi : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getwifiinfo","request",null) )  ); 
		},
		SetCurrentWifi : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setwifiinfo","request",data) )  ); 
		},
		GetEmailParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getemailname","request",null) )  ); 
		},
		SetEmailParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setemailname","request",data) )  ); 
		},
		GetIrcutParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getircutparam","request",null) )  ); 
		},
		SetIrcutParam : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setircutparam","request",data) )  ); 
		},
		GetRtmpInfo : function (handle) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getrtmpinfo","request",null) )  ); 
		},
		SetRtmpInfo : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setrtmpinfo","request",data) )  ); 
		},
		GetPtzPreset : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getptzpreset","request",null) )  ); 
		},
		SetPtzPreset : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setptzpreset","request",data) )  ); 
		},
		GotoPtzPreset : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("gotoptzpreset","request",data) )  ); 
		},
		DeletePtzPreset : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("removeptzpreset","request",data) )  ); 
		},
		GetMqttServer : function () {
			SendMqttMsg(JSON.stringify( GroupRestApi("getmqttserver","request",null) )); 
		},
		SetMqttServer : function (data) {
			SendMqttMsg(JSON.stringify(  GroupRestApi("setmqttserver","request",data) )  ); 
		},
		GetSdcardParam : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("getsdcardparam","request",null) )  ); 
		},
		SetSdcardFormat : function () {
			SendMqttMsg(  JSON.stringify( GroupRestApi("setsdcardformat","request",null) )  ); 
		},
		OperationDevice : function (data) {
			SendMqttMsg(  JSON.stringify( GroupRestApi("operation","request",data) )  ); 
		},
		//1.05新+命令
		GetAudioOutVol : function (){
			SendMqttMsg(  JSON.stringify( GroupRestApi("getaudiooutvol","request",null) )  ); 
		},
		SetAudioOutVol : function (data){
			SendMqttMsg(  JSON.stringify( GroupRestApi("setaudiooutvol","request",data) )  ); 
		},
		ScanWifi : function (){
			SendMqttMsg(  JSON.stringify( GroupRestApi("scanwifi","request",null) )  ); 
		},
		GetRecordName : function (data){
			SendMqttMsg(  JSON.stringify( GroupRestApi("getrecordname","request",data) )  ); 
		},
		SetPtzHomeEnable : function (data){
			SendMqttMsg(  JSON.stringify( GroupRestApi("setptzhomeenable","request",data) )  ); 
		},
		GetPtzHomeEnable : function (){
			SendMqttMsg(  JSON.stringify( GroupRestApi("getptzhomeenable","request",null) )  ); 
		},
		FtpUpdate : function (data){
			SendMqttMsg(  JSON.stringify( GroupRestApi("ftpupdate","request",data) )  ); 
		}
	}
}

