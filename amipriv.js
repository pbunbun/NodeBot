exports.timeLimit = 10000;
exports.lastCall = {};
exports.needPriv = false;

exports.onCall = function(msg, api) {
	//If it's a PM respond to that user, otherwise go in the channel it was sent to
	if (msg.type == "PM") {
		target = msg.from;
	} else {
		target = msg.target;
	}

	//Check if they're privileged or not.
	if (msg.priv) {
		var response = "Yes.";
	} else {
		var response = "No.";
	}
	api.sendPrivMsg(target, response);
}