var NebulosusClient = require('./client.js');
var UUID = require('./uuid.js');

var client = new NebulosusClient();

client.connect(function(err, client){

    var keysWritten = 0;
    function doSomething(){
        let value = UUID();
        // When using a callback we ensure that the
        // key was stored so we can retrieve it right
        // away if we need to.

        // Everything is persisted to the filesystem
        // and in memory and to other nodes. This is
        // currently utilizing a single node.
        client.put(value, UUID(), function(err){
            // This callback is actually triggered by
            // a response from the server.
            keysWritten += 1;
            console.log( "total keys = " + keysWritten);
            client.get(value, function(err, value){
                console.log(value);
                doSomething();
            });
        });
    }

    doSomething();

});
