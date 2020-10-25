import AWS from 'aws-sdk';
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
const myFormat = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
});
const logger = createLogger({
    format: combine(
        label({ label: 'slayer' }),
        timestamp(),
        myFormat
    ),
    transports: [new transports.Console()]
});

// switch (options.slay) {
//     case 'slay':
//         logger.info('')
//         break;
//     case 'dryrun':
//         logger.info('')
//         break;
//     default:
// }

/**
 * 🥞 CloudFormation
 */
export async function getStacks(options) {
    logger.info('Getting stacks...');

    AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: options.profile });

    let stackList = [];
    const cloudformation = await new AWS.CloudFormation({ region: options.region });

    return await cloudformation.describeStacks({}).promise();

}

export async function getStackResources(options) {
    if (options.stack) {
        logger.info('Getting stack resources...');

        AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: options.profile });
        const cloudformation = await new AWS.CloudFormation({ region: options.region });
        var params = {
            StackName: options.stack
        };
        return await cloudformation.listStackResources(params).promise();
    } else { return false; }
}


/**
 * ⛅ CloudFront
 */

export async function getDomains(options) {
    if (options.stack) {
        AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: options.profile });
        const apigateway = await new AWS.APIGateway({ region: options.region });
        var params = { limit: 500 };
        return await apigateway.getDomainNames(params).promise();
    } else { return false; }
}


/**
 * 🚮 s3 buckets
 */

export async function deleteBucketContents(options, bucket) {
    if (!options.slay) { logger.error('No slaying was specified') }
    if (!options.stack) { logger.error('No stack was specified to deleteBucket') }
    if (!bucket) { logger.error('No bucket was specified to deleteBucket') }

    try {
        AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: options.profile });
        const s3 = await new AWS.S3();

        // get a list of objects in our target bucket
        const { Contents } = await s3.listObjects({ Bucket: bucket }).promise();
        if (Contents.length > 0) {

            // delete the objects inside the bucket
            switch (options.slay) {
                case 'slay':

                    // ❌ BUG: This will only deal with up to 1000 objects, this needs work.
                    // await s3
                    //     .deleteObjects({
                    //         bucket,
                    //         Delete: {
                    //             Objects: Contents.map(({ Key }) => ({ Key }))
                    //         }
                    //     })
                    //     .promise();

                    logger.info('We emptied a bucket here.')

                    break;
                case 'dryrun':

                    logger.info('Dry run: We would have emptied a bucket here.')

                    break;
                default:
            }

        }

        // finally, delete the bucket itself
        // await s3.deleteBucket({ bucket }).promise();
        return true;
    } catch (err) {
        logger.error(err)
        return false;
    }

}


/**
 * 🩸 Slay the stack!
 */

export async function slayTheStack(options) {
    logger.info('Slaying the stack...');
    if (options.stack) {
        AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: options.profile });
        const cloudformation = await new AWS.CloudFormation({ region: options.region });
        var params = {
            StackName: options.stack
        };
        const stack = await cloudformation.listStackResources(params).promise();

        // aws apigateway delete-base-path-mapping --domain-name <domain> --base-path 'ditto' --profile mfa --region eu-west-2
        // const domains = await getDomains(options)
        // console.log('🌍', domains.items.map(domain => {
        //     return {
        //         domainName: domain.domainName,
        //         distributionDomainName: domain.distributionDomainName,
        //         distributionHostedZoneId: domain.distributionHostedZoneId
        //     }
        // }));

        for (const resource of stack.StackResourceSummaries) {

            // deal with bucket problems
            // - A bucket can't be deleted when it has things in it = delete everything in the bucket
            if (resource.ResourceType === 'AWS::S3::Bucket') {
                deleteBucketContents(options, resource.PhysicalResourceId);
            }

            // Delete base path mapping...
            // var params = {
            //     basePath: 'STRING_VALUE', /* required */
            //     domainName: 'STRING_VALUE' /* required */
            // };
            // apigateway.deleteBasePathMapping(params, function (err, data) {
            //     if (err) console.log(err, err.stack); // an error occurred
            //     else console.log(data);           // successful response
            // });


            //if (resource.ResourceType === 'AWS::ApiGateway::Deployment') {
            //console.log('🐕‍', resource)
            //}
            // if (resource.ResourceType === 'AWS::ApiGateway::Method') {
            //console.log('🐕‍', resource)
            // }
            // if (resource.ResourceType === 'AWS::ApiGateway::Resource') {
            //console.log('🐕‍', resource)
            // }

            if (resource.ResourceType === 'AWS::ApiGateway::RestApi') {
                const apigateway = new AWS.APIGateway({ region: options.region });
                // we do a APIGateway.getDeployments() here ?

                //deal with api gateway problems
                const api = await apigateway.getBasePathMapping({
                    //restApiId: resource.PhysicalResourceId,
                    //deploymentId: ,
                    //embed: ['apisummary']
                    basePath: '',
                    domainName: ''
                }).promise();

                // if (api && api.items && api.items.length > 0) {
                //     for (const deployment of api.items) {
                //         const stages = await apigateway.getStages({
                //             restApiId: resource.PhysicalResourceId,
                //             deploymentId: deployment.id
                //         }).promise();
                //         console.log('🐕‍', stages)
                //     }
                // }

                console.log('🐕‍🦺', api)

                switch (options.slay) {
                    case 'slay':

                        //const deletedBasePaths = await apigateway.deleteBasePathMapping(params).promise();

                        logger.info('We deleted a domain mapping from API Gateway')

                        break;
                    case 'dryrun':
                        logger.info('Dry run: We would have deleted a domain mapping from API Gateway')
                        break;
                    default:
                }


            }

            // how about lambda problems
            if (resource.ResourceType === 'AWS::Lambda::Function') {

            }
        };
        return false;
        //return await cloudformation.deleteStack(params).promise();
    } else { return false; }
}