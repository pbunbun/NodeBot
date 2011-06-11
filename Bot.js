var sys = require("sys"),
	net = require("net"),
	fs = require("fs");

var bot = {
	//Server info
	nick: "NodeBot",
	ident: "PAC",
	server: "irc.quakenet.org",
	port: 6667,
	channels: new Array("#nodebottest"),

	//Password for privileged users, and an array to store their hostmasks once they identify.
	password: "supersecretpasswordetc.",
	privMasks: new Array(),

	//List of commands to load on startup, and a dictionary to store them in.
	cmdList: new Array("quote", "crash", "crashInit", "testNoCall", "amipriv", "join", "part"),
	commands: {},

	//Functions all users can use
	pubAPI: { sendPrivMsg: function(chan, msg) { return bot.sendPrivMsg(chan, msg) }, },
	
	//Only available when an identified user calls a command
	privAPI: { joinChan: function(chan) { return bot.joinChan(chan) },
		partChan: function(chan, msg) { return bot.partChan(chan, msg) },
	},

	client: 0,

	buffer: "",

	init: function () {
		//Merge the two APIs, I can't see any other way of doing this unfortunately.
		for (func in this.pubAPI) {
			this.privAPI[func] = this.pubAPI[func];
		}

		//Load all the comamnds
		this.cmdList.forEach( function(element) { bot.loadCommand(element) });
		
		//Finally connect and add listeners
		this.client = net.createConnection(this.port, this.server);
		this.client.setEncoding("ascii");
		this.client.addListener("connect", function() { bot.onConnect() });
		this.client.addListener("data", function(data) { bot.onData(data) });
	},
	
	onConnect: function() {
		sys.puts("Client connected.");
		//IDENT and set nick on connect
		this.client.write("USER " + this.ident + " localhost localhost :" + this.nick + "\n");
		this.client.write("NICK " + this.nick + "\n");
	},
	
	onData: function(data) {
		//Load the buffer, clearing the global copy.
		var buf = this.buffer;
		this.buffer = "";
		
		while (data.indexOf('\n') != -1) {
			//Get everything up to the first '\n' and handle it
			buf += data.substring(0, data.indexOf('\n'));
			this.handleLine(buf);
			
			//Remove it from tmpData and clear buffer
			data = data.substring(data.indexOf('\n') + 1);
			buf = "";
		}
		if (data.length > 0) {
			//We have an incomplete line, buffer it and wait until more data comes
			this.buffer = data;
		}
	},
	
	//TODO: Implement more than PRIVMSG
	buildMessage: function(line) {
		var msg = {
			type: "UNIMPLEMENTED",
		}
		var tmpArr = line.split(' ');
		//If it's a PRIVMSG
		if (tmpArr[1] == "PRIVMSG") {
			//Decide if it's a PM or CHANMSG
			if (tmpArr[2] == this.nick) {
				msg.type = "PM";
			}
			else {
				msg.type = "CHANMSG";
			}
			//Build the rest of the msg struct
			msg.message = line.substring(line.indexOf(':', 1) + 1).trim();
			msg.target = tmpArr[2];
			msg.from = tmpArr[0].substring(1, tmpArr[0].indexOf('!'));
			msg.mask = tmpArr[0].substring(tmpArr[0].indexOf('!') + 1);
			msg.priv = this.privMasks.indexOf(msg.mask) != -1;
		}
		return msg;
	},

	//Each line (as separated by '\n') ends up here.
	handleLine: function(line) {
		sys.puts(line);
		//Remove the carriage return (if any).
		line = line.substring(0, line.lastIndexOf('\r'));
		
		//Respond to PING
		if (line.indexOf("PING") == 0) {
			sys.puts("PING received, responding");
			this.client.write("PONG " + line.slice(5) + "\n");
			return;
		}
		
		//Join the channel when we finally get +i
		//Could(/should) be parsed far better but for now this should do.
		if ((line.indexOf(":" + this.nick) == 0) && (line.indexOf("MODE " + this.nick + " +i") != -1)) {
			sys.puts("Joining channel");
			this.channels.forEach( function(element) { bot.joinChan(element) })
			return;
		}

		//Make the msg struct and handle it if PM or ChanMSG
		var msg = this.buildMessage(line);
		if (msg.type == "PM") {
			this.handlePM(msg);
		}
		else if (msg.type == "CHANMSG"){
			this.handleMSG(msg);
		}
	},
	
	handlePM: function(msg) {
		//If the PM'd message is the password add their hostmask to privileged list.
		if (msg.message == this.password) {
			if (!msg.priv) {
				this.privMasks.push(msg.mask);
				this.sendPrivMsg(msg.from, "Now authed.");
			}
			else {
				this.sendPrivMsg(msg.from, "Already authed.");
			}
			return;
		}

		//If it's a command handle it.
		if (msg.message[0] == '!') {
			this.handleCmd(msg);
		}
	},
	
	handleMSG: function(msg) {
		if (msg.message[0] == '!') {
			this.handleCmd(msg);
		}
	},
	
	//We have a message starting with ! in either a PM or Channel message.
	handleCmd: function(msg) {
		var command = "";
		if (msg.message.indexOf(' ') != -1) {
			//If there are arguments (the message is trimmed so can't end in a space)
			cmdName = msg.message.substring(1, msg.message.indexOf(' ')).toLowerCase();
			msg.message = msg.message.substring(msg.message.indexOf(' ') + 1);
		}
		else {
			//Otherwise just take the whole word as command and blank the message
			cmdName = msg.message.substring(1).toLowerCase();
			msg.message = "";
		}
		
		//If command doesn't exist do nothing
		if (!this.commands[cmdName]) {
			return;
		}
		command = this.commands[cmdName];
		
		//Now get the apppropriate API, if command says it needs privAPI but user not privileged do nothing.
		if (msg.priv) {
			var api = this.privAPI;
		}
		else {
			if (command.needPriv == true) {
				return;
			}
			var api = this.pubAPI;
		}
		
		//Flood protection if it's not a PM.
		//Must be done AFTER everything else, so that it doesn't update the lastCall time unless actually allowed run.
		if (msg.type != "PM") {
			//If it hasn't been called before in this channel or enough time has passed, and user is a lowly peasant.
			if ((msg.priv) || (!command.lastCall[msg.target])
				|| (Date.now() - command.lastCall[msg.target] >= command.timeLimit)) {
				//Update the last call time now.
				command.lastCall[msg.target] = Date.now();
			}
			else {
				//Not enough time passed.
				return;
			}
		}
		
		try {
			command.onCall(msg, api);
		}
		catch(e) {
			sys.puts("Command " + cmdName + " failed");
		}
	},
	
	//Privileged API starts here.
	
	//Load a command given a name
	//WARNING: Doesn't actually replace commands if they're updated due to node.js caching. So not in API for now.
	loadCommand: function(cmdName) {
		if (this.commands[cmdName]) {
			delete this.commands[cmdName];
		}
		try {
			//Try load the command
			command = require("./" + cmdName + ".js");
			//If it has an onInit function, call it.
			if (command.onInit) {
				command.onInit();
			}
			//If it doesn't have a onCall function, error.
			if (!command.onCall) {
				throw -1;
			}
			//If it doesn't have a timeLimit or lastCall, assign defaults
			if (!command.timeLimit) {
				command.timeLimit = 60000;
			}
			
			if (!command.lastCall) {
				command.lastCall = {};
			}
			this.commands[cmdName] = command;
			return true;
		}
		catch (e) {
			sys.puts("Failed to load " + cmdName);
			return false;
		}
	},
	
	//This is the function to join a channel
	joinChan: function(chan) {
		chan = chan.toLowerCase();
		if (this.channels.indexOf(chan) == -1) {
			this.channels.push(chan);
		}
		this.client.write("JOIN " + chan + "\n")
	},
	
	//This is the function to leave a channel
	partChan: function(chan, msg) {
		chan = chan.toLowerCase();
		if (this.channels.indexOf(chan) != -1) {
			this.channels.splice(this.channels.indexOf(chan), 1);
		}
		this.client.write("PART " + chan + " :" + msg + "\n");
	},
	
	//Public API starts here.
	
	//Sends a PM or channel message
	sendPrivMsg: function (chan, msg) {
		this.client.write("PRIVMSG " + chan + " :" + msg + "\n");
	},
}

bot.init();
