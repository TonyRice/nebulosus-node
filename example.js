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

        // This callback is actually triggered by
        // a response from the server.
        client.put(key, UUID(), function(err){
            keysWritten += 1;
            doSomething();
        });
    }
});
