// TODO replace with more secure random.
function makeUUID() {return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (a, b) {return b = Math.random() * 16, (a == "y" ? b & 3 | 8 : b | 0).toString(16)})}

module.exports = makeUUID;