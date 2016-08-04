'use strict';

var http = require('http');

var options = {
    host: 'something.zendesk.com',
    port: 80,
    path: '/access/unauthenticated'
};

var argv = require ('yargs')
    .usage("Usage: Enter in arguments separated by spaces")
    .argv;

function testURL(companyName) {
    // Bad input handling
    if (!companyName || companyName == "") {
        console.log("Empty String");
        return;
    } else if (/\s/g.test(companyName)) {
        console.log(companyName + ": Invalid String");
        return;
    }
    options.host = companyName + ".zendesk.com";
    var req = http.request(options, function(res) {
        res.setEncoding("utf8");
        res.on("data", function (chunk) {
            content += chunk;
        });
        var truncatedString = "";
        var content = "";
        options.host = "";
        res.on("end", function () {
            truncatedString = content.substring(0,50);
            if (truncatedString.includes("You are being")) {
                console.log(companyName + ": Good");
            } else {
                console.log(companyName + ": Bad"); 
            }
        });
    });
    req.end();
}

function checkInputs(inputs) {
    for (var i = 0; i < inputs.length; ++i) {
        testURL(inputs[i]);
    }
}

var inputs = ["azuqua", "testtest123", "arsitoenas", "", "zoosk", "aireosnt 324 rsta", "arst", "9now"]

checkInputs(argv._);
