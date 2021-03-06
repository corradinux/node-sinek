"use strict";

const assert = require("assert");
const {NConsumer, NProducer} = require("./../../index.js");
const {producerConfig, consumerConfig, topic} = require("./../nconfig.js");

describe("NSinek INT Buffer (1by1)", () => {

  let consumer = null;
  let producer = null;
  const consumedMessages = [];
  let firstMessageReceived = false;
  let messagesChecker;

  let producerAnalyticsResult = null;
  let consumerAnalyticsResult = null;
  let commitCount = -1;
  let commits = 0;
  let comittedMessages = 0;

  const oneByNModeOptions = {
    batchSize: 1,
    commitEveryNBatch: 1,
    concurrency: 1,
    commitSync: true
  };

  before(done => {

    producer = new NProducer(producerConfig, null, "auto");
    consumer = new NConsumer([topic], consumerConfig);

    const analyticsOptions = {
      analyticsInterval: 500,
      lagFetchInterval: 1000
    };

    producer.enableAnalytics(analyticsOptions);
    producer.on("analytics", res => producerAnalyticsResult = res);

    consumer.on("analytics", res => consumerAnalyticsResult = res);
    consumer.enableAnalytics(analyticsOptions);

    consumer.on("commit", messageCount => {
      //console.log("com", messageCount);
      commitCount = messageCount;
      commits++;
      comittedMessages += messageCount;
    });

    producer.on("error", error => console.error(error));
    consumer.on("error", error => console.error(error));

    Promise.all([
      producer.connect(),
      consumer.connect()
    ]).then(() => {
      consumer.consume((message, callback) => {
        consumedMessages.push(message);
        callback();
      }, false, false, oneByNModeOptions).then(() => {
        firstMessageReceived = true;
      });
      setTimeout(done, 1900);
    });
  });

  after(done => {
    if(producer && consumer){
      producer.close();
      consumer.close(true); //commit
      setTimeout(done, 500);
    }
  });

  it("should make sure topic exists (get metdata)", () => {
    return producer.getTopicMetadata(topic);
  });

  it("should be able to produce messages", () => {

    const promises = [
      producer.send(topic, "a message"),
      producer.bufferFormatPublish(topic, "1", {content: "a message 1"}, 1, null, 0),
      producer.bufferFormatUpdate(topic, "2", {content: "a message 2"}, 1, null, 0),
      producer.bufferFormatUnpublish(topic, "3", {content: "a message 3"}, 1, null, 0),
      producer.send(topic, new Buffer("a message buffer")),
      producer.send(topic, new Buffer("a message buffer"))
    ];

    return Promise.all(promises);
  });

  it("should be able to wait", function(done){
    this.timeout(10000);
    messagesChecker = setInterval(()=>{
      if(consumedMessages.length >= 6){
        clearInterval(messagesChecker);
        done();
      }
    }, 500);
  });

  it("should have received first message", done => {
    assert.ok(firstMessageReceived);
    done();
  });

  it("should be able to consume messages", done => {

    assert.equal(consumedMessages.length, 6);
    assert.equal(consumedMessages.length, producer.getStats().totalPublished);
    assert.equal(consumedMessages.length, consumer.getStats().totalIncoming);

    assert.ok(consumedMessages.length);
    assert.ok(Buffer.isBuffer(consumedMessages[0].value));
    assert.equal(consumedMessages[0].value.toString("utf8"), "a message");
    assert.equal(JSON.parse(consumedMessages[1].value.toString("utf8")).payload.content, "a message 1");
    assert.equal(JSON.parse(consumedMessages[2].value.toString("utf8")).payload.content, "a message 2");
    assert.equal(JSON.parse(consumedMessages[3].value.toString("utf8")).payload.content, "a message 3");
    assert.equal(consumedMessages[4].value.toString("utf8"), "a message buffer");
    done();
  });

  it("should be able to get partition count for topic", done => {
    producer.getPartitionCountOfTopic(topic).then(count => {
      //console.log(count);
      //console.log(producer.getStoredPartitionCounts());
      assert.ok(count);
      assert.ok(producer.getStoredPartitionCounts()[topic].count);
      done();
    });
  });

  it("should be able to get partition count for topic (from cache)", done => {
    producer.getPartitionCountOfTopic(topic).then(count => {
      //console.log(count);
      //console.log(producer.getStoredPartitionCounts());
      assert.ok(count);
      assert.ok(producer.getStoredPartitionCounts()[topic].count);
      done();
    });
  });

  it("should return -1 on error", done => {
    producer.getPartitionCountOfTopic("dont-exist-x").then(count => {
      //console.log(count);
      assert.equal(count, -1);
      done();
    });
  });

  it("should be able to get offsets for topic", () => {
    return consumer.getOffsetForTopicPartition(topic, 0);
  });

  it("should be able to get comitted offsets", () => {
    consumer.getAssignedPartitions();
    return consumer.getComittedOffsets();
  });

  it("should be able to get lag infos for consumer", () => {
    return consumer.getLagStatus().then(awass => {
      console.log(awass);
      return true;
    });
  });

  it("should be able to see producer analytics data", () => {
    assert.ok(producerAnalyticsResult);
    console.log(producer.getAnalytics());
  });

  it("should be able to see consumer analytics data", () => {
    assert.ok(consumerAnalyticsResult);
    console.log(JSON.stringify(consumer.getAnalytics(), null, 4));
  });

  it("should be able to see correct amount of commits", () => {
    console.log(commitCount, comittedMessages, commits);
    assert.equal(oneByNModeOptions.batchSize, commitCount);
    assert.equal(comittedMessages, 6);
    assert.equal(commits, 6);
  });

  it("should be able to make health checks", () => {
    return Promise.all([
      consumer.checkHealth().then(console.log),
      producer.checkHealth().then(console.log)
    ]);
  });
});
