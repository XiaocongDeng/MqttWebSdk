//ip��ַ�Ϸ���
function isValidIP(ip) {     
    var reg =  /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/     
    return reg.test(ip);     
} 
function isValidDomain(domain)
{
	var reg = /^([\w-]+\.)+((com)|(net)|(org)|(gov\.cn)|(info)|(cc)|(com\.cn)|(net\.cn)|(org\.cn)|(name)|(biz)|(tv)|(cn)|(mobi)|(name)|(sh)|(ac)|   (io)|(tw)|(com\.tw)|(hk)|(com\.hk)|(ws)|(travel)|(us)|(tm)|(la)|(me\.uk)|(org\.uk)|(ltd\.uk)|(plc\.uk)|(in)|(eu)|(it)|(jp))$/;
	return reg.test(domain);
}
function CheckNum(id) {
	var value = document.getElementById(id).value;
	var reg=/^[1-9]\d*$|^0$/; // ע�⣺���������� 0321 ���ָ�ʽ���粻��Ҫ��ֱ��reg=/^\d+$/; ���С����Ҳ��var reg = /^\d+(\.\d+)?$/; 
	//var reg=/^\d+$/;
	if(reg.test(value)==true){
		return true;
	}else{
		return false;
	}
}
function CheckNum1(id) {
	var value = document.getElementById(id).value;
	var reg=/^\d+$/;
	if(reg.test(value)==true){
		return true;
	}else{
		return false;
	}
}
function CheckIsChain(id){//���� false�������� true
	var value = document.getElementById(id).value;
	var reg = /[\u4e00-\u9fa5]/g;
	//var len = 0;
	for (var i=0; i<value.length; i++) {
		var c = value.charCodeAt(i);
		//���ı��뷶Χ
		if ((c >= 0x0001 && c <= 0x007e) || (0xff60<=c && c<=0xff9f)) {
		 
		}else {
		   return true;
		}
	}
	if(reg.test(value)==true){
		return true;
	}else{
		return false;
	}
}

//���Ӣ�ĺ�����
function CheckIsEnglishAndNum(id) {
	var value = document.getElementById(id).value;
	var reg=/[^\a-\z\A-\Z0-9]/g;
	if(reg.test(value)==true){
		return false;
	}else{
		return true;
	}
}
//���Ӣ�ĺ�����
function CheckIsEnglishAndNumByValue(id) {
	var value = document.getElementById(id).value;
	var reg=/[^\a-\z\A-\Z0-9]/g;
	if(reg.test(value)==true){
		return false;
	}else{
		return true;
	}
}