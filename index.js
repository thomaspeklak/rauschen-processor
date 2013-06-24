"use strict";

var packageInfo = require("./package");
var seaportConf = {
    host: process.argv[2],
    port: parseInt(process.argv[3], 10)
};

var net = require("net");
var Scuttlebutt = require("scuttlebutt/model");
var timing = new Scuttlebutt();

var persistenceStream = require("./lib/persistence-stream");
var dataExtractionStream = require("./lib/data-extraction-stream");
var dataEnrichStream = require("./lib/data-enrich-stream");

var timingStream = timing.createStream();
var enrichedStream = timingStream.pipe(dataExtractionStream()).pipe(dataEnrichStream());
var client = require("rauschen-registry").client;
var config = client(seaportConf.host, seaportConf.port);
enrichedStream.pipe(persistenceStream(config));

//@TODO refactor to use seaport
//used for RTA
//var socketStream         = require("./lib/socket-stream");
//var stringify = require("JSONStream").stringify;
//var serializedStream = enrichedStream.pipe(stringify(false));
//socketStream(function(stream) {
//serializedStream.pipe(stream);
//});

//serializedStream.pipe(process.stdout);
//timingStream.pipe(process.stdout);

var msg = function (message) {
    return function () {
        console.log(message);
    };
};

var seaport = require("seaport");
var ports = seaport.connect(seaportConf.host, seaportConf.port);

var initilizeStream = function () {
    ports.get("distributor@" + packageInfo.peerDependencies["rauschen-receiver"], function (ps) {
        var distributor = ps[0];

        var connection = net.connect(distributor);

        var cleanupAndInitialize = function () {
            connection.removeAllListeners();
            initilizeStream();
        };

        connection.on("connect", msg("connecting to distributor"));
        connection.on("timeout", msg("stream timeout"));
        connection.on("close", cleanupAndInitialize);

        timingStream.pipe(connection).pipe(timingStream, {
            end: false
        });
    });
};

initilizeStream();

process.send && process.send("processor turned on");
