var net = require('net');
var uuid = require('node-uuid');
var md5 = require('md5');
var request = require('request');

var HOST = 'danmu.douyutv.com';
var PORT = 8602;
// var HOST = 'ws://mbgows.plu.cn';
// var PORT = '8805'

function send(socket, payload)
{	
	var data = new Buffer(4 + 4 + 4 + payload.length + 1);
	data.writeInt32LE(4 + 4 + payload.length + 1, 0); //length
	data.writeInt32LE(4 + 4 + payload.length + 1, 4); //code
	data.writeInt32LE(0x000002b1, 8); //magic
	data.write(payload, 12); //payload
	data.writeInt8(0, 4 + 4 + 4 + payload.length); //end of string
	socket.write(data)
}

function login(socket, roomid, user, password)
{
	var req = 'type@=loginreq/username@=' + user + '/password@=' + password + '/roomid@=' + roomid;
	send(socket, req);
}

function getGroupServer(roomid, callback)
{
	request({uri:'http://www.douyutv.com/' + roomid}, function(err, resp, body) {
		// var server_config = JSON.parse(body.match(/room_args = (.*?)\}\;/g)[0].replace('room_args = ', '').replace(';', ''));
		// server_config = JSON.parse(unescape(server_config['server_config']));
		server_config=[{"ip":"119.90.49.106","port":"8027"},{"ip":"119.90.49.106","port":"8028"},{"ip":"119.90.49.104","port":"8019"},{"ip":"119.90.49.106","port":"8029"},{"ip":"119.90.49.101","port":"8004"},{"ip":"119.90.49.91","port":"8053"},{"ip":"119.90.49.102","port":"8009"},{"ip":"119.90.49.110","port":"8048"},{"ip":"119.90.49.103","port":"8014"},{"ip":"119.90.49.106","port":"8030"}];
		callback(server_config[1].ip, server_config[1].port);
	});
}

function getGroupId(roomid, callback)
{
	var rt = new Date().now;
	var devid = uuid.v4().replace(/-/g, '');
	var vk = md5(rt + '7oE9nPEG9xXV69phU31FYCLUagKeYtsF' + devid)
	var req = 'type@=loginreq/username@=/password@=/roomid@=' + 
		roomid + '/ct@=0/vk@=' + vk + '/devid@=' + 
		devid + '/rt@=' + rt + '/ver=@20150929/';
	
	getGroupServer(roomid, function(server, port) {
		console.log('group server: ' + server + ':' + port);
		var socket = net.connect(port, server, function() {
			send(socket, req);
		});
		
		socket.on('data', function(data) {
			if (data.indexOf('type@=setmsggroup') >= 0) {
				var gid = data.toString().match(/gid@=(.*?)\//g)[0].replace('gid@=', '');
				gid = gid.substring(0, gid.length - 1);
				socket.destroy();
				callback(gid);
			}
		});	
	});
}

function monitorRoom(roomid)
{
	var socket = net.connect(PORT, HOST, function() {
		login(socket, 'visitor1234567', '1234567890123456'); 
	});
	
	setInterval(function() {
		send(socket, 'type@=keeplive/tick@=70/'); //send keep alive message repeatly
	}, 1000);
	
	socket.on('data', function(data) {
		console.log("socket.on");
		//data is a Buffer here
		if (data.indexOf('type@=loginres') >= 0) {
			getGroupId(roomid, function(gid) {
				console.log('gid of room[' + roomid +'] is ' + gid);
				send(socket, 'type@=joingroup/rid@=' + roomid + '/gid@=' + gid + '/');
			});
		} else if (data.indexOf('type@=chatmessage') >= 0) {
			var msg = data.toString();
			var snick = msg.match(/snick@=(.*?)\//g)[0].replace('snick@=', '');
			var content = msg.match(/content@=(.*?)\//g)[0].replace('content@=', '');
			
			snick = snick.substring(0, snick.length - 1);
			content = content.substring(0, content.length - 1);
			console.log(snick + ': ' + content);// 弹幕
		} else if (data.indexOf('type@=userenter') >= 0 ||
			data.indexOf('type@=keeplive') >= 0 ||
			data.indexOf('type@=dgn/gfid@=131') >= 0 ||
			data.indexOf('type@=blackres') >= 0 ||
			data.indexOf('type@=dgn/gfid@=129') >= 0 || 
			data.indexOf('type@=upgrade') >= 0 ||
			data.indexOf('type@=ranklist') >= 0 ||
			data.indexOf('type@=onlinegift') >= 0) {
			//没用的消息
		} else if (data.indexOf('type@=spbc') >= 0) {
			var drid = data.toString().match(/drid@=(.*?)\//g)[0].replace('drid@=', '');
			drid = drid.substring(0, drid.length - 1);
			
			console.log('rocket! room id:' + drid);
		} else {
			console.log(data.toString());	//在这里显示其它类型的消息
		}
	});
}

monitorRoom('271934');