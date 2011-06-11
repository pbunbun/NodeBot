//Variables local to this file
var fs = require('fs'),
    sys = require('sys');


var filename = "/home/bunbun/quotes.txt";
var quotes;
var recent = new Array();
var buffer = "";

//Anything in the special "exports" object is visible to the bot.
//This is how often (in milliseconds) it can be run, and the time of last call. (Flood prevention)
exports.timeLimit = 10000;
exports.lastCall = {};
exports.needPriv = false;

reloadQuotes = function() {
	fs.readFile(filename, "ascii", function(err, data) {
		if (err) {
			throw err;
		}

		//Get the quotes.
		quotes = data.split("\n");

		//If there's any empty line (e.g. a newline at the end) ignore it.
		if (quotes.indexOf("") != -1) {
			quotes.splice(quotes.indexOf(""), 1);
		}
	});
}

//When module loaded read in all the quotes.
exports.onInit = function() {
	reloadQuotes();
}

//When command actually called get a quote and send it.
exports.onCall = function(msg, api) {
	//If it's a PM respond with a quote to that user, otherwise go in the channel it was sent to
	if (msg.type == "PM") {
		target = msg.from;
	}
	else {
		target = msg.target;
	}
	
	//Deal with arguments, assume just one at a time (can't think of a reason to complicate things)
	//Perhaps in future have arguments passed from bot itself to standardise if this gets used by other things?
	if (msg.message[0] == "-") {
		msg.message = msg.message.toLowerCase();
		args = msg.message.split(' ');
		//Privileged stuff first
		if (msg.priv) {
			if (args[0] == "-reload") {
				reloadQuotes();
				message = "Loaded " + quotes.length + " quotes.";
			}
		}
		//Non-privileged stuff now
		if (args[0] == "-n") {
			number = parseInt(args[1])
			if (number < quotes.length) {
				message = quotes[number];
			}
			else {
				message = "No quote with that number. Pick one between 0 and " + (quotes.length - 1) + ".";
			}
		}
	}
	else {
		len = quotes.length;
		
		//Get one that hasn't been used recently,then add it
		do {
			number = Math.floor(Math.random() * len);
		} while (recent.indexOf(number) != -1);
		if (recent.length == 10) {
			recent.shift();
		}
		recent.push(number);
		
		message = quotes[number];
	}
	api.sendPrivMsg(target, message);
}