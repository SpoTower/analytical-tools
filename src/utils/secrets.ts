// If you need more information about configurations or implementing the sample code, visit the AWS docs:
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started.html

import { Logger } from '@nestjs/common';
import { SecretsManager } from 'aws-sdk';
const logger = new Logger('AWS-SecretsManager');

export const getSecretFromSecretManager = async (secretName: string): Promise<string> => {
    const client = new SecretsManager({
        region: 'us-east-1',
    });

    return new Promise((resolve, reject) => {
        client.getSecretValue({ SecretId: secretName }, (err, data) => {
            if (err) {
                logger.error(`Error getting secret ${secretName} from AWS Secrets Manager: ${err.message}`);
                reject(err);
            } else {
                if ('SecretString' in data) {
                    resolve(data.SecretString);
                } else {
                    //if secret is binary
                    const buff = Buffer.from(data.SecretBinary as string, 'base64');
                    resolve(buff.toString('ascii'));
                }
            }
        });
    });
};

export async function loadDBCredentials() {
    if (!process.env.DB_PASSWORD_KEY) {
        logger.error('DB_PASSWORD_KEY environment variable is not set');
        return;
    }

    let secretData = await getSecretFromSecretManager(process.env.DB_PASSWORD_KEY);
    secretData = JSON.parse(secretData).SecretString;

    if (secretData) {
        const credentials = JSON.parse(secretData);
        process.env.DB_PASSWORD = credentials.password;
        process.env.DB_USERNAME = credentials.username;
    }
}
