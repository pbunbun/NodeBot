//This module just crashes on Init, to test if the Bot can catch it.
exports.timeLimit = 30000;
exports.lastCall = {};
exports.needPriv = true;

exports.onInit = function(msg, api) {
	api.lolThisIsNotARealFunction();
}