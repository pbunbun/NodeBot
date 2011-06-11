exports.timeLimit = 0;
exports.lastCall = {};
exports.needPriv = true;

exports.onCall = function(msg, api) {
	api.joinChan(msg.message);
}