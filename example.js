var NebulosusClient = require('./client.js');
var UUID = require('./uuid.js');

//var client = new NebulosusClient();
var client = new NebulosusClient('http://localhost:6175/nebulosus.sock');
//var client = new NebulosusClient('http://localhost:6174/nebulosus.sock');

client.connect(function(err, client){

    // Put Remove Get Test
    client.put("hello", "world", function(err){
        client.get("hello", function(err, value){
            console.log(value);
            client.remove("hello", function(err){
                client.get("hello", function(err, value){
                    console.log("Hello", value);
                    doSomething();
                });
            });
        });
    });

    var keysWritten = 0;
    function doSomething(){

        console.log("Stored " + keysWritten + " keys.");

        let key = UUID();
        // When using a callback we ensure that the
        // key was stored so we can retrieve it right
        // away if we need to.

        // Everything is persisted to the filesystem
        // and in memory and to other nodes. This is
        // currently utilizing a single node.
        client.put(key, UUID(), function(err){
            // This callback is actually triggered by
            // a response from the server.
            keysWritten += 1;
            //console.log( "total keys = " + keysWritten);
            doSomething();
        });
    }
});
