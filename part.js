exports.timeLimit = 0;
exports.lastCall = {};
exports.needPriv = true;

exports.onCall = function(msg, api) {
	api.partChan(msg.message, "Bye!");
}