const AWS = require('aws-sdk');

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';

// Initialize CloudWatch Logs
const cloudWatchLogs = new AWS.CloudWatchLogs({
  region: process.env.AWS_REGION || 'us-east-1',
});

 // Log group name (set up manually in AWS or via this code)
const logGroupName = process.env.AWS_LOG_GROUP_NAME_ANALYTICAL_SERVICE || 'analytical-tools-staging' ;
 const logStreamName = process.env.AWS_LOG_STREAM_NAME_ANALYTICAL_SERVICE || 'staging';
// Function to send logs to CloudWatch
async function logToCloudWatch(message: string,   level: LogLevel = 'INFO', context: string = 'global') {
  try {
    await cloudWatchLogs.putLogEvents({
      logGroupName: logGroupName,
      logStreamName: logStreamName,
   
      logEvents: [
        {
          message: `[${context}] ${level}: ${message}`,
          timestamp: Date.now(),
        },
      ],
    }).promise();
    console.log(`CW Log: [${context}] ${level}: ${message}`);
  } catch (error) {
    console.error('Error sending log to CloudWatch:', error);
  }
}

export { logToCloudWatch };
 