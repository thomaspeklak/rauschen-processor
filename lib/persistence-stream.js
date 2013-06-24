"use strict";

var environment = process.env.NODE_ENV || "development";
var hostnameToCollection = require("rauschen-hostname-to-collection");
var EventsCounter = require("events-counter");

//MongoDB
var Db = require("mongodb").Db;
var Server = require("mongodb").Server;

//use a pause stream to allow the mongo adapter to connect before first write
var pauseStream = require("pause-stream")();
pauseStream.pause();

var Stream = require("stream");
var ps = new Stream();
var db;

ps.writable = true;

ps.write = function (data) {
    if (!data || !data.referrer.hostname) {
        return;
    }
    var collectionName = hostnameToCollection(data.referrer.hostname);
    var timingsCollection = db.collection(collectionName);
    timingsCollection.insert(data);
    this.emit("new-data");
};

ps.end = function (buf) {
    if (arguments.length) this.write(buf);
    this.destroy();
};

ps.destroy = function () {
    this.writeable = false;
};

pauseStream.pipe(ps);

if (environment === "development") {
    new EventsCounter(ps, "new-data");
}

var connectToDatabase = function (config) {
    var server = new Server(
        config.db.host,
        config.db.port, {
            "auto_reconnect": true,
            poolSize: 40
        }
    );

    db = new Db(
        config.db.database,
        server, {
            safe: false
        }
    );

    db.open(function (err) {
        if (err) {
            console.log(err);
            process.exit();
        }
        console.log("starting persistence stream");
        pauseStream.resume();
    });
};

module.exports = function (config) {
    config.on("update", function () {
        connectToDatabase(config.get("data"));
    });

    return pauseStream;
};
