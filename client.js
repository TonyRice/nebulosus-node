var SockJS = require('sockjs-client'),
    UUID = require('./uuid.js'),
    CRC = require('crc');

var NebulosusClient = function(url){
    // The default url to Nebulosus is defined as belowW
    url = (typeof url) === 'string' ? url : 'http://localhost:6174/nebulosus.sock';

    // This simply allows us to identify this client
    const clientUUID = UUID(),
        uuidCRC = CRC.crc32(clientUUID);

    // We simply send the uuidCRC along with each
    // request. This is not for security but more for
    // the client to be able to handle response accordingly.

    let connected = false,
        handshakeSent = false,
        handshakeFinished = false;

    let sock = null;

    const callbackMap = {};

    function initializeSock(connectCB){

        sock = new SockJS(url);
        sock.onopen = function(){
            connected = true;
            sendHandshake();
        };

        sock.onmessage = function(e) {
            const data = new Buffer(e.data);

            if(handshakeSent === false){
                connectCB(new Error("Protocol Error: Data has been received without handshake first."));
                return;
            }

            if(handshakeFinished === false){
                if(data.readInt8(0) === 65){
                    var rUUID = data.toString('utf-8', 1, data.length);
                    if(rUUID === clientUUID){
                        handshakeFinished = true;
                        connectCB();
                        return;
                    }
                }
                connectCB(new Error("Protocol Error: Data has been received without handshake first."));
                return;
            }


            setImmediate(function(){
                const cmd = data.readInt8(0);

                // This means we are trigger a success callback
                if(cmd === 12){
                    var len = data.readUInt16BE(3);
                    var cbId = data.toString('utf-8', 5, len + 6);

                    if(callbackMap.hasOwnProperty(cbId)){
                        var callback = callbackMap[cbId];
                        try {callback();} catch (ignored){}
                        delete callbackMap[cbId];
                    }
                } else if(cmd === 13){
                    var dataLen = data.readUInt16BE(3);
                    if(data.length > dataLen + 6){
                        var cbData = data.toString('utf-8', 5, dataLen + 6);
                        var cbLen = data.readUInt16BE(dataLen + 7);
                        var cbId = data.toString('utf-8', dataLen + 9, cbLen + dataLen + 9);
                        if(callbackMap.hasOwnProperty(cbId)){
                            var callback = callbackMap[cbId];
                            try {callback(undefined, cbData);} catch (ignored){}
                            delete callbackMap[cbId];
                        }
                    } else {
                        // This is a callback with a null value.
                        var cbId = data.toString('utf-8', 5, dataLen + 6);
                        if(callbackMap.hasOwnProperty(cbId)){
                            var callback = callbackMap[cbId];
                            try {callback(undefined, null);} catch (ignored){}
                            delete callbackMap[cbId];
                        }
                    }
                }
            });
        };

        sock.onclose = function() {
            // TODO
            console.log('close');
        };
    }

    /**
     * This will go ahead and send a handshake to the server so we can
     * create a "session" context.
     */
    function sendHandshake(){
        // TODO handle errors better
        if(connected === false){
            throw "Cannot send handshake when the client is not connected!";
        }

        const uuidLen = clientUUID.length;
        const crcStr = uuidCRC.toString();
        const crcLen = crcStr.length;

        // Let's build the handshake
        const cmd = Buffer.alloc(uuidLen + crcLen + 3);
        let pos = cmd.writeInt8(64, 0);
        pos = cmd.writeInt8(uuidLen, pos);
        pos += cmd.write(clientUUID, pos);
        pos = cmd.writeInt8(crcLen, pos);
        cmd.write(crcStr, pos);

        sock.send(cmd);

        // Tell the client that we have sent our
        // handshake. So if the server doesn't respond
        // properly then we not good.
        handshakeSent = true;
    }

    function checkConnected(cb){
        if(connected === false || handshakeSent === false || handshakeFinished === false){
            if((typeof cb) === 'function'){
                cb(new Error("It looks like the client is not currently connected!"));
                return;
            }
            throw "It looks like the client is not currently connected!";
        }
    }

    const self = this;

    this.connect = function(cb){
        if(connected === true && handshakeSent === true){
            cb(new Error("It looks like the client is already connected!"));
            return;
        }

        initializeSock(function(err){
            if(err){
                cb(err);
                return;
            }
            cb(undefined, self);
        });
    };

    function getDataType(data){
        var typeOf = (typeof data);
        if(typeOf === 'string'){
            return 97;
        } else if(typeOf === 'object'){
            return 95;
        }
    }

    this.remove = function(key, cb){
        checkConnected(cb);

        var msgUUID = UUID(),
            uuidLen = msgUUID.length;

        // If there's no callback we do not need a response.

        // WE KNOW the server will receive the data as long as there is a connection.

        var keyTypeOf = getDataType(key);

        var bufSize = 3;

        var keyIsStr = (keyTypeOf === 97);

        if(keyIsStr){
            bufSize += key.toString().length + 4; // always include 4 extra bytes to include the size.
        }

        // We need this for the callback.
        if(cb){
            bufSize += uuidLen + 4;
        }

        // TODO setup other values

        // Let's build the handshake
        var cmd = Buffer.alloc(bufSize);
        var pos = cmd.writeInt8(81, 0);
        pos = cmd.writeInt8(keyTypeOf, pos);

        if(keyIsStr){
            var kStr = key.toString();
            var kSize = kStr.length;
            pos = cmd.writeUInt32BE(kSize, pos);
            pos += cmd.write(kStr, pos);
        }

        // Let's setup the callback
        if(cb){
            pos = cmd.writeUInt32BE(uuidLen, pos);
            pos += cmd.write(msgUUID.toString(), pos);

            callbackMap[msgUUID] = cb;


            // After about 5 seconds we timeout
            setTimeout(function(){
                if(callbackMap.hasOwnProperty(msgUUID)){
                    cb(new Error("Timeout occurred!"));
                }
            }, 5000);
        }

        sock.send(cmd);
    };

    this.put = function(key, value, cb){
        checkConnected(cb);

        var msgUUID = UUID(),
            uuidLen = msgUUID.length;

        // TODO verify and check

        // If there's no callback we do not need a response.

        // WE KNOW the server will receive the data as long as there is a connection.

        var keyTypeOf = getDataType(key);
        var valTypeOf = getDataType(value);

        var bufSize = 3;

        var keyIsStr = (keyTypeOf === 97);
        var valeIsStr = (valTypeOf === 97);

        if(keyIsStr){
            bufSize += key.toString().length + 4; // always include 4 extra bytes to include the size.
        }

        if(valeIsStr){
            bufSize += value.toString().length + 4; // always include 4 extra bytes to include the size.
        }

        // We need this for the callback.
        if(cb){
            bufSize += uuidLen + 4;
        }

        // TODO setup other values

        // Let's build the handshake
        var cmd = Buffer.alloc(bufSize);
        var pos = cmd.writeInt8(83, 0); // this means we want to store data
        pos = cmd.writeInt8(keyTypeOf, pos);
        pos = cmd.writeInt8(valTypeOf, pos);

        if(keyIsStr){
            var kStr = key.toString();
            var kSize = kStr.length;
            pos = cmd.writeUInt32BE(kSize, pos);
            pos += cmd.write(kStr, pos);
        }

        if(valeIsStr){
            var vStr = value.toString();
            var vSize = vStr.length;
            pos = cmd.writeUInt32BE(vSize, pos);
            pos += cmd.write(vStr, pos);
        }

        // Let's setup the callback
        if(cb){
            pos = cmd.writeUInt32BE(uuidLen, pos);
            pos += cmd.write(msgUUID.toString(), pos);

            callbackMap[msgUUID] = cb;

            // After about 5 seconds we timeout
            setTimeout(function(){
                if(callbackMap.hasOwnProperty(msgUUID)){
                    cb(new Error("Timeout occurred!"));
                }
            }, 5000);
        }

        sock.send(cmd);
    };

    this.get = function(key, cb){
        checkConnected(cb);

        var msgUUID = UUID(),
            uuidLen = msgUUID.length;

        // TODO verify and check

        // If there's no callback we do not need a response.

        // WE KNOW the server will receive the data as long as there is a connection.

        var keyTypeOf = getDataType(key);

        var bufSize = 2;

        var keyIsStr = (keyTypeOf === 97);

        if(keyIsStr){
            bufSize += key.toString().length + 4; // always include 4 extra bytes to include the size.
        }
        // We need this for the callback.
        if(cb){
            bufSize += uuidLen + 4;
        }

        // TODO setup other values

        // Let's build the handshake
        var cmd = Buffer.alloc(bufSize);
        var pos = cmd.writeInt8(82, 0); // this means we want to retrieve data
        pos = cmd.writeInt8(keyTypeOf, pos);

        if(keyIsStr){
            var kStr = key.toString();
            var kSize = kStr.length;
            pos = cmd.writeUInt32BE(kSize, pos);
            pos += cmd.write(kStr, pos);
        }

        // Let's setup the callback
        if(cb){
            pos = cmd.writeUInt32BE(uuidLen, pos);
            pos += cmd.write(msgUUID.toString(), pos);

            callbackMap[msgUUID] = cb;

            // After about 5 seconds we timeout
            setTimeout(function(){
                if(callbackMap.hasOwnProperty(msgUUID)){
                    cb(new Error("Timeout occurred!"));
                }
            }, 5000);
        }

        sock.send(cmd);
    };
};

module.exports = NebulosusClient;