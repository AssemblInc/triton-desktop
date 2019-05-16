// UNFINISHED

const { Kafka } = require('kafkajs');

let kafkaHandler = {
    kafka: null,
    producer: null,
    consumer: null,

    init: function() {
        kafkaHandler.kafka = new Kafka({
            clientId: 'science.assembl.desktop',
            brokers: ['localhost:9092']
        });
    },

    setUpProducer: async function() {
        kafkaHandler.producer = kafkaHandler.kafka.producer();
        await kafkaHandler.producer.connect();
        await kafkaHandler.producer.send({
            topic: 'test-topic',
            messages: [
                {
                    value: 'this is a test!'
                }
            ]
        });
        await kafkaHandler.producer.disconnect();
    },

    setUpConsumer: async function() {
        kafkaHandler.consumer = kafkaHandler.kafka.consumer({
            groupId: 'test-group'
        });
        await kafkaHandler.consumer.connect();
        await kafkaHandler.consumer.subscribe({
            topic: 'test-topic'
        });
        await kafkaHandler.consumer.run({
            eachMessage: async function({ topic, partition, message }) {
                console.log({
                    value: message.value.toString()
                });
            }
        });
    }
};

/*
kafkaHandler.init();
kafkaHandler.setUpProducer();
kafkaHandler.setUpConsumer();
*/