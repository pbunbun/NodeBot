//This module just crashes, useful for testing if the bot can survive poorly coded modules
exports.timeLimit = 30000;
exports.lastCall = {};
exports.needPriv = true;

exports.onCall = function(msg, api) {
	api.lolThisIsNotARealFunction();
}